#!/usr/bin/env python3
"""
Howell HR Interview Bot — Direct Implementation (no pipecat)
=============================================================
LiveKit WebRTC  : livekit Python client (no pipecat version issues)
STT             : Deepgram REST API
LLM             : Google Gemini 1.5 Flash
TTS             : ElevenLabs turbo-v2.5  (PCM 16kHz output)
"""

import asyncio
import json
import logging
import os
import time

import aiohttp
import numpy as np
import edge_tts
from dotenv import load_dotenv

try:
    from livekit import rtc
except ImportError as e:
    print(f"FATAL: livekit import failed: {e}", flush=True)
    raise

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("howell-bot")

# ── Config ────────────────────────────────────────────────────────────────────
LIVEKIT_URL    = os.environ["LIVEKIT_URL"]
BOT_TOKEN      = os.environ["LIVEKIT_BOT_TOKEN"]
DEEPGRAM_KEY   = os.environ["DEEPGRAM_API_KEY"]
GEMINI_KEY     = os.environ["GEMINI_API_KEY"]
EL_KEY         = os.environ["ELEVENLABS_API_KEY"]
VOICE_ID       = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
CANDIDATE      = os.environ.get("CANDIDATE_NAME", "Candidate")
JOB_TITLE      = os.environ.get("JOB_TITLE", "the role")
COMPANY        = os.environ.get("COMPANY_NAME", "our company")
QUESTIONS      = json.loads(os.environ.get("INTERVIEW_QUESTIONS", "[]"))
MAX_DURATION   = int(os.environ.get("MAX_DURATION_SECONDS", "2700"))

SAMPLE_RATE    = 16000
CHANNELS       = 1
CHUNK_MS       = 20   # 20ms audio chunks
CHUNK_SAMPLES  = SAMPLE_RATE * CHUNK_MS // 1000   # 320 samples
CHUNK_BYTES    = CHUNK_SAMPLES * 2 * CHANNELS     # 2 bytes/sample

logger.info(f"[Config] Candidate={CANDIDATE} | Job={JOB_TITLE} | Questions={len(QUESTIONS)}")
logger.info(f"[Config] LiveKit URL={LIVEKIT_URL}")


# ══════════════════════════════════════════════════════════════════════════════
# System prompt
# ══════════════════════════════════════════════════════════════════════════════

def build_system_prompt() -> str:
    q_block = "\n".join(f"Q{i+1}: {q}" for i, q in enumerate(QUESTIONS))
    if not q_block:
        q_block = "(Ask general competency questions)"
    return f"""You are Alex, a professional AI interviewer representing {COMPANY}.
You are interviewing {CANDIDATE} for the position of {JOB_TITLE}.

Interview questions to ask in order:
{q_block}

Rules:
1. Begin with a warm welcome and explain this is an AI-conducted interview.
2. Ask ONE question at a time — wait for the candidate's answer.
3. After each answer, give a brief 1-sentence acknowledgement, then ask the next question.
4. Keep ALL your responses SHORT (2-3 sentences max) — this is spoken audio.
5. Never use markdown, bullet points, or numbered lists in your responses.
6. Be encouraging and professional throughout.
7. After all questions are answered, sincerely thank {CANDIDATE} and say HR will follow up.
8. Begin now with a warm greeting to {CANDIDATE} and ask the first question."""


# ══════════════════════════════════════════════════════════════════════════════
# AI Service calls
# ══════════════════════════════════════════════════════════════════════════════

async def call_gemini(messages: list) -> str:
    """Call Gemini 1.5 Flash and return response text."""
    system_text = ""
    chat_messages = []
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
        else:
            role = "user" if m["role"] == "user" else "model"
            chat_messages.append({"role": role, "parts": [{"text": m["content"]}]})

    payload: dict = {
        "contents": chat_messages,
        "generationConfig": {"maxOutputTokens": 300, "temperature": 0.7},
    }
    if system_text:
        payload["system_instruction"] = {"parts": [{"text": system_text}]}

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=20),
        ) as resp:
            data = await resp.json()
            if resp.status != 200:
                logger.error(f"[Gemini] Error {resp.status}: {data}")
                return "I apologize, I had a technical issue. Could you repeat that?"
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()


