/**
 * HeyGen Streaming Avatar – server-side session management
 *
 * POST   → create session  (returns sdp offer + ice servers)
 * PATCH  → action: 'start'       → submit client SDP answer
 *          action: 'speak'       → send text to HeyGen TTS avatar
 *          action: 'speak_audio' → send ElevenLabs PCM for lip-sync
 * PUT    → send ICE candidate
 * DELETE → stop / close session
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const HG = 'https://api.heygen.com'

function hgHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': process.env.HEYGEN_API_KEY ?? '',
  }
}

async function hgPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${HG}${path}`, {
    method: 'POST',
    headers: hgHeaders(),
    body: JSON.stringify(body),
  })
  return res.json()
}

/* ── Create session ─────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      avatarName = process.env.HEYGEN_AVATAR_ID || 'Emery_public_1',
      quality    = 'low',
      voiceId,
    } = body

    const data = await hgPost('/v1/streaming.new', {
      quality,
      avatar_name: avatarName,
      ...(voiceId ? { voice: { voice_id: voiceId } } : {}),
    })

    if (data.code !== 100) {
      return NextResponse.json(
        { error: data.message ?? 'HeyGen session creation failed' },
        { status: 500 }
      )
    }

    const d = data.data
    return NextResponse.json({
      sessionId:   d.session_id,
      accessToken: d.access_token,
      iceServers:  d.ice_servers  ?? [],
      iceServers2: d.ice_servers2 ?? [],
      sdp:         d.sdp,                  // { type: 'offer', sdp: '...' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ── Start session (SDP answer) | Speak ────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  try {
    const { action, sessionId, sdp, text, inputAudio } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    if (action === 'start') {
      // Submit the client's SDP answer
      const data = await hgPost('/v1/streaming.start', {
        session_id: sessionId,
        sdp,
      })
      return NextResponse.json(data)
    }

    if (action === 'speak') {
      // HeyGen native TTS (perfect lip-sync)
      const data = await hgPost('/v1/streaming.task', {
        session_id: sessionId,
        text,
        task_type: 'talk',
      })
      return NextResponse.json(data)
    }

    if (action === 'speak_audio') {
      // ElevenLabs PCM audio → HeyGen lip-sync
      // inputAudio: base64-encoded PCM (16kHz, 16-bit, mono)
      const data = await hgPost('/v1/streaming.task', {
        session_id: sessionId,
        task_type:  'talk',
        input_audio: inputAudio,
      })
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ── Send ICE candidate ──────────────────────────────────────────────────── */
export async function PUT(req: NextRequest) {
  try {
    const { sessionId, candidate } = await req.json()
    if (!sessionId || !candidate) {
      return NextResponse.json({ error: 'sessionId and candidate required' }, { status: 400 })
    }
    const data = await hgPost('/v1/streaming.ice', {
      session_id: sessionId,
      candidate,
    })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ── Stop / close session ───────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    await hgPost('/v1/streaming.stop', { session_id: sessionId })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
