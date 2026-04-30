/**
 * GET  /api/interviews/config?jobId=xxx  — fetch pipeline config for a job
 * POST /api/interviews/config            — create/update pipeline config + rounds
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
  const jobId = new URL(req.url).searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const { data: config } = await db()
    .from('interview_pipeline_configs')
    .select('*, rounds:interview_rounds(*)')
    .eq('job_id', jobId)
    .single()

  if (!config) {
    // Return default config if none exists
    return NextResponse.json({
      config: null,
      rounds: [],
      defaults: {
        auto_schedule_enabled: false,
        rounds: [
          { round_number: 1, name: 'AI Screening Round', type: 'ai', duration_minutes: 20, pass_score_threshold: 65, auto_schedule: true, score_trigger: 70, delay_hours: 24, requires_approval: false, tavus_persona_id: '', ai_questions: ['Tell me about your experience with the required skills.', 'Describe a challenging project you worked on.', 'Why are you interested in this role?'] },
          { round_number: 2, name: 'Technical Round', type: 'manual', duration_minutes: 45, pass_score_threshold: 60, auto_schedule: false, score_trigger: 65, delay_hours: 48, requires_approval: true, ai_questions: [] },
          { round_number: 3, name: 'HR Final Round', type: 'manual', duration_minutes: 30, pass_score_threshold: 70, auto_schedule: false, score_trigger: 70, delay_hours: 24, requires_approval: true, ai_questions: [] },
        ]
      }
    })
  }

  const rounds = (config.rounds || []).sort((a: any, b: any) => a.round_number - b.round_number)
  return NextResponse.json({ config, rounds })
}

export async function POST(req: NextRequest) {
  const { jobId, name, auto_schedule_enabled, rounds } = await req.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  // Upsert pipeline config
  const { data: config, error: configErr } = await db()
    .from('interview_pipeline_configs')
    .upsert({ job_id: jobId, name, auto_schedule_enabled, updated_at: new Date().toISOString() }, { onConflict: 'job_id' })
    .select('id')
    .single()

  if (configErr) return NextResponse.json({ error: configErr.message }, { status: 500 })

  // Delete existing rounds and re-insert
  await db().from('interview_rounds').delete().eq('config_id', config.id)

  if (rounds && rounds.length > 0) {
    const { error: roundsErr } = await db().from('interview_rounds').insert(
      rounds.map((r: any, i: number) => ({
        config_id:            config.id,
        round_number:         i + 1,
        name:                 r.name,
        type:                 r.type,
        duration_minutes:     r.duration_minutes,
        tavus_persona_id:              r.tavus_persona_id || null,
        ai_questions:                  r.ai_questions || [],
        ai_auto_generate_questions:    r.ai_auto_generate_questions !== false, // default true
        pass_score_threshold:          r.pass_score_threshold,
        auto_schedule:        r.auto_schedule,
        score_trigger:        r.score_trigger,
        delay_hours:          r.delay_hours,
        requires_approval:    r.requires_approval,
        is_active:            true,
      }))
    )
    if (roundsErr) return NextResponse.json({ error: roundsErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, configId: config.id })
}
