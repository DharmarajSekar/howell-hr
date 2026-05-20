#!/usr/bin/env python3
"""
Howell HR Interview Bot — Gemini Relay Edition
===============================================
Simplified architecture: bot handles ONLY LLM. Frontend handles STT/TTS/Avatar.

Flow:
  Frontend SpeechRecognition → transcript text via LiveKit data channel
  → bot receives → Gemini → response text via LiveKit data channel
  → frontend plays TTS → start listening → repeat

No VAD, no Deepgram, no audio processing, no timing locks.
"""

import asyncio
import json
import logging
import os

import aiohttp
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
LIVEKIT_URL  = os.environ["LIVEKIT_URL"]
BOT_TOKEN    = os.environ["LIVEKIT_BOT_TOKEN"]
GEMINI_KEY   = os.environ["GEMINI_API_KEY"]
CANDIDATE    = os.environ.get("CANDIDATE_NAME", "Candidate")
JOB_TITLE    = os.environ.get("JOB_TITLE", "the role")
COMPANY      = os.environ.get("COMPANY_NAME", "our company")
QUESTIONS    = json.loads(os.environ.get("INTERVIEW_QUESTIONS", "[]"))
MAX_DURATION = int(os.environ.get("MAX_DURATION_SECONDS", "2700"))

logger.info(f"[Config] Candidate={CANDIDATE} | Job={JOB_TITLE} | Questions={len(QUESTIONS)}")
logger.info(f"[Config] LiveKit URL={LIVEKIT_URL}")


# ── System prompt ─────────────────────────────────────────────────────────────

def build_system_prompt() -> str:
    q_block = "\n".join(f"Q{i+1}: {q}" for i, q in enumerate(QUESTIONS))
    if not q_block:
        q_block = "(Ask general competency questions relevant to the role)"
    return f"""You are Meera, a professional AI interviewer representing {COMPANY}.
You are interviewing {CANDIDATE} for the position of {JOB_TITLE}.

Interview questions to ask in order:
{q_block}

Rules:
1. Begin with a warm welcome and explain this is an AI-conducted interview.
2. Ask ONE question at a time and wait for the candidate's answer.
3. After each answer, give a brief 1-sentence acknowledgement, then ask the next question.
4. Keep ALL responses SHORT (2-3 sentences max) — this is spoken audio.
5. Never use markdown, bullet points, or numbered lists.
6. Be encouraging and professional throughout.
7. After all questions are answered, sincerely thank {CANDIDATE} and say HR will follow up.
8. Begin now with a warm greeting to {CANDIDATE} and ask the first question."""


# ── Gemini ────────────────────────────────────────────────────────────────────

async def call_gemini(messages: list) -> str | None:
    """Call Gemini 1.5 Flash. Returns response text, or None on error."""
    system_text = ""
    chat_messages = []
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
        else:
            role = "user" if m["role"] == "user" else "model"
            chat_messages.append({"role": role, "parts": [{"text": m["content"]}]})

    if not chat_messages:
        chat_messages = [{"role": "user", "parts": [{"text": "Please begin the interview now."}]}]

    # Gemini requires conversations to start with a "user" turn.
    # If the first message is "model" (e.g. greeting was added without a priming user turn),
    # insert a dummy user turn so the API doesn't reject the request.
    if chat_messages and chat_messages[0]["role"] == "model":
        chat_messages.insert(0, {"role": "user", "parts": [{"text": "Please begin the interview."}]})

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


# ── Main bot ──────────────────────────────────────────────────────────────────

