/**
 * GET /api/interviews/completed-sessions
 * Fetch completed AI interview sessions for HR review.
 * Returns ai_sessions joined with candidate + job info.
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

export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await db()
      .from('ai_interview_sessions')
      .select(`
        id,
        status,
        ai_score,
        ai_evaluation,
        recording_url,
        recommendation,
        transcript,
        scheduled_at,
        completed_at,
        application:applications (
          id,
          candidate:candidates ( full_name, email, current_title ),
          job:jobs ( title )
        )
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (error) return NextResponse.json({ sessions: [] })

    // Flatten for easier consumption
    const sessions = (data || []).map((s: any) => ({
      id:             s.id,
      status:         s.status,
      ai_score:       s.ai_score,
      ai_summary:     s.ai_evaluation ?? null,
      recording_url:  s.recording_url ?? null,
      recommendation: s.recommendation,
      transcript:     s.transcript  || [],
      completed_at:   s.completed_at,
      scheduled_at:   s.scheduled_at,
      application_id: s.application?.id,
      candidate_name: s.application?.candidate?.full_name ?? 'Unknown',
      candidate_email: s.application?.candidate?.email ?? '',
      job_title:      s.application?.job?.title ?? 'Unknown Role',
    }))

    return NextResponse.json({ sessions })
  } catch (err: any) {
    return NextResponse.json({ sessions: [] })
  }
}
