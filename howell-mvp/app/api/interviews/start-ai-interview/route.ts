/**
 * POST /api/interviews/start-ai-interview
 *
 * One-click: given an applicationId (+ optional roundId),
 * this endpoint:
 *  1. Fetches the candidate + job + pipeline config
 *  2. Picks the right AI round (first active AI round, or provided roundId)
 *  3. Generates personalised questions via AI
 *  4. Creates a Tavus conversation (or mock)
 *  5. Saves the ai_interview_session record
 *  6. Returns { sessionId, sessionUrl, isLive }
 *
 * Used by Candidate Detail page, KanbanBoard, and Approve Queue.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockGenerateInterviewQuestions } from '@/lib/ai-mock'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { applicationId, roundId: providedRoundId } = await req.json()

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
    }

    // ── 1. Fetch application + candidate + job ────────────────
    const { data: application, error: appErr } = await db()
      .from('applications')
      .select(`
        *,
        candidate:candidates(id, full_name, current_title, experience_years, skills, summary, email),
        job:jobs(id, title, description, requirements, department, experience_min, experience_max)
      `)
      .eq('id', applicationId)
      .single()

    if (appErr || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const candidate = application.candidate
    const job       = application.job

    // ── 2. Find pipeline config + AI round ───────────────────
    let round: any = null

    if (providedRoundId) {
      const { data: r } = await db()
        .from('interview_rounds')
        .select('*')
        .eq('id', providedRoundId)
        .single()
      round = r
    } else {
      // Find the first active AI round for this job
      const { data: config } = await db()
        .from('interview_pipeline_configs')
        .select('id')
        .eq('job_id', job.id)
        .single()

      if (config) {
        const { data: rounds } = await db()
          .from('interview_rounds')
          .select('*')
          .eq('config_id', config.id)
          .eq('type', 'ai')
          .eq('is_active', true)
          .order('round_number', { ascending: true })
          .limit(1)

        round = rounds?.[0] || null
      }
    }

    // Fallback: create a virtual round if no config exists
    if (!round) {
      round = {
        id:                         null,
        name:                       'AI Screening Round',
        type:                       'ai',
        round_number:               1,
        tavus_persona_id:           null,
        ai_questions:               [],
        ai_auto_generate_questions: true,
        duration_minutes:           20,
      }
    }

    // ── 3. Check for existing session for this round ─────────
    if (round.id) {
      const { data: existing } = await db()
        .from('ai_interview_sessions')
        .select('id, status, tavus_conversation_url')
        .eq('application_id', applicationId)
        .eq('round_id', round.id)
        .not('status', 'eq', 'cancelled')
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({
          sessionId:  existing[0].id,
          sessionUrl: existing[0].tavus_conversation_url,
          isLive:     !!existing[0].tavus_conversation_url,
          existing:   true,
        })
      }
    }

    // ── 4. Generate personalised questions ───────────────────
    let questions: string[] = round.ai_questions || []

    const shouldGenerate = round.ai_auto_generate_questions !== false
    if (shouldGenerate) {
      try {
        const anthropicKey = process.env.ANTHROPIC_API_KEY

        if (anthropicKey) {
          const prompt = `Generate exactly 7 personalised interview questions for this candidate and job.

JOB: ${job.title} | ${job.department || ''} | ${job.experience_min}-${job.experience_max} years
Requirements: ${job.requirements || job.description || 'Not specified'}

CANDIDATE: ${candidate.full_name} | ${candidate.current_title || 'N/A'} | ${candidate.experience_years || 0} years
Skills: ${(candidate.skills || []).join(', ')}
Summary: ${candidate.summary || 'N/A'}
AI Gaps: ${(application.ai_gaps || []).join(', ') || 'None identified'}

ROUND: ${round.name} (Round ${round.round_number})

Instructions:
- Start with a personalised opener using the candidate's name and background
- 2-3 deep skill-specific questions targeting their listed skills
- 1-2 questions probing identified gaps
- 1 behavioural/situational question for their seniority level
- Close with expectations/availability question

Return ONLY a JSON array of 7 strings. Example: ["Q1?", "Q2?", ...]`

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1024,
              messages: [{ role: 'user', content: prompt }],
            }),
          })
          const data = await res.json()
          const text = data.content?.[0]?.text || ''
          const match = text.match(/\[[\s\S]*\]/)
          if (match) {
            const parsed = JSON.parse(match[0])
            if (Array.isArray(parsed) && parsed.length > 0) questions = parsed
          }
        } else {
          questions = await mockGenerateInterviewQuestions({
            jobTitle:                 job.title,
            jobDescription:           job.description,
            jobRequirements:          job.requirements,
            candidateName:            candidate.full_name,
            candidateTitle:           candidate.current_title || 'Professional',
            candidateExperienceYears: candidate.experience_years || 0,
            candidateSkills:          candidate.skills || [],
            candidateSummary:         candidate.summary,
            roundName:                round.name,
            roundNumber:              round.round_number,
          })
        }
      } catch (e: any) {
        console.error('Question gen error:', e.message)
        // Keep existing questions
      }
    }

    // ── 5. Create Tavus conversation ──────────────────────────
    const tavusKey  = process.env.TAVUS_API_KEY
    const personaId = round.tavus_persona_id || null

    let tavusConversationId:  string | null = null
    let tavusConversationUrl: string | null = null

    if (tavusKey && personaId) {
      try {
        const context = `You are an AI HR interviewer for Howell conducting a ${round.name} for the role of ${job.title}.
The candidate's name is ${candidate.full_name}.
Ask the following questions one by one, listen carefully, and evaluate professionally.

Questions:
${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

After all questions, thank ${candidate.full_name} warmly and end the interview professionally.
Be encouraging, professional, and make the candidate feel comfortable throughout.`.trim()

        const res = await fetch('https://tavusapi.com/v2/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': tavusKey },
          body: JSON.stringify({
            replica_id:             personaId,
            persona_id:             personaId,
            conversation_name:      `${job.title} — ${candidate.full_name} — ${round.name}`,
            conversational_context: context,
            properties: {
              max_call_duration:        3600,
              participant_left_timeout: 60,
              enable_recording:         true,
              enable_transcription:     true,
            },
          }),
        })
        const tavusData = await res.json()
        tavusConversationId  = tavusData.conversation_id || null
        tavusConversationUrl = tavusData.conversation_url || null
      } catch (e: any) {
        console.error('Tavus error:', e.message)
      }
    }

    if (!tavusConversationId) {
      tavusConversationId = `mock-${Date.now()}`
    }

    // ── 6. Save session to DB ─────────────────────────────────
    const { data: session, error: sessErr } = await db()
      .from('ai_interview_sessions')
      .insert({
        application_id:        applicationId,
        round_id:              round.id || null,
        tavus_conversation_id: tavusConversationId,
        tavus_conversation_url: tavusConversationUrl,
        status:                'scheduled',
        scheduled_at:          new Date().toISOString(),
      })
      .select()
      .single()

    if (sessErr) {
      return NextResponse.json({ error: sessErr.message }, { status: 500 })
    }

    // ── 7. Update application status to interview_scheduled ───
    await db()
      .from('applications')
      .update({ status: 'interview_scheduled', updated_at: new Date().toISOString() })
      .eq('id', applicationId)

    return NextResponse.json({
      sessionId:  session.id,
      sessionUrl: tavusConversationUrl,
      isLive:     !!tavusConversationUrl,
      questions,
      existing:   false,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
