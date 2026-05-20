/**
 * GET /api/interviews/heygen-debug
 * Tests the HeyGen API key and returns the exact error for diagnosis.
 * Remove this route once HeyGen is confirmed working.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = process.env.HEYGEN_API_KEY
  const avatarId = process.env.HEYGEN_AVATAR_ID || 'Emery_public_1'

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'HEYGEN_API_KEY is not set in environment variables' })
  }

  try {
    const res = await fetch('https://api.heygen.com/v1/streaming.new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ quality: 'low', avatar_name: avatarId }),
    })
    const data = await res.json()

    if (data.code === 100) {
      // Immediately stop the session we just created — this was only a test
      await fetch('https://api.heygen.com/v1/streaming.stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({ session_id: data.data?.session_id }),
      }).catch(() => {})
      return NextResponse.json({ ok: true, message: 'HeyGen API is working correctly', avatarId })
    }

    return NextResponse.json({ ok: false, code: data.code, error: data.message, raw: data, avatarId })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
