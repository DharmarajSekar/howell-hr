/**
 * POST /api/interviews/heygen-token
 * Generates a short-lived HeyGen streaming access token for the SDK.
 * The token is used by @heygen/streaming-avatar on the client side.
 *
 * Required env var:
 *   HEYGEN_API_KEY  — from app.heygen.com → Settings → API Keys
 *
 * Optional env vars:
 *   HEYGEN_AVATAR_ID  — preset avatar ID (default: Kristin_public_3_20240108)
 *   HEYGEN_VOICE_ID   — HeyGen voice ID (leave unset to use avatar's default voice)
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'HEYGEN_API_KEY not configured' },
      { status: 503 }
    )
  }

  try {
    const res = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()

    if (!res.ok || !data.data?.token) {
      console.error('[HeyGen Token] API error:', data)
      return NextResponse.json(
        { error: data.message ?? 'Failed to generate HeyGen token' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      token:    data.data.token,
      avatarId: process.env.HEYGEN_AVATAR_ID || 'Kristin_public_3_20240108',
      voiceId:  process.env.HEYGEN_VOICE_ID  || null,
    })
  } catch (err: any) {
    console.error('[HeyGen Token] Exception:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
