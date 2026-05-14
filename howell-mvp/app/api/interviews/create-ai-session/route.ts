/**
 * POST /api/interviews/create-ai-session
 *
 * Creates a Daily.co room, mints tokens for both the candidate and the
 * Pipecat bot, starts the bot via the bot server, saves the session to
 * Supabase, and returns a shareable candidate link.
 *
 * Called by: AI Room page (HR initiates session for a specific application)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DAILY_API_KEY  = process.env.DAILY_API_KEY!
const DAILY_API_BASE = 'https://api.daily.co/v1'
const BOT_SERVER_URL = process.env.BOT_SERVER_URL!           // e.g. https://your-bot.railway.app
const BOT_SERVER_SECRET = process.env.BOT_SERVER_SECRET!

// ── Daily helpers ─────────────────────────────────────────────────────────────

async function createDailyRoom(applicationId: string, durationMinutes = 90) {
  const exp = Math.floor(Date.now() / 1000) + durationMinutes * 60
  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `howell-interview-${applicationId}-${Date.now()}`,
      properties: {
        exp,
        max_participants: 2,           // candidate + bot
        enable_noise_cancellation_ui: true,
        start_audio_off: false,
        start_video_off: false,
        sfu_switchover: 0.5,           // SFU mode for lower latency
      },
    }),
  })
  const data = await res.json()
  if (!data.url) throw new Error(`Daily room creation failed: ${JSON.stringify(data)}`)
  return data as { name: string; url: string }
}

async function createDailyToken(roomName: string, isOwner: boolean, userName?: string) {
  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        is_owner: isOwner,
        user_name: userName,
        exp: Math.floor(Date.now() / 1000) + 7200, // 2-hour token
      },
    }),
  })
  const data = await res.json()
  if (!data.token) throw new Error(`Daily token creation failed: ${JSON.stringify(data)}`)
  return data.token as string
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

    // 1. Create Daily room ─────────────────────────────────────────────────────
    const room = await createDailyRoom(applicationId, durationMinutes + 30)

    // 2. Mint tokens ───────────────────────────────────────────────────────────
    const [botToken, candidateToken] = await Promise.all([
      createDailyToken(room.name, true,  'Alex (AI Interviewer)'),
      createDailyToken(room.name, false, candidateName),
    ])

    // 3. Build callback URL ────────────────────────────────────────────────────
    const baseUrl     = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const callbackUrl = `${baseUrl}/api/interviews/interview-callback`

    // 4. Start Pipecat bot ─────────────────────────────────────────────────────
    const botPayload = {
      DAILY_ROOM_URL:        room.url,
      DAILY_BOT_TOKEN:       botToken,
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
      ELEVENLABS_API_KEY:    process.env.ELEVENLABS_API_KEY!,
      ELEVENLABS_VOICE_ID:   process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
      SIMLI_API_KEY:         process.env.SIMLI_API_KEY!,
      SIMLI_FACE_ID:         process.env.SIMLI_FACE_ID || 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427',
      DEEPGRAM_API_KEY:      process.env.DEEPGRAM_API_KEY!,
    }

    console.log('[create-ai-session] BOT_SERVER_URL:', BOT_SERVER_URL)
    console.log('[create-ai-session] BOT_SERVER_SECRET length:', BOT_SERVER_SECRET?.length, 'value:', BOT_SERVER_SECRET)

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
      daily_room_name: room.name,
      daily_room_url:  room.url,
      status:          'pending',
      type:            'ai_pipecat',
      created_at:      new Date().toISOString(),
    }, { onConflict: 'application_id,round_id' })

    // 6. Build shareable candidate link ────────────────────────────────────────
    const candidateLink =
      `${baseUrl}/candidate-interview` +
      `?room=${encodeURIComponent(room.url)}` +
      `&token=${encodeURIComponent(candidateToken)}` +
      `&name=${encodeURIComponent(candidateName)}` +
      `&applicationId=${encodeURIComponent(applicationId)}`

    return NextResponse.json({
      success:       true,
      candidateLink,
      roomUrl:       room.url,
      roomName:      room.name,
    })

  } catch (error: any) {
    console.error('[create-ai-session]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
