/**
 * POST /api/screening/evaluate
 *
 * Runs the full AI screening pipeline for an application:
 * 1. Checks knockout questions — auto-rejects if any fail
 * 2. Runs eligibility checks (experience, salary, location)
 * 3. Calls AI scoring endpoint
 * 4. Auto-shortlists if score >= threshold
 * 5. Auto-rejects if score < reject_threshold
 * 6. Saves results to screening_results table
 * 7. Updates application status
 *
 * Body: { applicationId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSystemNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json()
    if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 })

    // ── Fetch full application with candidate + job ────────
    const { data: app, error: appErr } = await db()
      .from('applications')
      .select('*, candidate:candidates(*), job:jobs(*)')
      .eq('id', applicationId)
      .single()

    if (appErr || !app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

    const candidate = app.candidate
    const job       = app.job

    // ── 1. Knockout questions check ────────────────────────
    const { data: knockouts } = await db()
      .from('knockout_questions')
      .select('*')
      .eq('job_id', job.id)
      .eq('is_active', true)
      .order('sort_order')

    // For now, evaluate yes/no knockouts against candidate data
    let knockoutPassed    = true
    let knockoutFailedQ   = null as string | null
    let knockoutRejectMsg = null as string | null

    if (knockouts && knockouts.length > 0) {
      for (const kq of knockouts) {
        if (kq.question_type === 'min_value') {
          // e.g. "minimum 5 years experience" — check against experience_years
          const minVal = parseFloat(kq.pass_answer)
          if (kq.question.toLowerCase().includes('experience') && (candidate.experience_years || 0) < minVal) {
            knockoutPassed    = false
            knockoutFailedQ   = kq.question
            knockoutRejectMsg = kq.reject_message
            break
          }
          if (kq.question.toLowerCase().includes('salary') && (candidate.salary_expectation || 0) > minVal) {
            knockoutPassed    = false
            knockoutFailedQ   = kq.question
            knockoutRejectMsg = kq.reject_message
            break
          }
        }
        // yes/no and multiple_choice require candidate self-response (handled in pre-screen)
        // For now, auto-pass these types — they are evaluated in the pre-screen bot
      }
    }

    // ── 2. Run AI scoring ──────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const scoreRes = await fetch(`${baseUrl}/api/ai/score-resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobTitle:                   job.title       || '',
        jobDescription:             job.description || '',
        jobRequirements:            job.requirements || '',
        jobSkills:                  job.skills       || [],
        jobExperienceMin:           job.experience_min || 0,
        jobExperienceMax:           job.experience_max || 0,
        jobSalaryMin:               job.salary_min   || 0,
        jobSalaryMax:               job.salary_max   || 0,
        jobLocation:                job.location     || '',
        candidateName:              candidate.full_name || 'Candidate',
        candidateTitle:             candidate.current_title || '',
        candidateSkills:            candidate.skills || [],
        candidateExperienceYears:   candidate.experience_years || 0,
        candidateSalaryExpectation: candidate.salary_expectation || 0,
        candidateLocation:          candidate.location || '',
        candidateSummary:           candidate.summary || '',
      }),
    })

    const scoreData = await scoreRes.json()
    const aiScore   = scoreData.score   || 0
    const eligibility = scoreData.eligibility || {}

    // ── 3. Get pipeline config thresholds ─────────────────
    const { data: pipelineConfig } = await db()
      .from('interview_pipeline_configs')
      .select('auto_shortlist_threshold, auto_reject_below, auto_schedule_enabled')
      .eq('job_id', job.id)
      .limit(1)

    const shortlistThreshold = pipelineConfig?.[0]?.auto_shortlist_threshold ?? 70
    const rejectThreshold    = pipelineConfig?.[0]?.auto_reject_below        ?? 40

    // ── 4. Determine overall result ────────────────────────
    // Only act on score if:
    //   a) AI scoring returned a non-zero result, AND
    //   b) Candidate has enough profile data to be meaningfully scored
    //      (prevents auto-rejection of candidates with incomplete/null profiles)
    const hasEnoughData = Boolean(
      (candidate.experience_years && candidate.experience_years > 0) ||
      (candidate.skills           && (candidate.skills as any[]).length > 0) ||
      (candidate.current_title    && candidate.current_title.trim())  ||
      (candidate.summary          && candidate.summary.trim())
    )
    const scoringSucceeded = aiScore > 0 && hasEnoughData

    let overallResult = 'review'
    let autoRejected  = false
    let rejectReason  = null as string | null
    let newStatus     = app.status  // don't change unless threshold met

    if (!knockoutPassed) {
      // Knockout always wins — hard reject regardless of score
      overallResult = 'fail'
      autoRejected  = true
      rejectReason  = knockoutRejectMsg || `Failed knockout: ${knockoutFailedQ}`
      newStatus     = 'rejected'
    } else if (scoreData.auto_reject && scoringSucceeded) {
      overallResult = 'fail'
      autoRejected  = true
      rejectReason  = scoreData.reject_reason
      newStatus     = 'rejected'
    } else if (scoringSucceeded && aiScore >= shortlistThreshold) {
      overallResult = 'pass'
      newStatus     = 'shortlisted'
    } else if (scoringSucceeded && aiScore < rejectThreshold) {
      overallResult = 'fail'
      autoRejected  = true
      rejectReason  = `AI match score ${aiScore}% is below the minimum threshold of ${rejectThreshold}%`
      newStatus     = 'rejected'
    }
    // If scoringSucceeded is false (score = 0), leave status unchanged and mark as 'review'

    // ── 5. Save screening results ──────────────────────────
    const screeningRecord = {
      application_id:    applicationId,
      experience_check:  eligibility.experience?.pass ? 'pass' : 'fail',
      experience_detail: eligibility.experience?.detail || '',
      salary_check:      eligibility.salary?.pass      ? 'pass' : 'fail',
      salary_detail:     eligibility.salary?.detail    || '',
      location_check:    eligibility.location?.pass    ? 'pass' : 'fail',
      location_detail:   eligibility.location?.detail  || '',
      knockout_passed:   knockoutPassed,
      knockout_failed_q: knockoutFailedQ,
      ai_score:          aiScore,
      ai_summary:        scoreData.summary   || '',
      ai_strengths:      scoreData.strengths || [],
      ai_gaps:           scoreData.gaps      || [],
      overall_result:    overallResult,
      auto_rejected:     autoRejected,
      reject_reason:     rejectReason,
      screened_at:       new Date().toISOString(),
    }

    // Upsert (replace if already exists for this application)
    await db()
      .from('screening_results')
      .upsert(screeningRecord, { onConflict: 'application_id' })

    // ── 6. Update application ──────────────────────────────
    const updatePayload: any = {
      ai_match_score:   aiScore,
      ai_match_summary: scoreData.summary   || '',
      ai_strengths:     scoreData.strengths || [],
      ai_gaps:          scoreData.gaps      || [],
      updated_at:       new Date().toISOString(),
    }
    if (newStatus !== app.status) updatePayload.status = newStatus

    await db().from('applications').update(updatePayload).eq('id', applicationId)

    // ── 7. If shortlisted + auto_schedule on, queue interviews ─
    if (overallResult === 'pass' && pipelineConfig?.[0]?.auto_schedule_enabled) {
      const { data: rounds } = await db()
        .from('interview_rounds')
        .select('*, config:interview_pipeline_configs!inner(job_id)')
        .eq('config.job_id', job.id)
        .eq('is_active', true)
        .eq('auto_schedule', true)
        .eq('type', 'ai')
        .order('round_number')

      for (const round of (rounds || [])) {
        if (aiScore >= round.score_trigger) {
          const { data: existing } = await db()
            .from('interview_auto_queue')
            .select('id')
            .eq('application_id', applicationId)
            .eq('round_id', round.id)
            .limit(1)

          if (!existing || existing.length === 0) {
            const scheduledFor = new Date(Date.now() + round.delay_hours * 60 * 60 * 1000)
            await db().from('interview_auto_queue').insert({
              application_id: applicationId,
              round_id:       round.id,
              trigger_score:  aiScore,
              scheduled_for:  scheduledFor.toISOString(),
              status:         round.requires_approval ? 'pending' : 'approved',
            })
          }
        }
      }
    }

    // System notification — pre-screen complete
    if (aiScore > 0) {
      const candidateName = candidate?.full_name || 'A candidate'
      const jobTitle      = job?.title || 'an open role'
      if (autoRejected) {
        createSystemNotification({
          type:        'pre_screen_complete',
          title:       `Pre-screen: ${candidateName} auto-rejected`,
          message:     `${candidateName} scored ${aiScore}% for ${jobTitle}. Auto-rejected: ${rejectReason || 'below threshold'}.`,
          severity:    'warning',
          link:        `/candidates/${applicationId}`,
          entity_id:   applicationId,
          entity_type: 'application',
        })
      } else if (overallResult === 'pass') {
        createSystemNotification({
          type:        'pre_screen_complete',
          title:       `Pre-screen passed — ${candidateName} (${aiScore}%)`,
          message:     `${candidateName} scored ${aiScore}% for ${jobTitle} and has been automatically shortlisted for interview.`,
          severity:    'info',
          link:        `/candidates/${applicationId}`,
          entity_id:   applicationId,
          entity_type: 'application',
        })
      } else {
        createSystemNotification({
          type:        'pre_screen_complete',
          title:       `Pre-screen complete — ${candidateName} (${aiScore}%)`,
          message:     `${candidateName} scored ${aiScore}% for ${jobTitle}. Manual review recommended before proceeding.`,
          severity:    'info',
          link:        `/candidates/${applicationId}`,
          entity_id:   applicationId,
          entity_type: 'application',
        })
      }
    }

    return NextResponse.json({
      success:        true,
      applicationId,
      aiScore,
      overallResult,
      autoRejected,
      rejectReason,
      newStatus,
      knockoutPassed,
      eligibility,
    })

  } catch (err: any) {
    console.error('screening/evaluate error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