async def run_bot():
    logger.info("[Bot] Initialising…")
    room = rtc.Room()

    conversation: list      = [{"role": "system", "content": build_system_prompt()}]
    greeting_sent           = False
    greeting_lock           = asyncio.Lock()
    processing_lock         = asyncio.Lock()   # prevent concurrent Gemini calls

    # ── Send text to frontend via LiveKit data channel ────────────────────────

    async def send_to_frontend(msg_type: str, text: str = ""):
        payload = json.dumps({"type": msg_type, "text": text}).encode("utf-8")
        for attempt in [
            lambda: room.local_participant.publish_data(payload, topic="bot"),
            lambda: room.local_participant.publish_data(payload, reliable=True),
            lambda: room.local_participant.publish_data(payload),
        ]:
            try:
                await attempt()
                if text:
                    logger.info(f"[Bot] Sent '{msg_type}': {text[:80]}…")
                else:
                    logger.info(f"[Bot] Sent '{msg_type}'")
                return
            except Exception as e:
                logger.warning(f"[Bot] publish_data attempt failed: {e}")
        logger.error("[Bot] All publish_data attempts failed")

    # ── Greeting ──────────────────────────────────────────────────────────────

    async def greet():
        nonlocal greeting_sent
        async with greeting_lock:
            if greeting_sent:
                return
            greeting_sent = True

        # Give frontend 3 seconds to fully connect and set up TTS
        await asyncio.sleep(3.0)
        logger.info("[Bot] Generating greeting via Gemini…")
        # Add priming user turn so Gemini conversation starts correctly (user → model → user → model…)
        conversation.append({"role": "user", "content": "Please begin the interview."})
        response = await call_gemini(conversation)
        if response is None:
            response = (
                f"Hello {CANDIDATE}! I'm Meera, your AI interviewer from {COMPANY}. "
                f"Welcome to your interview for the {JOB_TITLE} position. "
                f"Let's get started. "
                f"{QUESTIONS[0] if QUESTIONS else 'Could you please introduce yourself?'}"
            )
        conversation.append({"role": "assistant", "content": response})
        logger.info(f"[Bot] Greeting: {response[:100]}…")
        await send_to_frontend("bot_speech", response)

    # ── Handle candidate transcript ───────────────────────────────────────────

    async def handle_transcript(transcript: str):
        """Receive candidate transcript → Gemini → send response to frontend."""
        if processing_lock.locked():
            logger.info("[Bot] Still processing — ignoring overlap")
            return

        async with processing_lock:
            logger.info(f"[Bot] Transcript received: {transcript!r}")
            conversation.append({"role": "user", "content": transcript})

            # Tell frontend bot is thinking
            await send_to_frontend("bot_thinking")

            response = await call_gemini(conversation)
            if response is None:
                response = "I'm sorry, I had a brief connection issue. Could you please repeat your answer?"
                conversation.pop()   # remove failed user turn from history
            else:
                conversation.append({"role": "assistant", "content": response})

            logger.info(f"[Bot] Response: {response[:80]}…")
            await send_to_frontend("bot_speech", response)

    # ── LiveKit event handlers ────────────────────────────────────────────────

    @room.on("data_received")
    def on_data_received(packet: rtc.DataPacket):
        """Receive messages from the frontend."""
        try:
            msg = json.loads(packet.data.decode("utf-8"))
            msg_type = msg.get("type", "")

            if msg_type == "transcript":
                transcript = msg.get("text", "").strip()
                if transcript:
                    asyncio.ensure_future(handle_transcript(transcript))

            elif msg_type == "ready":
                # Frontend signals it's ready to receive the greeting
                logger.info("[Bot] Frontend ready — triggering greeting")
                asyncio.ensure_future(greet())

        except Exception as e:
            logger.warning(f"[Bot] data_received error: {e}")

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f"[Bot] Participant joined: {participant.identity}")
        # Greeting triggered by 'ready' signal from frontend.
        # Fallback: if no ready signal arrives within 5s, greet anyway.
        async def greet_fallback():
            await asyncio.sleep(5.0)
            await greet()
        asyncio.ensure_future(greet_fallback())

    # ── Connect ───────────────────────────────────────────────────────────────

    logger.info(f"[Bot] Connecting to LiveKit: {LIVEKIT_URL}")
    await room.connect(LIVEKIT_URL, BOT_TOKEN)
    logger.info(f"[Bot] Connected to room: {room.name}")

    # If candidate already in room when bot connects
    if room.remote_participants:
        logger.info("[Bot] Candidate already in room — scheduling greeting")
        async def greet_existing():
            await asyncio.sleep(4.0)
            await greet()
        asyncio.ensure_future(greet_existing())

    logger.info("[Bot] Ready — waiting for candidate transcript or ready signal")
    await asyncio.sleep(MAX_DURATION)
    logger.info("[Bot] Max duration reached — disconnecting")
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(run_bot())
