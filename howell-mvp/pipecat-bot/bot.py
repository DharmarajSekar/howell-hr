#!/usr/bin/env python3
"""
Howell HR — Pipecat AI Interview Bot
======================================
Orchestration framework : Pipecat
WebRTC transport         : Daily.co
Speech-to-Text           : Deepgram nova-2
Brain / LLM              : Google Gemini 1.5 Flash (FREE tier)
Text-to-Speech           : ElevenLabs turbo-v2.5
Avatar                   : Simli real-time lip-sync
Interruption handling    : Pipecat allow_interruptions=True + WebRTCVAD

Invocation (env vars set by server.py before subprocess.Popen):
  DAILY_ROOM_URL, DAILY_BOT_TOKEN
  APPLICATION_ID, ROUND_ID
  CANDIDATE_NAME, JOB_TITLE, COMPANY_NAME
  INTERVIEW_QUESTIONS  (JSON array of strings)
  MAX_DURATION_SECONDS (default 2700 = 45 min)
  HRMS_CALLBACK_URL, HRMS_CALLBACK_SECRET
  GEMINI_API_KEY
  ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
  SIMLI_API_KEY, SIMLI_FACE_ID
  DEEPGRAM_API_KEY
"""

import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import aiohttp
from dotenv import load_dotenv

