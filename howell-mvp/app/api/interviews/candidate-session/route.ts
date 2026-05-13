/**
 * GET /api/interviews/candidate-session?sessionId=<uuid>
 *
 * Public endpoint — no auth required.
 * Validates an ai_sessions UUID and returns the data needed
 * for the candidate interview page to load.
 *
 * The session UUID is non-guessable (v4 UUID), so it acts as
 * a secure token — candidates can only access their own session.
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
  const sessionId = new URL(req.url).searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  try {
    const { data: session, error } = await db()
      .from('ai_interview_sessions')
      .select(`
        id,
        status,
        application_id,
        round_id,
        application:applications (
          id,
          candidate:candidates ( full_name, email ),
          job:jobs ( title )
        )
      `)
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Interview session not found. Please check your link.' }, { status: 404 })
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'This interview has already been completed.' }, { status: 410 })
    }

    const app = session.application as any

    return NextResponse.json({
      aiSessionId:   session.id,
      applicationId: session.application_id,
      roundId:       session.round_id ?? null,
      candidateName: app?.candidate?.full_name ?? '',
      jobTitle:      app?.job?.title ?? 'the position',
      status:        session.status,
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
