/**
 * GET /api/interviews/deepgram-token
 * Returns a Deepgram API key for the browser to open a real-time STT WebSocket.
 * For an internal HR tool this is acceptable; for public-facing apps, issue
 * short-lived keys via the Deepgram Keys API instead.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'DEEPGRAM_API_KEY is not configured' },
      { status: 500 }
    )
  }
  return NextResponse.json({ apiKey: key })
}
