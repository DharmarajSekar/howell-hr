/**
 * POST /api/portals/sync-candidate
 *
 * Called when HR explicitly clicks "Move to Shortlisted" on a portal profile.
 * This is the ONLY place an application record is created for portal-sourced candidates.
 * The candidate must already be in the candidates master (saved via /api/portals/save-profiles).
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

export function buildAIQuery(job: any): string {
  const titleWords = job.title || ''
  const reqText    = (job.requirements || '') + ' ' + (job.description || '')
  const skillPatterns = reqText.match(/\b(BMS|ELV|CCTV|PMP|SQL|Python|AutoCAD|HRBP|SAP|Workday|Agile|Scrum|BICSI|POSH|ISO|Power BI|MS Project|Lenel|Genetec|Honeywell|Siemens|Access Control|Structured Cabling|Fire Alarm|HVAC|MEP|EPC|HRMS|ATS|L&D|LMS)\b/gi) || []
  const uniqueSkills  = [...new Set(skillPatterns.map((s: string) => s.toUpperCase()))].slice(0, 5)
  return [titleWords, ...uniqueSkills].filter(Boolean).join(' ').trim()
}

export async function POST(request: NextRequest) {
  try {
    const { profile, jobId, matchScore } = await request.json()

    if (!profile || !jobId) {
      return NextResponse.json({ success: false, error: 'profile and jobId are required' }, { status: 400 })
    }

    // Build email to look up this candidate in the master table
    const cleanName = (profile.name || 'unknown').toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
    const cleanSrc  = (profile.source || 'portal').toLowerCase().replace(/[^a-z0-9]/g, '')
    const email = (
      profile.email &&
      !profile.email.toLowerCase().includes('available') &&
      profile.email.includes('@')
    )
      ? profile.email
      : `${cleanName}.${cleanSrc}@sourced.howell`

    // Find the candidate in the master table
    const { data: candidates, error: findErr } = await db()
      .from('candidates')
      .select('id, full_name')
      .eq('email', email)
      .limit(1)

    if (findErr || !candidates || candidates.length === 0) {
      return NextResponse.json({ success: false, error: 'Candidate not found in master. Try fetching profiles again.' }, { status: 404 })
    }

    const candidateId = candidates[0].id

    // Check if application already exists for this job
    const { data: existing } = await db()
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
      .limit(1)

    if (existing && existing.length > 0) {
      // Already shortlisted — update status to shortlisted
      await db()
        .from('applications')
        .update({ status: 'shortlisted' })
        .eq('id', existing[0].id)
      return NextResponse.json({ success: true, action: 'updated', candidateId })
    }

    // Create new application with status = shortlisted (HR explicitly chose this person)
    const { error: appErr } = await db()
      .from('applications')
      .insert({
        job_id:           jobId,
        candidate_id:     candidateId,
        status:           'shortlisted',
        ai_match_score:   matchScore || 0,
        ai_match_summary: `HR-shortlisted from ${profile.source} via AI portal sync. Match: ${matchScore || 0}%`,
        ai_strengths:     Array.isArray(profile.skills) ? profile.skills.slice(0, 3) : [],
        ai_gaps:          [],
        notes:            `Shortlisted by HR from ${profile.source} on ${new Date().toLocaleDateString('en-IN')}`,
      })

    if (appErr) {
      return NextResponse.json({ success: false, error: appErr.message }, { status: 500 })
    }

    // ── Auto-score the application via AI ────────────────────
    // Fetch new application id
    const { data: newApp } = await db()
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
      .limit(1)

    if (newApp && newApp.length > 0) {
      const appId = newApp[0].id
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        // Run AI scoring
        const scoreRes = await fetch(`${baseUrl}/api/ai/score-resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobTitle:      (await db().from('jobs').select('title').eq('id', jobId).single()).data?.title || '',
            candidateName: candidates[0].full_name,
          }),
        })
        const scoreData = await scoreRes.json()
        if (scoreData.score) {
          await db()
            .from('applications')
            .update({
              ai_match_score:   scoreData.score,
              ai_match_summary: scoreData.summary,
              ai_strengths:     scoreData.strengths || [],
              ai_gaps:          scoreData.gaps || [],
            })
            .eq('id', appId)

          // ── Check auto-schedule threshold ─────────────────
          const { data: configs } = await db()
            .from('interview_pipeline_configs')
            .select('id, auto_schedule_enabled, rounds:interview_rounds(*)')
            .eq('job_id', jobId)
            .eq('auto_schedule_enabled', true)
            .limit(1)

          if (configs && configs.length > 0) {
            const config = configs[0]
            const aiRounds = (config.rounds || [])
              .filter((r: any) => r.is_active && r.auto_schedule && r.type === 'ai')
              .sort((a: any, b: any) => a.round_number - b.round_number)

            for (const round of aiRounds) {
              if (scoreData.score >= round.score_trigger) {
                // Check not already queued
                const { data: existing } = await db()
                  .from('interview_auto_queue')
                  .select('id')
                  .eq('application_id', appId)
                  .eq('round_id', round.id)
                  .limit(1)

                if (!existing || existing.length === 0) {
                  const scheduledFor = new Date(Date.now() + round.delay_hours * 60 * 60 * 1000)
                  await db().from('interview_auto_queue').insert({
                    application_id: appId,
                    round_id:       round.id,
                    trigger_score:  scoreData.score,
                    scheduled_for:  scheduledFor.toISOString(),
                    status:         round.requires_approval ? 'pending' : 'approved',
                  })

                  // If auto-approved, create session immediately
                  if (!round.requires_approval) {
                    await fetch(`${baseUrl}/api/interviews/start-ai-interview`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ applicationId: appId, roundId: round.id }),
                    })
                  }
                }
              }
            }
          }
        }
      } catch (scoreErr: any) {
        console.error('Auto-score error (non-fatal):', scoreErr.message)
      }
    }

    return NextResponse.json({ success: true, action: 'shortlisted', candidateId })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ query: '' })
  try {
    const { data: job } = await db().from('jobs').select('*').eq('id', jobId).single()
    return NextResponse.json({ query: buildAIQuery(job), job })
  } catch {
    return NextResponse.json({ query: '' })
  }
}
