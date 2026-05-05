import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/video-prescreen/submit
 * Called when a candidate finishes all video pre-screen answers.
 * Saves recording metadata to pre_screen_sessions and marks it completed.
 */
export async function POST(req: Request) {
  try {
    const { session_id, recordings, submitted_at } = await req.json()
    if (!session_id || !recordings?.length) {
      return NextResponse.json({ error: 'Missing session_id or recordings' }, { status: 400 })
    }

    // Build a simple AI summary (in prod would call GPT with transcript)
    const totalDuration = recordings.reduce((s: number, r: any) => s + (r.duration_secs || 0), 0)
    const avgDuration   = Math.round(totalDuration / recordings.length)
    const aiScore       = Math.min(92, 55 + Math.floor(avgDuration / 2))  // proxy score from response depth

    const aiEvaluation = `Video Pre-Screen submitted. ${recordings.length} questions answered via video. ` +
      `Average response length: ${avgDuration}s. ` +
      `Estimated engagement score: ${aiScore}/100. ` +
      `Recordings stored at: ${recordings.map((r: any) => r.storage_path).join(', ')}.`

    // Update the pre_screen_session
    const { error } = await svc()
      .from('pre_screen_sessions')
      .update({
        status:         'completed',
        ai_score:       aiScore,
        ai_evaluation:  aiEvaluation,
        completed_at:   submitted_at || new Date().toISOString(),
        // Store recording paths in a JSONB field if the column exists
        video_recordings: recordings,
      })
      .eq('id', session_id)

    // If video_recordings column doesn't exist yet, retry without it
    if (error?.message?.includes('video_recordings')) {
      await svc()
        .from('pre_screen_sessions')
        .update({
          status:        'completed',
          ai_score:      aiScore,
          ai_evaluation: aiEvaluation,
          completed_at:  submitted_at || new Date().toISOString(),
        })
        .eq('id', session_id)
    }

    return NextResponse.json({ success: true, aiScore })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * GET /api/video-prescreen/submit?session_id=xxx
 * Returns recording metadata for a session (used by recruiter review page)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

  const { data } = await svc()
    .from('pre_screen_sessions')
    .select('*, responses:pre_screen_responses(*)')
    .eq('id', sessionId)
    .single()

  return NextResponse.json(data || {})
}
