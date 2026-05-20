#!/usr/bin/env python3
"""
Howell HR Interview Bot — HeyGen Avatar Edition
================================================
LiveKit WebRTC  : livekit Python client
STT             : Deepgram REST API (nova-2, en-IN)
LLM             : Google Gemini 1.5 Flash
TTS + Avatar    : HeyGen Streaming Avatar (frontend handles via @heygen/streaming-avatar SDK)

Architecture:
  candidate mic → LiveKit → bot STT (Deepgram) → Gemini → text via LiveKit data channel
  → candidate browser receives text → HeyGen avatar.speak() → lip-synced avatar video

The bot no longer publishes audio — it sends text over LiveKit's data channel.
HeyGen on the frontend converts text to speech + animation in perfect sync.
"""

import asyncio
import json
import logging
import os
import time

import aiohttp
import numpy as np
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
LIVEKIT_URL = os.environ["LIVEKIT_URL"]
BOT_TOKEN   = os.environ["LIVEKIT_BOT_TOKEN"]
DEEPGRAM_KEY = os.environ["DEEPGRAM_API_KEY"]
GEMINI_KEY   = os.environ["GEMINI_API_KEY"]
CANDIDATE    = os.environ.get("CANDIDATE_NAME", "Candidate")
JOB_TITLE    = os.environ.get("JOB_TITLE", "the role")
COMPANY      = os.environ.get("COMPANY_NAME", "our company")
QUESTIONS    = json.loads(os.environ.get("INTERVIEW_QUESTIONS", "[]"))
MAX_DURATION = int(os.environ.get("MAX_DURATION_SECONDS", "2700"))

SAMPLE_RATE  = 16000
CHANNELS     = 1
CHUNK_MS     = 20
CHUNK_SAMPLES = SAMPLE_RATE * CHUNK_MS // 1000   # 320 samples
CHUNK_BYTES   = CHUNK_SAMPLES * 2 * CHANNELS     # 640 bytes

# Browser Speech Synthesis pace (chars per second) — used to estimate speaking
# duration so the bot doesn't start listening while TTS is still playing.
# Browser TTS runs ~16 chars/sec. Capped at 15s max to avoid long listen blocks.
HEYGEN_CHARS_PER_SEC = 16.0
MAX_SPEAK_BLOCK_SECS = 15.0   # never block listening for more than this long

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
    """Call Gemini 1.5 Flash. Returns response text, or None on error."""
    system_text = ""
    chat_messages = []
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
        else:
            role = "user" if m["role"] == "user" else "model"
            chat_messages.append({"role": role, "parts": [{"text": m["content"]}]})

    # Gemini requires at least one message in contents.
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
                    return None
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        logger.error(f"[Gemini] Exception: {e}")
        return None


async def transcribe_pcm(pcm_bytes: bytes) -> str:
    """Transcribe raw 16kHz PCM-16 audio via Deepgram."""
    if len(pcm_bytes) < SAMPLE_RATE // 2:   # < 0.25s — skip
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

def calc_energy(pcm: bytes) -> float:
    """Mean absolute amplitude of a PCM-16 chunk."""
    total, count = 0, 0
    for i in range(0, len(pcm) - 1, 2):
        total += abs(int.from_bytes(pcm[i:i+2], "little", signed=True))
        count += 1
    return total / max(count, 1)


# ══════════════════════════════════════════════════════════════════════════════
# Main bot
# ══════════════════════════════════════════════════════════════════════════════

