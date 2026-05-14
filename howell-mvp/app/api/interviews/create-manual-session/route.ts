/**
 * POST /api/interviews/create-manual-session
 *
 * Creates a standard Daily.co meeting room (NO bot joins).
 * Used for manual and panel interview rounds — human interviewers only.
 * Returns a meeting link that can be sent to both interviewers and candidates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DAILY_API_KEY  = process.env.DAILY_API_KEY!
const DAILY_API_BASE = 'https://api.daily.co/v1'

async function createDailyRoom(applicationId: string, maxParticipants: number, durationHours = 24) {
  const exp = Math.floor(Date.now() / 1000) + durationHours * 3600
  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `howell-manual-${applicationId}-${Date.now()}`,
      properties: {
        exp,
        max_participants: maxParticipants,
        enable_noise_cancellation_ui: true,
        start_audio_off: false,
        start_video_off: false,
        // No AI bot — pure human meeting
      },
    }),
  })
  const data = await res.json()
  if (!data.url) throw new Error(`Daily room creation failed: ${JSON.stringify(data)}`)
  return data as { name: string; url: string }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      applicationId,
      roundId,
      roundType,          // 'manual' | 'panel'
      interviewerEmails,
      scheduledAt,
      durationMinutes = 60,
    } = body as {
      applicationId:    string
      roundId:          string
      roundType:        'manual' | 'panel'
      interviewerEmails: string[]
      scheduledAt:      string
      durationMinutes?: number
    }

    if (!applicationId || !roundId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Panel interviews may have up to 6 panellists + candidate
    const maxParticipants = roundType === 'panel' ? 8 : 3

    // Room is valid for 7 days (link can be sent in advance)
    const room = await createDailyRoom(applicationId, maxParticipants, 7 * 24)

    // Persist to Supabase
    const supabase = createClient()
    await supabase.from('interview_sessions').upsert({
      application_id:     applicationId,
      round_id:           roundId,
      daily_room_name:    room.name,
      daily_room_url:     room.url,
      scheduled_at:       scheduledAt,
      interviewer_emails: interviewerEmails,
      status:             'scheduled',
      type:               roundType,
      created_at:         new Date().toISOString(),
    }, { onConflict: 'application_id,round_id' })

    return NextResponse.json({
      success:     true,
      meetingLink: room.url,
      roomName:    room.name,
    })

  } catch (error: any) {
    console.error('[create-manual-session]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