# ── Pipecat core ──────────────────────────────────────────────────────────────
from pipecat.audio.vad.webrtc import WebRTCVADAnalyzer
from pipecat.frames.frames import (
    EndFrame,
    Frame,
    LLMFullResponseEndFrame,
    TextFrame,
    TranscriptionFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import (
    OpenAILLMContext,
    OpenAILLMContextAggregator,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

# ── Pipecat services ──────────────────────────────────────────────────────────
from pipecat.services.google import GoogleLLMService
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.services.simli import SimliVideoService

# ── Pipecat transport ─────────────────────────────────────────────────────────
from pipecat.transports.services.daily import DailyParams, DailyTransport

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("howell-bot")


# ══════════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class BotConfig:
    # ── Daily ─────────────────────────────────────────────────────────────────
    room_url: str             = field(default_factory=lambda: os.environ["DAILY_ROOM_URL"])
    bot_token: str            = field(default_factory=lambda: os.environ["DAILY_BOT_TOKEN"])

    # ── Interview context ─────────────────────────────────────────────────────
    application_id: str       = field(default_factory=lambda: os.environ["APPLICATION_ID"])
    round_id: str             = field(default_factory=lambda: os.environ["ROUND_ID"])
    candidate_name: str       = field(default_factory=lambda: os.environ.get("CANDIDATE_NAME", "Candidate"))
    job_title: str            = field(default_factory=lambda: os.environ.get("JOB_TITLE", "the role"))
    company_name: str         = field(default_factory=lambda: os.environ.get("COMPANY_NAME", "our company"))
    questions: List[str]      = field(default_factory=lambda: json.loads(os.environ.get("INTERVIEW_QUESTIONS", "[]")))
    max_duration_seconds: int = field(default_factory=lambda: int(os.environ.get("MAX_DURATION_SECONDS", "2700")))

    # ── HRMS callback ─────────────────────────────────────────────────────────
    hrms_callback_url: str    = field(default_factory=lambda: os.environ["HRMS_CALLBACK_URL"])
    hrms_callback_secret: str = field(default_factory=lambda: os.environ["HRMS_CALLBACK_SECRET"])

    # ── AI services — Gemini FREE tier ───────────────────────────────────────
    gemini_api_key: str       = field(default_factory=lambda: os.environ["GEMINI_API_KEY"])
    elevenlabs_api_key: str   = field(default_factory=lambda: os.environ["ELEVENLABS_API_KEY"])
    elevenlabs_voice_id: str  = field(default_factory=lambda: os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"))
    simli_api_key: str        = field(default_factory=lambda: os.environ["SIMLI_API_KEY"])
    simli_face_id: str        = field(default_factory=lambda: os.environ.get("SIMLI_FACE_ID", "cace3ef7-a4c4-425d-a8cf-a5358eb0c427"))
    deepgram_api_key: str     = field(default_factory=lambda: os.environ["DEEPGRAM_API_KEY"])


# ══════════════════════════════════════════════════════════════════════════════
# Custom Frame Processors
# ══════════════════════════════════════════════════════════════════════════════

class TranscriptCollector(FrameProcessor):
    """
    Captures candidate utterances (from STT) and bot responses (from LLM)
    into a structured list.  Thread-safe — only one pipeline task runs at a time.
    """

    def __init__(self):
        super().__init__()
        self._transcript: List[Dict[str, Any]] = []
        self._buffer: List[str] = []
        self._utterance_start: Optional[float] = None

    @property
    def transcript(self) -> List[Dict[str, Any]]:
        return list(self._transcript)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, UserStartedSpeakingFrame):
            self._utterance_start = time.time()
            self._buffer = []

        elif isinstance(frame, TranscriptionFrame):
            if frame.text:
                self._buffer.append(frame.text.strip())

        elif isinstance(frame, UserStoppedSpeakingFrame) and self._buffer:
            text = " ".join(self._buffer).strip()
            if text:
                self._transcript.append({
                    "role": "candidate",
                    "text": text,
                    "timestamp": self._utterance_start or time.time(),
                })
            self._buffer = []
            self._utterance_start = None

        elif isinstance(frame, TextFrame) and direction == FrameDirection.DOWNSTREAM:
            # Capture bot speech text produced by the LLM
            if frame.text and frame.text.strip():
                self._transcript.append({
                    "role": "interviewer",
                    "text": frame.text.strip(),
                    "timestamp": time.time(),
                })

        await self.push_frame(frame, direction)


# ─────────────────────────────────────────────────────────────────────────────

class EndInterviewDetector(FrameProcessor):
    """
    Watches LLM output for the INTERVIEW_COMPLETE sentinel.

    When detected:
      1. Strips sentinel from frame so it is not spoken aloud.
      2. Asynchronously calls Claude to evaluate the transcript.
      3. POSTs the evaluation + transcript to the HRMS callback URL.
      4. Queues an EndFrame to cleanly shut down the pipeline.
    """

    SENTINEL = "INTERVIEW_COMPLETE"

    def __init__(self, config: BotConfig, collector: TranscriptCollector):
        super().__init__()
        self._config = config
        self._collector = collector
        self._triggered = False
        self._task_ref: Optional[PipelineTask] = None   # set after task creation

    def set_task(self, task: PipelineTask):
        self._task_ref = task

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if (
            isinstance(frame, TextFrame)
            and self.SENTINEL in frame.text
            and not self._triggered
        ):
            self._triggered = True
            clean = frame.text.replace(self.SENTINEL, "").strip()
            if clean:
                await self.push_frame(TextFrame(text=clean), direction)

            # Fire-and-forget so we don't block the pipeline
            asyncio.create_task(self._finalize())
            return  # Do NOT push the original frame

        await self.push_frame(frame, direction)

    # ── Finalize ──────────────────────────────────────────────────────────────

    async def _finalize(self):
        logger.info("[EndInterview] Sentinel received — evaluating transcript…")
        transcript = self._collector.transcript
        evaluation = await self._evaluate(transcript)
        await self._post_callback(transcript, evaluation)
        await asyncio.sleep(4)          # Let TTS finish the goodbye sentence
        if self._task_ref:
            await self._task_ref.queue_frame(EndFrame())

    # ── Evaluation via Claude 3.5 Sonnet (NOT Gemini) ─────────────────────────

    async def _evaluate(self, transcript: List[Dict]) -> Dict[str, Any]:
        logger.info("[Evaluate] Calling Claude 3.5 Sonnet for structured evaluation…")

        formatted_transcript = "\n".join(
            f"[{t['role'].upper()}]: {t['text']}" for t in transcript
        )
        questions_list = "\n".join(
            f"  Q{i+1}: {q}" for i, q in enumerate(self._config.questions)
        )

        evaluation_prompt = f"""You are an expert HR evaluator. Carefully review the following AI interview transcript and return a structured JSON evaluation.

POSITION: {self._config.job_title}
CANDIDATE: {self._config.candidate_name}
COMPANY: {self._config.company_name}

INTERVIEW QUESTIONS:
{questions_list}

FULL TRANSCRIPT:
{formatted_transcript}

Return ONLY a valid JSON object — no markdown fences, no commentary:
{{
  "overallScore": <integer 0-100>,
  "recommendation": "strong_hire" | "hire" | "maybe" | "no_hire",
  "summary": "<2-3 sentence overall assessment>",
  "communicationScore": <integer 0-10>,
  "technicalScore": <integer 0-10>,
  "culturalFitScore": <integer 0-10>,
  "strengths": ["<strength>", "…"],
  "areasForImprovement": ["<area>", "…"],
  "questionEvaluations": [
    {{
      "question": "<question text>",
      "candidateResponse": "<brief summary>",
      "score": <integer 0-10>,
      "notes": "<evaluator notes>"
    }}
  ]
}}"""

        try:
            async with aiohttp.ClientSession() as session:
                resp = await session.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self._config.gemini_api_key}",
                    json={
                        "contents": [{"parts": [{"text": evaluation_prompt}]}],
                        "generationConfig": {"maxOutputTokens": 2000, "temperature": 0.3},
                    },
                    headers={"content-type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=60),
                )
                data = await resp.json()
                raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()

                # Strip accidental markdown fences
                if raw.startswith("```"):
                    parts = raw.split("```")
                    raw = parts[1]
                    if raw.lower().startswith("json"):
                        raw = raw[4:]

                return json.loads(raw.strip())

        except Exception as exc:
            logger.error(f"[Evaluate] Error calling Claude: {exc}")
            return {
                "overallScore": 0,
                "recommendation": "maybe",
                "summary": "Evaluation could not be completed due to a technical error.",
                "communicationScore": 0,
                "technicalScore": 0,
                "culturalFitScore": 0,
                "strengths": [],
                "areasForImprovement": [],
                "questionEvaluations": [],
                "error": str(exc),
            }

    # ── HRMS Callback ─────────────────────────────────────────────────────────

    async def _post_callback(self, transcript: List[Dict], evaluation: Dict[str, Any]):
        payload = {
            "applicationId": self._config.application_id,
            "roundId": self._config.round_id,
            "candidateName": self._config.candidate_name,
            "jobTitle": self._config.job_title,
            "completedAt": time.time(),
            "transcript": transcript,
            "evaluation": evaluation,
        }

        try:
            async with aiohttp.ClientSession() as session:
                resp = await session.post(
                    self._config.hrms_callback_url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self._config.hrms_callback_secret}",
                        "Content-Type": "application/json",
                    },
                    timeout=aiohttp.ClientTimeout(total=30),
                )
                logger.info(f"[Callback] HRMS responded HTTP {resp.status}")
        except Exception as exc:
            logger.error(f"[Callback] POST failed: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
# System Prompt
# ══════════════════════════════════════════════════════════════════════════════

def build_system_prompt(cfg: BotConfig) -> str:
    questions_block = "\n".join(
        f"  Q{i+1}: {q}" for i, q in enumerate(cfg.questions)
    ) or "  (No specific questions — conduct a general competency interview)"

    return f"""You are Alex, a professional and warm AI interviewer representing {cfg.company_name}.

You are interviewing {cfg.candidate_name} for the position of **{cfg.job_title}**.

## Interview Questions (ask in order, one at a time)
{questions_block}

## Conduct Rules
1. Open with a warm welcome, introduce yourself as Alex, and briefly explain the format (AI interview, recorded, results shared with HR).
2. Ask questions ONE AT A TIME — never bundle two questions together.
3. After each answer, give a brief natural acknowledgement (1 sentence), then proceed to the next question.
4. If an answer is very short or unclear, ask exactly ONE follow-up before moving on.
5. Allow the candidate to finish speaking fully — do not interrupt.
6. Keep your own responses SHORT (2–4 sentences maximum) — this is a spoken conversation.
7. Do NOT use markdown, bullet points, numbered lists, or special characters in your speech.
8. Be encouraging, professional, and empathetic throughout.
9. After ALL questions are answered, thank {cfg.candidate_name} sincerely, explain that HR will be in touch by email with next steps, and say a warm goodbye.
10. CRITICAL — after your closing goodbye message, append exactly this token: INTERVIEW_COMPLETE

## Interruption Handling
If the candidate interrupts you or starts speaking while you are talking, stop speaking immediately and listen. This is a natural conversation.

## Time Constraint
The total interview must not exceed {cfg.max_duration_seconds // 60} minutes. If time is running short, gracefully consolidate remaining questions.

Begin now by greeting {cfg.candidate_name} and asking the first question."""


# ══════════════════════════════════════════════════════════════════════════════
# Pipeline
# ══════════════════════════════════════════════════════════════════════════════

async def run_bot(cfg: BotConfig):
    logger.info(f"[Bot] Starting for application={cfg.application_id} round={cfg.round_id}")
    logger.info(f"[Bot] Candidate: {cfg.candidate_name} | Role: {cfg.job_title}")
    logger.info(f"[Bot] Room: {cfg.room_url}")

    # ── Transport ──────────────────────────────────────────────────────────────
    transport = DailyTransport(
        cfg.room_url,
        cfg.bot_token,
        "Alex (AI Interviewer)",
        DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            camera_out_enabled=True,        # Simli publishes video via this track
            camera_out_width=1280,
            camera_out_height=720,
            vad_enabled=True,
            vad_analyzer=WebRTCVADAnalyzer(),
            vad_audio_passthrough=True,
            transcription_enabled=False,    # We use Deepgram ourselves
        ),
    )

    # ── STT — Deepgram nova-2 ─────────────────────────────────────────────────
    stt = DeepgramSTTService(
        api_key=cfg.deepgram_api_key,
        live_options={
            "language": "en-US",
            "model": "nova-2",
            "punctuate": True,
            "smart_format": True,
            "endpointing": 300,         # 300 ms silence = end of utterance
            "interim_results": True,
        },
    )

    # ── LLM — Gemini 1.5 Flash (FREE tier) ───────────────────────────────────
    llm = GoogleLLMService(
        api_key=cfg.gemini_api_key,
        model="gemini-1.5-flash",
        params=GoogleLLMService.InputParams(
            max_tokens=512,
            temperature=0.7,
        ),
    )

    # ── TTS — ElevenLabs turbo-v2.5 (low latency) ────────────────────────────
    tts = ElevenLabsTTSService(
        api_key=cfg.elevenlabs_api_key,
        voice_id=cfg.elevenlabs_voice_id,
        model="eleven_turbo_v2_5",
        output_format="pcm_16000",
    )

    # ── Avatar — Simli real-time lip-sync ─────────────────────────────────────
    simli = SimliVideoService(
        simli_api_key=cfg.simli_api_key,
        face_id=cfg.simli_face_id,
        sync_audio=True,
        handle_silence=True,
        max_session_length=cfg.max_duration_seconds,
        max_idle_time=300,
    )

    # ── Context (seeds Claude with the system prompt) ─────────────────────────
    context = OpenAILLMContext(
        messages=[],
        system=build_system_prompt(cfg),
    )
    context_aggregator = llm.create_context_aggregator(context)

    # ── Custom processors ─────────────────────────────────────────────────────
    collector = TranscriptCollector()
    detector  = EndInterviewDetector(cfg, collector)

    # ── Pipeline assembly ─────────────────────────────────────────────────────
    #
    #  Daily audio in
    #    → Deepgram STT
    #    → TranscriptCollector      (captures candidate speech)
    #    → LLM user aggregator      (builds message for Claude)
    #    → Claude 3.5 Sonnet        (generates response)
    #    → EndInterviewDetector     (watches for INTERVIEW_COMPLETE sentinel)
    #    → ElevenLabs TTS           (text → audio)
    #    → Simli                    (audio → lip-sync video)
    #    → Daily audio + video out
    #    → LLM assistant aggregator (closes the conversation turn)
    #
    pipeline = Pipeline([
        transport.input(),
        stt,
        collector,
        context_aggregator.user(),
        llm,
        detector,
        tts,
        simli,
        transport.output(),
        context_aggregator.assistant(),
    ])

    task = PipelineTask(
        pipeline,
        PipelineParams(
            allow_interruptions=True,       # Candidate barge-in handled naturally
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    # Wire the task reference into the detector so it can queue EndFrame
    detector.set_task(task)

    # ── Event handlers ────────────────────────────────────────────────────────

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        logger.info(f"[Transport] Candidate joined: {participant.get('user_name', participant.get('id'))}")
        # Trigger Claude to deliver its opening greeting
        await task.queue_frames([context_aggregator.user().get_context_frame()])

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        logger.info(f"[Transport] Participant left — reason: {reason}")
        # Save partial transcript if interview didn't complete normally
        if not detector._triggered:
            logger.info("[Transport] Candidate left early — saving partial transcript")
            asyncio.create_task(detector._finalize())

    # ── Run ───────────────────────────────────────────────────────────────────
    runner = PipelineRunner()
    await runner.run(task)
    logger.info("[Bot] Pipeline finished cleanly")


# ══════════════════════════════════════════════════════════════════════════════
# Entry Point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    try:
        cfg = BotConfig()
    except KeyError as exc:
        logger.error(f"[Config] Missing required environment variable: {exc}")
        sys.exit(1)

    asyncio.run(run_bot(cfg))
