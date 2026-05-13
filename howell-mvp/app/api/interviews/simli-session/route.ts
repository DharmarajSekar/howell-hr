/**
 * GET /api/interviews/simli-session
 * Returns Simli config (API key + face ID) for the candidate interview page.
 *
 * Required env vars:
 *   SIMLI_API_KEY   — get from https://app.simli.com  (free tier: 60 min/month)
 *   SIMLI_FACE_ID   — UUID from Simli face library (default: tmp9i8bbq — professional female)
 *
 * Returns 503 if Simli is not configured so the client can fall back
 * to the browser TTS + SVG avatar gracefully.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = process.env.SIMLI_API_KEY
  const faceId = process.env.SIMLI_FACE_ID || 'tmp9i8bbq' // professional female, free demo face

  if (!apiKey) {
    return NextResponse.json(
      { error: 'SIMLI_API_KEY not configured — add it to .env.local' },
      { status: 503 }
    )
  }

  return NextResponse.json({ apiKey, faceId })
}