async def text_to_pcm(text: str) -> bytes:
    """Convert text to PCM-16 16kHz using edge-tts (free, no API key, works from any server IP).
    edge-tts outputs MP3; ffmpeg converts to raw PCM 16kHz mono.
    """
    try:
        communicate = edge_tts.Communicate(text, voice="en-US-AriaNeural")

        # Collect MP3 chunks from the streaming response
        mp3_chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                mp3_chunks.append(chunk["data"])

        mp3_data = b"".join(mp3_chunks)
        if not mp3_data:
            logger.warning("[TTS] edge-tts returned empty audio")
            return b""

        # Convert MP3 → PCM s16le 16kHz mono via ffmpeg
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-f", "s16le", "-ar", "16000", "-ac", "1",
            "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await proc.communicate(mp3_data)
        logger.info(f"[TTS] edge-tts produced {len(stdout)} PCM bytes")
        return stdout

    except Exception as e:
        logger.error(f"[TTS] edge-tts error: {e}")
        return b""


async def transcribe_pcm(pcm_bytes: bytes) -> str:
    """Transcribe raw 16kHz PCM-16 audio via Deepgram."""
    if len(pcm_bytes) < SAMPLE_RATE:   # < 0.5s — skip
        return ""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.deepgram.com/v1/listen?model=nova-2&language=en-US&punctuate=true",
            headers={
                "Authorization": f"Token {DEEPGRAM_KEY}",
                "Content-Type": "audio/raw;encoding=linear16;sample_rate=16000;channels=1",
            },
            data=pcm_bytes,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            data = await resp.json()
            try:
                return data["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
            except (KeyError, IndexError):
                return ""


# ══════════════════════════════════════════════════════════════════════════════
# Audio helpers
# ══════════════════════════════════════════════════════════════════════════════

def pcm_has_voice(pcm: bytes, threshold: int = 600) -> bool:
    """Simple energy-based voice activity detection."""
    total = 0
    count = 0
    for i in range(0, len(pcm) - 1, 2):
        sample = int.from_bytes(pcm[i:i+2], "little", signed=True)
        total += abs(sample)
        count += 1
    return (total // max(count, 1)) > threshold


async def push_audio(source: rtc.AudioSource, pcm_bytes: bytes):
    """Push PCM bytes to LiveKit in 20ms chunks."""
    if not pcm_bytes:
        return
    for i in range(0, len(pcm_bytes), CHUNK_BYTES):
        chunk = pcm_bytes[i : i + CHUNK_BYTES]
        # Pad last chunk if needed
        if len(chunk) < CHUNK_BYTES:
            chunk = chunk + b"\x00" * (CHUNK_BYTES - len(chunk))
        frame = rtc.AudioFrame(
            data=chunk,
            sample_rate=SAMPLE_RATE,
            num_channels=CHANNELS,
            samples_per_channel=CHUNK_SAMPLES,
        )
        await source.capture_frame(frame)
        await asyncio.sleep(CHUNK_MS / 1000 * 0.9)  # slight under-pace for smooth delivery


# ══════════════════════════════════════════════════════════════════════════════
# Main bot
# ══════════════════════════════════════════════════════════════════════════════

async def run_bot():
    logger.info("[Bot] Initialising…")
    room = rtc.Room()

    # Audio source for bot speech output
    audio_source = rtc.AudioSource(sample_rate=SAMPLE_RATE, num_channels=CHANNELS)
    bot_track = rtc.LocalAudioTrack.create_audio_track("alex-voice", audio_source)

    # State
    conversation: list = [{"role": "system", "content": build_system_prompt()}]
    bot_is_speaking = asyncio.Lock()
    audio_buffer   = bytearray()
    last_voice_ts  = 0.0
    candidate_speaking = False

    async def say(text: str):
        """Generate TTS and push to LiveKit."""
        async with bot_is_speaking:
            logger.info(f"[Bot] Speaking: {text[:80]}…")
            pcm = await text_to_pcm(text)
            if pcm:
                await push_audio(audio_source, pcm)
            logger.info("[Bot] Done speaking")

    async def handle_utterance(pcm: bytes):
        """Process captured candidate speech: STT → LLM → TTS."""
        transcript = await transcribe_pcm(pcm)
        logger.info(f"[Bot] Transcript: {transcript!r}")
        if not transcript:
            return
        conversation.append({"role": "user", "content": transcript})
        response = await call_gemini(conversation)
        logger.info(f"[Bot] Gemini response: {response[:80]}…")
        conversation.append({"role": "assistant", "content": response})
        await say(response)

    async def greet():
        await asyncio.sleep(1.5)  # Let candidate settle
        greeting = (
            f"Hello {CANDIDATE}! I'm Alex, your AI interviewer from {COMPANY}. "
            f"Welcome to your interview for the {JOB_TITLE} position. "
            f"This is an AI-conducted interview — your responses will be reviewed by HR. "
            f"Let's begin. {QUESTIONS[0] if QUESTIONS else 'Could you start by introducing yourself?'}"
        )
        conversation.append({"role": "assistant", "content": greeting})
        await say(greeting)

    # ── LiveKit event handlers ─────────────────────────────────────────────────

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f"[Bot] Participant joined: {participant.identity}")
        asyncio.ensure_future(greet())

    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        logger.info(f"[Bot] Subscribed to audio track from {participant.identity}")

        async def read_audio():
            nonlocal audio_buffer, last_voice_ts, candidate_speaking
            audio_stream = rtc.AudioStream(track)
            async for frame_event in audio_stream:
                frame = frame_event.frame

                # Safely convert frame data to numpy int16 array regardless of SDK version.
                # Some livekit-rtc versions return frame.data as a ctypes array which
                # bytes() misinterprets — np.frombuffer handles all buffer-protocol types.
                try:
                    raw_bytes = bytes(frame.data)
                except TypeError:
                    raw_bytes = memoryview(frame.data).cast('B').tobytes()
                samples_48k = np.frombuffer(raw_bytes, dtype=np.int16)

                # Downsample 48kHz → 16kHz by taking every 3rd sample (mono)
                samples_16k = samples_48k[::3]
                pcm16k = samples_16k.tobytes()

                if bot_is_speaking.locked():
                    continue  # Don't capture while bot is speaking

                has_voice = pcm_has_voice(pcm16k)
                now = time.time()

                if has_voice:
                    audio_buffer.extend(pcm16k)
                    last_voice_ts = now
                    candidate_speaking = True
                elif candidate_speaking and (now - last_voice_ts) > 1.2:
                    # Silence for 1.2s after speech → candidate finished
                    candidate_speaking = False
                    if len(audio_buffer) > SAMPLE_RATE:  # at least 0.5s of audio
                        captured = bytes(audio_buffer)
                        audio_buffer.clear()
                        asyncio.ensure_future(handle_utterance(captured))

        asyncio.ensure_future(read_audio())

    # ── Connect to LiveKit ─────────────────────────────────────────────────────
    logger.info(f"[Bot] Connecting to LiveKit: {LIVEKIT_URL}")
    await room.connect(LIVEKIT_URL, BOT_TOKEN)
    logger.info(f"[Bot] Connected to room: {room.name}")

    # Publish audio track
    options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    await room.local_participant.publish_track(bot_track, options)
    logger.info("[Bot] Audio track published — bot is visible in room")

    # If candidate already in room when bot connects, greet AND subscribe to their tracks
    if room.remote_participants:
        asyncio.ensure_future(greet())
        for participant in room.remote_participants.values():
            logger.info(f"[Bot] Already-present participant: {participant.identity}")
            for pub in participant.track_publications.values():
                if pub.track and pub.track.kind == rtc.TrackKind.KIND_AUDIO:
                    logger.info(f"[Bot] Subscribing to existing audio track from {participant.identity}")
                    on_track_subscribed(pub.track, pub, participant)

    # Keep alive for interview duration
    await asyncio.sleep(MAX_DURATION)
    logger.info("[Bot] Max duration reached, disconnecting")
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(run_bot())
