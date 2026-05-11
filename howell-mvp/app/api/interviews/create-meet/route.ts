/**
 * POST /api/interviews/create-meet
 *
 * Creates a real Google Meet link via the Google Calendar API using a
 * service-account JWT (no user OAuth flow required).
 *
 * Env vars required:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  – base-64-encoded service-account JSON
 *   GOOGLE_CALENDAR_ID           – calendar to create events on (e.g. "primary" or a shared cal)
 *
 * Returns: { meetLink, eventId, htmlLink, startTime, endTime }
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ── JWT helpers ──────────────────────────────────────────────────────────────

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function createServiceAccountJWT(sa: {
  client_email: string
  private_key: string
}): string {
  const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now     = Math.floor(Date.now() / 1000)
  const payload = base64url(JSON.stringify({
    iss:   sa.client_email,
    sub:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))

  const data = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(data)
  // Google service-account JSON stores \n as literal \\n — restore them
  const privateKey = sa.private_key.replace(/\\n/g, '\n')
  const signature  = base64url(sign.sign(privateKey))
  return `${data}.${signature}`
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const jwt = createServiceAccountJWT(sa)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Google token error: ${JSON.stringify(data)}`)
  return data.access_token
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!saJson) {
      return NextResponse.json(
        { error: 'GOOGLE_SERVICE_ACCOUNT_JSON env var not set', setup: true },
        { status: 503 }
      )
    }

    // Accept base-64 encoded or raw JSON string
    let sa: any
    try {
      sa = JSON.parse(
        saJson.startsWith('{') ? saJson : Buffer.from(saJson, 'base64').toString('utf-8')
      )
    } catch {
      return NextResponse.json({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON format' }, { status: 400 })
    }

    const {
      title,
      candidateName,
      candidateEmail,
      scheduledAt,         // ISO string
      durationMinutes = 60,
      interviewId,
    } = await req.json()

    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 })
    }

    const calendarId  = process.env.GOOGLE_CALENDAR_ID || 'primary'
    const accessToken = await getAccessToken(sa)

    const startTime = new Date(scheduledAt)
    const endTime   = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

    const attendees: { email: string }[] = []
    if (candidateEmail) attendees.push({ email: candidateEmail })

    // Create Calendar event with Google Meet conference
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary:     title || `Howell HR Interview — ${candidateName || 'Candidate'}`,
          description: `Interview scheduled via Howell HR platform.\n\nInterview ID: ${interviewId || 'N/A'}`,
          start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
          end:   { dateTime: endTime.toISOString(),   timeZone: 'Asia/Kolkata' },
          attendees,
          conferenceData: {
            createRequest: {
              requestId:            crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          reminders: {
            useDefault: false,
            overrides:  [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 10 }],
          },
        }),
      }
    )

    const calData = await calRes.json()

    if (!calRes.ok) {
      console.error('Google Calendar API error:', calData)
      return NextResponse.json(
        { error: calData.error?.message || 'Calendar API error', details: calData },
        { status: calRes.status }
      )
    }

    // Extract Meet link from conference entry points
    const meetEntry = calData.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )
    const meetLink = meetEntry?.uri || null

    return NextResponse.json({
      meetLink,
      eventId:   calData.id,
      htmlLink:  calData.htmlLink,
      startTime: startTime.toISOString(),
      endTime:   endTime.toISOString(),
    })

  } catch (e: any) {
    console.error('create-meet error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