async def run_bot():
    logger.info("[Bot] Initialising…")
    room = rtc.Room()

    # ── State ─────────────────────────────────────────────────────────────────
    conversation: list = [{"role": "system", "content": build_system_prompt()}]
    bot_is_speaking     = asyncio.Lock()   # held while we wait for TTS to finish
    utterance_lock      = asyncio.Lock()   # prevents concurrent STT→LLM cycles
    greeting_sent       = False
    greeting_lock       = asyncio.Lock()   # prevents double-greeting race condition
    tts_done_event      = asyncio.Event()  # frontend signals when TTS has finished
    audio_buffer        = bytearray()
    pre_buffer          = bytearray()      # rolling 350ms pre-speech buffer
    last_voice_ts       = 0.0
    candidate_speaking  = False
    silence_watchdog_task = None

    # Adaptive VAD: calibrate first 2s of ambient noise, threshold = 4× ambient
    vad_threshold        = 1500
    calibration_energies: list = []
    vad_calibrated       = False

    PRE_BUFFER_BYTES = int(SAMPLE_RATE * 0.35) * 2   # 350ms × 2 bytes/sample

    # ── Send text to HeyGen via LiveKit data channel ───────────────────────────

    async def publish_speech(text: str):
        """Send response text to the frontend so HeyGen avatar can speak it."""
        payload = json.dumps({"text": text}).encode("utf-8")
        # Try multiple publish_data signatures — livekit SDK changed between versions
        published = False
        for attempt in [
            lambda: room.local_participant.publish_data(payload, topic="bot_speech"),
            lambda: room.local_participant.publish_data(payload, reliable=True),
            lambda: room.local_participant.publish_data(payload),
        ]:
            try:
                await attempt()
                logger.info(f"[Bot] Sent text ({len(text)} chars) via data channel")
                published = True
                break
            except Exception as e:
                logger.warning(f"[Bot] publish_data attempt failed: {e}")
        if not published:
            logger.error("[Bot] All publish_data attempts failed")

    async def _speak_raw(text: str):
        """Send text to frontend TTS and hold bot_is_speaking lock until done.
        Releases early if frontend sends a tts_done signal, otherwise falls back
        to a time estimate. Capped at MAX_SPEAK_BLOCK_SECS to avoid long blocks.
        """
        async with bot_is_speaking:
            logger.info(f"[Bot] Speaking: {text[:80]}…")
            tts_done_event.clear()
            await publish_speech(text)
            # Estimated duration — browser TTS at HEYGEN_CHARS_PER_SEC chars/sec
            duration = min(MAX_SPEAK_BLOCK_SECS, max(3.0, len(text) / HEYGEN_CHARS_PER_SEC) + 1.5)
            logger.info(f"[Bot] Blocking VAD for up to {duration:.1f}s (waiting for tts_done or timeout)")
            try:
                await asyncio.wait_for(tts_done_event.wait(), timeout=duration)
                logger.info("[Bot] tts_done signal received — releasing VAD early")
            except asyncio.TimeoutError:
                logger.info(f"[Bot] TTS timeout after {duration:.1f}s — releasing VAD")
        logger.info("[Bot] Speaking window ended — resuming candidate listening")

    async def run_silence_watchdog():
        """If candidate stays silent 6s after bot stops speaking, prompt them."""
        await asyncio.sleep(6.0)
        if not candidate_speaking and not bot_is_speaking.locked():
            logger.info("[Bot] Silence watchdog: prompting candidate")
            await _speak_raw("Take your time — whenever you are ready, please go ahead.")

    async def say(text: str):
        """Speak and reset the silence watchdog afterward."""
        nonlocal silence_watchdog_task
        if silence_watchdog_task and not silence_watchdog_task.done():
            silence_watchdog_task.cancel()
        await _speak_raw(text)
        silence_watchdog_task = asyncio.ensure_future(run_silence_watchdog())

    async def handle_utterance(pcm: bytes):
        """STT → Gemini → HeyGen TTS. Serialised to prevent concurrent LLM calls."""
        nonlocal silence_watchdog_task
        if utterance_lock.locked():
            logger.info("[Bot] Still processing — discarding overlap")
            return
        # Candidate spoke → cancel watchdog immediately
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
                # Gemini failed — speak recovery prompt but don't save to history
                logger.warning("[Bot] Gemini failed — speaking recovery")
                await say("I'm sorry, I had a brief connection issue. Could you please repeat your answer?")
                return
            logger.info(f"[Bot] Gemini: {response[:80]}…")
            conversation.append({"role": "assistant", "content": response})
            await say(response)

    async def greet():
        """Gemini generates the opening greeting so it's included in conversation history.
        Uses greeting_lock to prevent the race condition where participant_connected
        and the already-in-room check both fire before either sets greeting_sent.
        """
        nonlocal greeting_sent
        async with greeting_lock:
            if greeting_sent:
                return
            greeting_sent = True
        # Wait for the candidate's browser to initialise HeyGen avatar (~5s typical)
        await asyncio.sleep(5.0)
        logger.info("[Bot] Requesting greeting from Gemini…")
        response = await call_gemini(conversation)
        if response is None:
            response = (
                f"Hello {CANDIDATE}! I'm Meera, your AI interviewer from {COMPANY}. "
                f"Welcome to your interview for the {JOB_TITLE} position. Let's get started. "
                f"{QUESTIONS[0] if QUESTIONS else 'Could you please introduce yourself?'}"
            )
        logger.info(f"[Bot] Greeting: {response[:100]}…")
        conversation.append({"role": "assistant", "content": response})
        await say(response)

    # ── LiveKit event handlers ─────────────────────────────────────────────────

    @room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        """Receive signals from the candidate's browser (e.g. tts_done)."""
        try:
            msg = json.loads(data.data.decode("utf-8"))
            if msg.get("type") == "tts_done":
                logger.info("[Bot] Received tts_done from frontend — releasing speaking lock")
                tts_done_event.set()
        except Exception:
            pass

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
                samples_16k = samples_48k[::3]          # 48kHz → 16kHz downsample
                pcm16k = samples_16k.tobytes()

                # Ignore audio while HeyGen is speaking to prevent echo/self-response
                if bot_is_speaking.locked():
                    pre_buffer.clear()
                    continue

                energy = calc_energy(pcm16k)

                # ── Adaptive VAD calibration ───────────────────────────────────
                # First 100 frames (~2s) of ambient audio → set threshold = 4× ambient
                if not vad_calibrated and not candidate_speaking:
                    calibration_energies.append(energy)
                    if len(calibration_energies) >= 100:
                        ambient = sum(calibration_energies) / len(calibration_energies)
                        vad_threshold = max(600, min(2500, int(ambient * 4)))
                        logger.info(f"[VAD] Calibrated: threshold={vad_threshold} (ambient={ambient:.0f})")
                        vad_calibrated = True

                has_voice = energy > vad_threshold
                now = time.time()

                if has_voice:
                    if not candidate_speaking:
                        # Prepend rolling pre-buffer — captures the first syllable
                        audio_buffer.extend(pre_buffer)
                        pre_buffer.clear()
                    audio_buffer.extend(pcm16k)
                    last_voice_ts = now
                    candidate_speaking = True
                else:
                    # Maintain rolling 350ms pre-buffer of recent silent audio
                    pre_buffer.extend(pcm16k)
                    if len(pre_buffer) > PRE_BUFFER_BYTES:
                        pre_buffer = pre_buffer[-PRE_BUFFER_BYTES:]

                    if candidate_speaking and (now - last_voice_ts) > 2.0:
                        # 2.0s silence after speech → candidate finished
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

    # NOTE: Bot does NOT publish an audio track — speech is handled by HeyGen on the frontend.
    # Bot is visible as a participant in the room without needing to publish any track.
    logger.info("[Bot] Ready — waiting for candidate (no audio track; using HeyGen data channel)")

    # If candidate already in room when bot connects
    if room.remote_participants:
        asyncio.ensure_future(greet())
        for participant in room.remote_participants.values():
            logger.info(f"[Bot] Already-present participant: {participant.identity}")
            for pub in participant.track_publications.values():
                if pub.track and pub.track.kind == rtc.TrackKind.KIND_AUDIO:
                    on_track_subscribed(pub.track, pub, participant)

    # Keep alive for interview duration
    await asyncio.sleep(MAX_DURATION)
    logger.info("[Bot] Max duration reached, disconnecting")
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(run_bot())
