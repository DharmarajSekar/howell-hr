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
import io
import numpy as np
from gtts import gTTS
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
# ElevenLabs removed — bot uses edge-tts (free, no API key required)
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
    return f"""You are Meera, a professional AI interviewer representing {COMPANY}.
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

async def call_gemini(messages: list):
    """Call Gemini 1.5 Flash. Returns response text, or None on error.
    Returns None (not an error string) so callers can avoid polluting
    the conversation history with apology messages.
    """
    system_text = ""
    chat_messages = []
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
        else:
            role = "user" if m["role"] == "user" else "model"
            chat_messages.append({"role": role, "parts": [{"text": m["content"]}]})

    # Gemini requires at least one message in contents.
    # When greet() calls us, only the system prompt is in conversation → contents is empty.
    # Fix: inject a kickstart user turn so Gemini has valid input and begins the interview.
    if not chat_messages:
        chat_messages = [{"role": "user", "parts": [{"text": "Please begin the interview now."}]}]

    payload: dict = {
        "contents": chat_messages,
        "generationConfig": {"maxOutputTokens": 300, "temperature": 0.7},
    }
    if system_text:
        payload["system_instruction"] = {"parts": [{"text": system_text}]}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                data = await resp.json()
                if resp.status != 200:
                    logger.error(f"[Gemini] Error {resp.status}: {data}")
                    return None   # caller will handle gracefully
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        logger.error(f"[Gemini] Exception: {e}")
        return None


async def text_to_pcm(text: str) -> bytes:
    """Convert text to PCM-16 16kHz using gTTS (Google TTS, Indian English accent).
    gTTS outputs MP3; ffmpeg converts it to raw 16kHz mono PCM-16.
    Works from any cloud server IP — no API key required.
    """
    try:
        loop = asyncio.get_event_loop()

        def _generate_mp3() -> bytes:
            tts = gTTS(text=text, lang="en", tld="co.in", slow=False)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            return buf.getvalue()

        mp3_data = await loop.run_in_executor(None, _generate_mp3)

        # atempo=1.25 speeds gTTS (~105 WPM) to ~130 WPM — natural Indian professional pace
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-filter:a", "atempo=1.25",
            "-f", "s16le", "-ar", "16000", "-ac", "1",
            "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await proc.communicate(mp3_data)
        logger.info(f"[TTS] gTTS produced {len(stdout)} PCM bytes @ 1.25x speed")
        return stdout
    except Exception as e:
        logger.error(f"[TTS] gTTS error: {e}")
        return b""


async def transcribe_pcm(pcm_bytes: bytes) -> str:
    """Transcribe raw 16kHz PCM-16 audio via Deepgram."""
    if len(pcm_bytes) < SAMPLE_RATE // 2:   # < 0.25s — skip (aligned with capture minimum)
        return ""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.deepgram.com/v1/listen?model=nova-2&language=en-IN&punctuate=true",
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

def pcm_has_voice(pcm: bytes, threshold: int = 1500) -> bool:
    """Energy-based VAD. Threshold 1500 filters ambient noise (fans, AC, room hum)
    while reliably detecting normal speech (~2000-8000 average amplitude).
    The old threshold of 600 was too sensitive — ambient noise caused has_voice
    to stay True permanently, so silence was never detected and the bot never responded.
    """
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
    bot_track = rtc.LocalAudioTrack.create_audio_track("meera-voice", audio_source)

    # ── State ─────────────────────────────────────────────────────────────────
    conversation: list = [{"role": "system", "content": build_system_prompt()}]
    bot_is_speaking    = asyncio.Lock()   # held while TTS audio is playing
    utterance_lock     = asyncio.Lock()   # prevents concurrent STT→LLM→TTS cycles
    greeting_sent      = False
    audio_buffer       = bytearray()
    pre_buffer         = bytearray()      # rolling 350ms pre-speech buffer
    last_voice_ts      = 0.0
    candidate_speaking = False
    silence_watchdog_task = None          # fires if candidate stays silent after bot speaks

    # Fix 4 — adaptive VAD: calibrate against first 2s of ambient noise
    vad_threshold       = 1500            # default; overwritten after calibration
    calibration_energies: list = []
    vad_calibrated      = False

    PRE_BUFFER_BYTES = int(SAMPLE_RATE * 0.35) * 2   # 350ms × 2 bytes/sample

    # ── Helpers ────────────────────────────────────────────────────────────────

    def calc_energy(pcm: bytes) -> float:
        """Mean absolute amplitude of a PCM-16 chunk."""
        total, count = 0, 0
        for i in range(0, len(pcm) - 1, 2):
            total += abs(int.from_bytes(pcm[i:i+2], "little", signed=True))
            count += 1
        return total / max(count, 1)

    async def _speak_raw(text: str):
        """TTS → LiveKit without touching the silence watchdog."""
        async with bot_is_speaking:
            logger.info(f"[Bot] Speaking: {text[:80]}…")
            pcm = await text_to_pcm(text)
            if pcm:
                await push_audio(audio_source, pcm)
            logger.info("[Bot] Done speaking")

    async def run_silence_watchdog():
        """Fix 2 — if candidate is silent 5s after bot stops speaking, prompt them."""
        await asyncio.sleep(5.0)
        if not candidate_speaking and not bot_is_speaking.locked():
            logger.info("[Bot] Silence watchdog: candidate silent 5s — prompting")
            await _speak_raw("Take your time — whenever you are ready, please go ahead.")

    async def say(text: str):
        """Speak and start/reset the 5-second silence watchdog afterward."""
        nonlocal silence_watchdog_task
        # Cancel any running watchdog before speaking
        if silence_watchdog_task and not silence_watchdog_task.done():
            silence_watchdog_task.cancel()
        await _speak_raw(text)
        # Start fresh 5-second watchdog after bot finishes
        silence_watchdog_task = asyncio.ensure_future(run_silence_watchdog())

    async def handle_utterance(pcm: bytes):
        """STT → Gemini → TTS. Serialised so Gemini is never called concurrently."""
        nonlocal silence_watchdog_task
        if utterance_lock.locked():
            logger.info("[Bot] Still processing — discarding overlap")
            return
        # Candidate spoke — cancel watchdog immediately
        if silence_watchdog_task and not silence_watchdog_task.done():
            silence_watchdog_task.cancel()
        async with utterance_lock:
            transcript = await transcribe_pcm(pcm)
            logger.info(f"[Bot] Transcript: {transcript!r}")
            if not transcript:
                return
            conversation.append({"role": "user", "content": transcript})
            response = await call_gemini(conversation)
            if response is None:
                # Gemini failed — speak a recovery prompt but DO NOT save to history
                # so the conversation stays clean for the next attempt
                logger.warning("[Bot] Gemini failed — speaking recovery without saving to history")
                await say("I'm sorry, I had a brief connection issue. Could you please repeat your answer?")
                return
            logger.info(f"[Bot] Gemini: {response[:80]}…")
            conversation.append({"role": "assistant", "content": response})
            await say(response)

    async def greet():
        """Gemini generates the opening greeting + Q1.
        Must NOT be hardcoded — if we hardcode Q1, Gemini sees it as already asked
        and gets confused about which question to ask next (re-asks Q1 instead of Q2).
        """
        nonlocal greeting_sent
        if greeting_sent:
            return
        greeting_sent = True
        await asyncio.sleep(2.0)  # let candidate's browser subscribe to bot audio track
        logger.info("[Bot] Requesting greeting from Gemini…")
        response = await call_gemini(conversation)
        if response is None:
            # Fallback greeting if Gemini is unavailable at startup
            response = (f"Hello {CANDIDATE}! I'm Meera, your AI interviewer from {COMPANY}. "
                        f"Welcome to your interview for the {JOB_TITLE} position. "
                        f"Let's begin. {QUESTIONS[0] if QUESTIONS else 'Could you introduce yourself?'}")
        logger.info(f"[Bot] Greeting: {response[:100]}…")
        conversation.append({"role": "assistant", "content": response})
        await say(response)

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
            nonlocal audio_buffer, pre_buffer, last_voice_ts, candidate_speaking
            nonlocal vad_threshold, calibration_energies, vad_calibrated

            audio_stream = rtc.AudioStream(track)
            async for frame_event in audio_stream:
                frame = frame_event.frame

                try:
                    raw_bytes = bytes(frame.data)
                except TypeError:
                    raw_bytes = memoryview(frame.data).cast('B').tobytes()
                samples_48k = np.frombuffer(raw_bytes, dtype=np.int16)
                samples_16k = samples_48k[::3]          # 48kHz → 16kHz
                pcm16k = samples_16k.tobytes()

                if bot_is_speaking.locked():
                    pre_buffer.clear()
                    continue

                energy = calc_energy(pcm16k)

                # ── Fix 4: Adaptive VAD calibration ───────────────────────────
                # Collect the first 100 frames (~2s) of ambient audio to set a
                # noise floor, then set threshold = 4× ambient (capped 600–2500).
                # This auto-adjusts for quiet mics, noisy rooms, etc.
                if not vad_calibrated and not candidate_speaking:
                    calibration_energies.append(energy)
                    if len(calibration_energies) >= 100:
                        ambient = sum(calibration_energies) / len(calibration_energies)
                        vad_threshold = max(600, min(2500, int(ambient * 4)))
                        logger.info(f"[VAD] Calibrated: threshold={vad_threshold} (ambient avg={ambient:.0f})")
                        vad_calibrated = True

                has_voice = energy > vad_threshold
                now = time.time()

                if has_voice:
                    if not candidate_speaking:
                        # Prepend rolling pre-buffer so first syllables are never missed
                        audio_buffer.extend(pre_buffer)
                        pre_buffer.clear()
                    audio_buffer.extend(pcm16k)
                    last_voice_ts = now
                    candidate_speaking = True
                else:
                    # Keep rolling 350ms pre-buffer of recent silent audio
                    pre_buffer.extend(pcm16k)
                    if len(pre_buffer) > PRE_BUFFER_BYTES:
                        pre_buffer = pre_buffer[-PRE_BUFFER_BYTES:]

                    if candidate_speaking and (now - last_voice_ts) > 0.8:
                        # 0.8s silence after speech → candidate finished
                        candidate_speaking = False
                        min_bytes = int(SAMPLE_RATE * 0.25) * 2   # 0.25s minimum
                        if len(audio_buffer) > min_bytes:
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
