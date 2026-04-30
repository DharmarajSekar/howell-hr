/**
 * POST /api/interviews/auto-schedule
 * Checks all applications and auto-schedules AI rounds based on:
 * - AI match score vs round's score_trigger threshold
 * - delay_hours since last action
 * - requires_approval gate
 *
 * Can be called manually or via a cron job (Vercel cron / GitHub Actions)
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

export async function POST(req: NextRequest) {
  try {
    const { jobId, forceAll } = await req.json().catch(() => ({}))

    // Get all active pipeline configs
    let configQuery = db()
      .from('interview_pipeline_configs')
      .select('*, rounds:interview_rounds(*), job:jobs(id, title)')
      .eq('auto_schedule_enabled', true)

    if (jobId) configQuery = configQuery.eq('job_id', jobId)

    const { data: configs } = await configQuery
    if (!configs || configs.length === 0) {
      return NextResponse.json({ message: 'No auto-schedule configs found', queued: 0 })
    }

    let queued = 0
    let skipped = 0
    const log: string[] = []

    for (const config of configs) {
      const rounds = (config.rounds || [])
        .filter((r: any) => r.is_active && r.auto_schedule)
        .sort((a: any, b: any) => a.round_number - b.round_number)

      if (rounds.length === 0) continue

      // Get all applications for this job
      const { data: applications } = await db()
        .from('applications')
        .select('*, candidate:candidates(full_name, email)')
        .eq('job_id', config.job_id)
        .in('status', ['applied', 'screening', 'shortlisted'])

      for (const app of (applications || [])) {
        for (const round of rounds) {
          // Check if score meets trigger threshold
          const score = app.ai_match_score || 0
          if (score < round.score_trigger && !forceAll) {
            skipped++
            continue
          }

          // Check if already scheduled or queued for this round
          const { data: existing } = await db()
            .from('interview_auto_queue')
            .select('id, status')
            .eq('application_id', app.id)
            .eq('round_id', round.id)
            .limit(1)

          if (existing && existing.length > 0) continue // already in queue

          // Check if AI session already exists for this round
          const { data: existingSession } = await db()
            .from('ai_interview_sessions')
            .select('id')
            .eq('application_id', app.id)
            .eq('round_id', round.id)
            .limit(1)

          if (existingSession && existingSession.length > 0) continue // already done

          // Calculate scheduled_for based on delay_hours
          const scheduledFor = new Date(Date.now() + round.delay_hours * 60 * 60 * 1000)

          // Add to auto-schedule queue
          await db().from('interview_auto_queue').insert({
            application_id: app.id,
            round_id:       round.id,
            trigger_score:  score,
            scheduled_for:  scheduledFor.toISOString(),
            status:         round.requires_approval ? 'pending' : 'approved',
          })

          queued++
          log.push(`Queued: ${app.candidate?.full_name} → ${round.name} (score: ${score}, scheduled: ${scheduledFor.toLocaleDateString('en-IN')})`)

          // If auto-approved, create AI session immediately
          if (!round.requires_approval && round.type === 'ai') {
            await db().from('ai_interview_sessions').insert({
              application_id:        app.id,
              round_id:              round.id,
              status:                'scheduled',
              scheduled_at:          scheduledFor.toISOString(),
            })
          }
        }
      }
    }

    return NextResponse.json({ queued, skipped, log, success: true })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET: fetch pending approvals queue for HR
export async function GET(req: NextRequest) {
  const { data, error } = await db()
    .from('interview_auto_queue')
    .select(`
      *,
      application:applications(*, candidate:candidates(full_name, email, current_title), job:jobs(title)),
      round:interview_rounds(name, type, round_number, score_trigger)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ queue: data || [] })
}
