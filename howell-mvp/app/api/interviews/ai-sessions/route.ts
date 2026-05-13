/**
 * GET /api/interviews/ai-sessions
 * List all AI interview sessions with candidate and job details.
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

export async function GET(req: NextRequest) {
  const applicationId = new URL(req.url).searchParams.get('applicationId')

  let query = db()
    .from('ai_interview_sessions')
    .select(`
      *,
      application:applications(
        id,
        candidate:candidates(full_name, email, current_title),
        job:jobs(title)
      ),
      round:interview_rounds(name, round_number, type, pass_score_threshold)
    `)
    .order('created_at', { ascending: false })

  if (applicationId) {
    query = query.eq('application_id', applicationId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data || [] })
}
