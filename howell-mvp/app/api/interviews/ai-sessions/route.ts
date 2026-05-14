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

  // NOTE: We intentionally exclude the interview_rounds join here —
  // that table may not exist in all environments, and its absence would
  // silently break this endpoint returning 0 sessions.
  let query = db()
    .from('ai_interview_sessions')
    .select(`
      *,
      application:applications(
        id,
        candidate:candidates(full_name, email, current_title),
        job:jobs(title)
      )
    `)
    .order('created_at', { ascending: false })

  if (applicationId) {
    query = query.eq('application_id', applicationId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[ai-sessions] DB error:', error.message)
    // Return empty rather than 500 so the UI degrades gracefully
    return NextResponse.json({ sessions: [], _error: error.message })
  }
  return NextResponse.json({ sessions: data || [] })
}
