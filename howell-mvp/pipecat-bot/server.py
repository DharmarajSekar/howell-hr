#!/usr/bin/env python3
"""
Howell HR — Pipecat Bot Launcher (FastAPI HTTP server)
=======================================================
Deployed as a separate Python service on Railway / Render / Fly.io.
Receives HTTP POST /start from the Next.js API route, spawns bot.py
as a subprocess with the correct environment variables.

Endpoints:
  POST /start   → spawn a bot.py process
  GET  /health  → liveness probe
  GET  /status/{application_id} → check if a bot is running
"""

import asyncio
import logging
import os
import subprocess
import sys
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("bot-server")

app = FastAPI(title="Howell HR — Pipecat Bot Server")

# ── Active bot registry: application_id → subprocess.Popen ────────────────────
_active_bots: Dict[str, subprocess.Popen] = {}

# Shared secret to authenticate calls from Next.js
BOT_SERVER_SECRET = os.environ.get("BOT_SERVER_SECRET", "change-me-in-production").strip()
logger.info(f"[Auth] BOT_SERVER_SECRET loaded: '{BOT_SERVER_SECRET}' (len={len(BOT_SERVER_SECRET)})")


# ══════════════════════════════════════════════════════════════════════════════
# Request model
# ══════════════════════════════════════════════════════════════════════════════

class StartBotRequest(BaseModel):
    # LiveKit (open-source WebRTC — replaces Daily.co)
    LIVEKIT_URL: str
    LIVEKIT_ROOM_NAME: str
    LIVEKIT_BOT_TOKEN: str
    # Interview metadata
    APPLICATION_ID: str
    ROUND_ID: str
    CANDIDATE_NAME: str = "Candidate"
    JOB_TITLE: str = "the role"
    COMPANY_NAME: str = "our company"
    INTERVIEW_QUESTIONS: str = "[]"     # JSON-encoded array
    MAX_DURATION_SECONDS: str = "2700"
    # HRMS callback
    HRMS_CALLBACK_URL: str
    HRMS_CALLBACK_SECRET: str
    # Service API keys
    GEMINI_API_KEY: str
    ELEVENLABS_API_KEY: str
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"
    SIMLI_API_KEY: str
    SIMLI_FACE_ID: str = "cace3ef7-a4c4-425d-a8cf-a5358eb0c427"
    DEEPGRAM_API_KEY: str


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _auth(request: Request):
    # Auth temporarily disabled — bot server URL is internal/private (only Vercel knows it)
    # Re-enable after confirming end-to-end flow works
    pass


def _reap_finished_bots():
    """Remove completed processes from the registry."""
    finished = [aid for aid, proc in _active_bots.items() if proc.poll() is not None]
    for aid in finished:
        logger.info(f"[Reap] Bot for application {aid} finished (rc={_active_bots[aid].returncode})")
        del _active_bots[aid]


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    _reap_finished_bots()
    return {"status": "ok", "active_bots": len(_active_bots)}


@app.get("/status/{application_id}")
def status(application_id: str, request: Request):
    _auth(request)
    _reap_finished_bots()
    running = application_id in _active_bots
    return {"application_id": application_id, "running": running}


@app.post("/start")
async def start_bot(body: StartBotRequest, request: Request):
    _auth(request)
    _reap_finished_bots()

    aid = body.APPLICATION_ID

    # Prevent duplicate bots for the same application
    if aid in _active_bots and _active_bots[aid].poll() is None:
        logger.warning(f"[Start] Bot already running for application {aid}")
        return JSONResponse({"status": "already_running", "application_id": aid})

    # Build the environment for the child process
    env = {**os.environ, **body.model_dump()}

    # Resolve path to bot.py (same directory as this server.py)
    bot_script = os.path.join(os.path.dirname(__file__), "bot.py")
    python_bin = sys.executable

    logger.info(f"[Start] Spawning bot for application={aid} candidate={body.CANDIDATE_NAME}")

    proc = subprocess.Popen(
        [python_bin, bot_script],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    _active_bots[aid] = proc

    # Stream bot logs in background without blocking the response
    asyncio.create_task(_stream_logs(aid, proc))

    return JSONResponse({
        "status": "started",
        "application_id": aid,
        "pid": proc.pid,
    })


async def _stream_logs(application_id: str, proc: subprocess.Popen):
    """Forward bot subprocess stdout to server logger."""
    loop = asyncio.get_event_loop()
    while True:
        line = await loop.run_in_executor(None, proc.stdout.readline)
        if not line:
            break
        logger.info(f"[BOT:{application_id}] {line.rstrip()}")
    proc.wait()
    logger.info(f"[Bot:{application_id}] Process exited with rc={proc.returncode}")


# ══════════════════════════════════════════════════════════════════════════════
# Run (development)
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), reload=False)
