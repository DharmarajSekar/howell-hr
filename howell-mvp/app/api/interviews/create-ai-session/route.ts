/**
 * POST /api/interviews/create-ai-session
 *
 * Creates a LiveKit room, mints tokens for both the candidate and the
 * Pipecat bot, starts the bot via the bot server, saves the session to
 * Supabase, and returns a shareable candidate link.
 *
 * LiveKit is open-source WebRTC — free cloud tier (50 GB/month), no credit card.
 * Sign up at: https://cloud.livekit.io
 *
 * Called by: AI Room page (HR initiates session for a specific application)
 */

import { NextRequest, NextResponse } from 'next/server'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { createClient } from '@/lib/supabase/server'

const LIVEKIT_URL        = process.env.LIVEKIT_URL!          // wss://your-app.livekit.cloud
const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY!
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!
const BOT_SERVER_URL     = process.env.BOT_SERVER_URL!       // e.g. https://your-bot.railway.app
const BOT_SERVER_SECRET  = process.env.BOT_SERVER_SECRET!

// ── LiveKit helpers ───────────────────────────────────────────────────────────

async function createLiveKitRoom(roomName: string, durationMinutes: number) {
  const svc = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  await svc.createRoom({
    name: roomName,
    emptyTimeout: 300,                        // delete room 5 min after last participant leaves
    maxParticipants: 10,
    metadata: JSON.stringify({ source: 'howell-hr' }),
  })
  return roomName
}

function mintToken(roomName: string, identity: string, name: string, ttlSeconds = 7200): Promise<string> {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: ttlSeconds,
  })
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })
  return at.toJwt()
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      applicationId,
      roundId,
      candidateName,
      jobTitle,
      questions,
      durationMinutes = 60,
    } = body as {
      applicationId: string
      roundId: string
      candidateName: string
      jobTitle: string
      questions: string[]
      durationMinutes?: number
    }

    if (!applicationId || !roundId || !candidateName || !jobTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Create LiveKit room ───────────────────────────────────────────────────
    const roomName = `howell-interview-${applicationId}-${Date.now()}`
    await createLiveKitRoom(roomName, durationMinutes + 30)

    // 2. Mint tokens ───────────────────────────────────────────────────────────
    const [botToken, candidateToken] = await Promise.all([
      mintToken(roomName, `bot-${applicationId}`,       'Alex (AI Interviewer)', (durationMinutes + 30) * 60),
      mintToken(roomName, `candidate-${applicationId}`, candidateName,           (durationMinutes + 30) * 60),
    ])

    // 3. Build callback URL ────────────────────────────────────────────────────
    const baseUrl     = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const callbackUrl = `${baseUrl}/api/interviews/interview-callback`

    // 4. Start Pipecat bot ─────────────────────────────────────────────────────
    const botPayload = {
      // LiveKit — replaces Daily.co fields
      LIVEKIT_URL:           LIVEKIT_URL,
      LIVEKIT_ROOM_NAME:     roomName,
      LIVEKIT_BOT_TOKEN:     botToken,
      // Interview metadata
      APPLICATION_ID:        applicationId,
      ROUND_ID:              roundId,
      CANDIDATE_NAME:        candidateName,
      JOB_TITLE:             jobTitle,
      COMPANY_NAME:          process.env.COMPANY_NAME || 'Howell HR',
      INTERVIEW_QUESTIONS:   JSON.stringify(questions || []),
      MAX_DURATION_SECONDS:  String(durationMinutes * 60),
      HRMS_CALLBACK_URL:     callbackUrl,
      HRMS_CALLBACK_SECRET:  process.env.INTERVIEW_CALLBACK_SECRET!,
      // AI service keys — forwarded from Next.js env to bot
      GEMINI_API_KEY:        process.env.GEMINI_API_KEY!,
      DEEPGRAM_API_KEY:      process.env.DEEPGRAM_API_KEY!,
      // Legacy fields — kept with empty defaults so server.py Pydantic model doesn't error
      ELEVENLABS_API_KEY:    process.env.ELEVENLABS_API_KEY || '',
      ELEVENLABS_VOICE_ID:   process.env.ELEVENLABS_VOICE_ID || '',
      SIMLI_API_KEY:         '',   // No longer used — switched to HeyGen
      SIMLI_FACE_ID:         '',   // No longer used
    }

    const botRes = await fetch(`${BOT_SERVER_URL}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_SERVER_SECRET ?? '',
      },
      body: JSON.stringify(botPayload),
    })

    if (!botRes.ok) {
      const err = await botRes.text()
      throw new Error(`Bot server error ${botRes.status}: ${err}`)
    }

    // 5. Persist session to Supabase ───────────────────────────────────────────
    const supabase = createClient()
    await supabase.from('interview_sessions').upsert({
      application_id:  applicationId,
      round_id:        roundId,
      daily_room_name: roomName,          // column reused for livekit room name
      daily_room_url:  LIVEKIT_URL,       // column reused for livekit server url
      status:          'pending',
      type:            'ai_pipecat',
      created_at:      new Date().toISOString(),
    }, { onConflict: 'application_id,round_id' })

    // 6. Build shareable candidate link ────────────────────────────────────────
    // lkUrl is the LiveKit WebSocket URL — needed by the candidate's browser client
    const candidateLink =
      `${baseUrl}/candidate-interview` +
      `?room=${encodeURIComponent(roomName)}` +
      `&token=${encodeURIComponent(candidateToken)}` +
      `&name=${encodeURIComponent(candidateName)}` +
      `&applicationId=${encodeURIComponent(applicationId)}` +
      `&roundId=${encodeURIComponent(roundId)}` +
      `&lkUrl=${encodeURIComponent(LIVEKIT_URL)}`

    return NextResponse.json({
      success:       true,
      candidateLink,
      roomName,
      livekitUrl:    LIVEKIT_URL,
    })

  } catch (error: any) {
    console.error('[create-ai-session]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
