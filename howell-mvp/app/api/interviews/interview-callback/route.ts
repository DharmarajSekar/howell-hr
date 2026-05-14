/**
 * POST /api/interviews/interview-callback
 *
 * Called by the Pipecat bot (bot.py → EndInterviewDetector._post_callback)
 * after every AI interview completes (normally or via early exit).
 *
 * Responsibilities:
 *  1. Verify the shared secret (Bearer token)
 *  2. Store transcript + structured JSON evaluation in Supabase
 *  3. Update interview_sessions status → 'completed'
 *  4. Auto-advance the application stage based on score vs. threshold
 *  5. Return 200 so the bot process can shut down cleanly
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  role:      'candidate' | 'interviewer'
  text:      string
  timestamp: number
}

interface QuestionEval {
  question:         string
  candidateResponse: string
  score:            number
  notes:            string
}

interface Evaluation {
  overallScore:          number
  recommendation:        'strong_hire' | 'hire' | 'maybe' | 'no_hire'
  summary:               string
  communicationScore:    number
  technicalScore:        number
  culturalFitScore:      number
  strengths:             string[]
  areasForImprovement:   string[]
  questionEvaluations:   QuestionEval[]
  error?:                string
}

interface CallbackPayload {
  applicationId: string
  roundId:       string
  candidateName: string
  jobTitle:      string
  completedAt:   number
  transcript:    TranscriptEntry[]
  evaluation:    Evaluation
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Authenticate ──────────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? ''
  const secret     = process.env.INTERVIEW_CALLBACK_SECRET ?? ''

  if (!secret || authHeader !== `Bearer ${secret}`) {
    console.warn('[interview-callback] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = (await request.json()) as CallbackPayload
    const { applicationId, roundId, transcript, evaluation, completedAt } = payload

    if (!applicationId || !roundId) {
      return NextResponse.json({ error: 'Missing applicationId or roundId' }, { status: 400 })
    }

    const supabase   = createClient()
    const completedIso = new Date(completedAt * 1000).toISOString()

    // 2. Store interview result ───────────────────────────────────────────────
    const { error: insertError } = await supabase
      .from('interview_results')
      .upsert({
        application_id:       applicationId,
        round_id:             roundId,
        transcript:           transcript,
        evaluation:           evaluation,
        overall_score:        evaluation.overallScore,
        recommendation:       evaluation.recommendation,
        communication_score:  evaluation.communicationScore,
        technical_score:      evaluation.technicalScore,
        cultural_fit_score:   evaluation.culturalFitScore,
        strengths:            evaluation.strengths,
        areas_for_improvement: evaluation.areasForImprovement,
        question_evaluations: evaluation.questionEvaluations,
        completed_at:         completedIso,
      }, { onConflict: 'application_id,round_id' })

    if (insertError) {
      console.error('[interview-callback] insert error:', insertError)
    }

    // 3. Update session status ────────────────────────────────────────────────
    await supabase
      .from('interview_sessions')
      .update({ status: 'completed', completed_at: completedIso })
      .eq('application_id', applicationId)
      .eq('round_id', roundId)

    // 4. Auto-advance application stage ──────────────────────────────────────
    const { data: round } = await supabase
      .from('interview_rounds')
      .select('pass_score_threshold')
      .eq('id', roundId)
      .single()

    const threshold  = round?.pass_score_threshold ?? 65
    const passed     = evaluation.overallScore >= threshold
    const newStage   = passed ? 'interview_passed' : 'interview_failed'

    await supabase
      .from('applications')
      .update({
        current_stage: newStage,
        ai_score:      evaluation.overallScore,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', applicationId)

    console.log(
      `[interview-callback] applicationId=${applicationId} ` +
      `score=${evaluation.overallScore}/${threshold} ` +
      `recommendation=${evaluation.recommendation} ` +
      `→ stage=${newStage}`
    )

    return NextResponse.json({ success: true, stage: newStage })

  } catch (error: any) {
    console.error('[interview-callback] Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
