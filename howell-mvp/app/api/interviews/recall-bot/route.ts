/**
 * POST /api/interviews/recall-bot
 *
 * Deploys a Recall.ai bot to auto-join a Google Meet / Teams / Zoom meeting.
 * The bot records audio, generates a real-time transcript, and fires webhook
 * events to /api/interviews/recall-webhook.
 *
 * Env var required:
 *   RECALL_API_KEY  – from app.recall.ai → Settings → API Keys
 *
 * Body: { interviewId, meetingUrl, candidateName, jobTitle }
 *
 * Returns: { botId, botStatus, joinedAt }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const recallKey = process.env.RECALL_API_KEY
    if (!recallKey) {
      return NextResponse.json(
        { error: 'RECALL_API_KEY env var not set', setup: true },
        { status: 503 }
      )
    }

    const { interviewId, meetingUrl, candidateName, jobTitle } = await req.json()

    if (!meetingUrl) {
      return NextResponse.json({ error: 'meetingUrl is required' }, { status: 400 })
    }

    const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const webhookUrl = `${appUrl}/api/interviews/recall-webhook`

    // Deploy the Recall.ai bot
    const res = await fetch('https://api.recall.ai/api/v1/bot/', {
      method:  'POST',
      headers: {
        Authorization:  `Token ${recallKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name:    'Howell HR AI — Interview Observer',

        // Real-time transcription via Deepgram
        transcription_options: {
          provider: 'deepgram',
          language: 'en',
        },

        // Webhook for real-time events (transcript + status changes)
        webhook_callback_url: webhookUrl,

        // Metadata passed back in every webhook event
        metadata: {
          interview_id:   interviewId || null,
          candidate_name: candidateName || '',
          job_title:      jobTitle || '',
        },

        // Bot configuration
        recording_config: {
          transcript: true,
          video:      false,   // audio only — reduces cost
        },

        // Automatic join/leave behaviour
        automatic_leave: {
          everyone_left_timeout: 120,    // leave 2 min after everyone leaves
          silence_timeout:       600,    // leave after 10 min of silence
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Recall.ai bot error:', data)
      return NextResponse.json(
        { error: data.detail || data.message || 'Recall.ai API error', details: data },
        { status: res.status }
      )
    }

    const botId = data.id

    // Save bot ID to interviews table so we can correlate webhook events
    if (interviewId) {
      const { error: dbErr } = await db()
        .from('interviews')
        .update({
          recall_bot_id: botId,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', interviewId)

      if (dbErr) console.error('Failed to save recall_bot_id:', dbErr.message)
    }

    return NextResponse.json({
      botId,
      botStatus: data.status_changes?.[0]?.code || 'created',
      joinedAt:  new Date().toISOString(),
      message:   'Recall.ai bot is joining the meeting now. Live transcript will stream to your AI Room.',
    })

  } catch (e: any) {
    console.error('recall-bot error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── GET — check bot status ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const recallKey = process.env.RECALL_API_KEY
  if (!recallKey) return NextResponse.json({ error: 'RECALL_API_KEY not set' }, { status: 503 })

  const botId = new URL(req.url).searchParams.get('botId')
  if (!botId)  return NextResponse.json({ error: 'botId required' }, { status: 400 })

  const res  = await fetch(`https://api.recall.ai/api/v1/bot/${botId}/`, {
    headers: { Authorization: `Token ${recallKey}` },
  })
  const data = await res.json()

  return NextResponse.json({
    botId,
    status:          data.status_changes?.slice(-1)[0]?.code || 'unknown',
    meetingUrl:      data.meeting_url,
    transcriptReady: !!data.transcript,
  })
}

// ── DELETE — remove bot from meeting ─────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const recallKey = process.env.RECALL_API_KEY
  if (!recallKey) return NextResponse.json({ error: 'RECALL_API_KEY not set' }, { status: 503 })

  const { botId } = await req.json()
  if (!botId) return NextResponse.json({ error: 'botId required' }, { status: 400 })

  await fetch(`https://api.recall.ai/api/v1/bot/${botId}/leave_call/`, {
    method:  'POST',
    headers: { Authorization: `Token ${recallKey}` },
  })

  return NextResponse.json({ success: true, message: 'Bot removed from meeting' })
}
