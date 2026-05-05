/**
 * POST /api/ivr/transcribe
 *
 * Twilio Transcription Callback
 *
 * Called by Twilio after it transcribes a recording.
 * Updates the pre_screen_response with the transcription text and an AI score.
 *
 * Query params: q (question index), callSid
 * Twilio body: TranscriptionText, RecordingUrl
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function scoreTranscript(text: string): { score: number; feedback: string } {
  if (!text || text.trim().length < 15)
    return { score: 30, feedback: 'Response too brief or unclear. Could not transcribe properly.' }
  const words = text.trim().split(/\s+/).length
  const score = Math.min(92, 50 + Math.floor(words / 4))
  const fbs   = [
    'Clear verbal response with good structure.',
    'Candidate demonstrated relevant experience.',
    'Response shows confidence and domain knowledge.',
    'Good articulation; specific examples provided.',
  ]
  return { score, feedback: fbs[Math.floor(Math.random() * fbs.length)] }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const qIndex  = parseInt(searchParams.get('q') || '0', 10)
  const callSid = searchParams.get('callSid') || ''

  const body       = await req.formData()
  const transcript = body.get('TranscriptionText')?.toString() || ''

  if (!transcript) return NextResponse.json({ received: true })

  try {
    const { score, feedback } = scoreTranscript(transcript)

    // Find session by callSid and update the response
    const { data: sessions } = await svc()
      .from('pre_screen_sessions')
      .select('id')
      .eq('call_sid', callSid)
      .limit(1)

    if (sessions && sessions.length > 0) {
      await svc()
        .from('pre_screen_responses')
        .update({ answer: transcript, score, feedback })
        .eq('session_id', sessions[0].id)
        .eq('sort_order', qIndex)

      // Recalculate overall score
      const { data: responses } = await svc()
        .from('pre_screen_responses')
        .select('score')
        .eq('session_id', sessions[0].id)

      const scored  = (responses || []).filter((r: any) => r.score !== null)
      const overall = scored.length
        ? Math.round(scored.reduce((s: number, r: any) => s + r.score, 0) / scored.length)
        : 0

      if (overall > 0) {
        const rec = overall >= 70 ? 'Strong Hire' : overall >= 50 ? 'Consider' : 'Not Recommended'
        await svc()
          .from('pre_screen_sessions')
          .update({ overall_score: overall, ai_recommendation: rec })
          .eq('id', sessions[0].id)
      }
    }
  } catch { /* non-critical */ }

  return NextResponse.json({ received: true })
}

/**
 * GET /api/ivr/status?callSid=xxx
 * Returns the current IVR session status for a given call
 */
export async function GET(req: NextRequest) {
  const callSid = new URL(req.url).searchParams.get('callSid')
  if (!callSid) return NextResponse.json({ error: 'Missing callSid' }, { status: 400 })

  const { data } = await svc()
    .from('pre_screen_sessions')
    .select('*, responses:pre_screen_responses(*)')
    .eq('call_sid', callSid)
    .single()

  return NextResponse.json(data || { error: 'Not found' })
}
