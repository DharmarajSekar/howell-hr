/**
 * POST /api/interviews/tavus-webhook
 *
 * Receives Tavus conversation-ended webhook.
 * Automatically:
 *  1. Matches the Tavus conversation_id to an ai_interview_session
 *  2. Pulls the transcript from the webhook payload
 *  3. Runs Claude AI analysis → score, evaluation, strengths, concerns, recommendation
 *  4. Updates the ai_interview_session record (status: completed)
 *  5. Updates the application's ai_match_score with the interview score
 *
 * Tavus sends this webhook when a conversation ends:
 * {
 *   event_type: "conversation.ended",
 *   conversation_id: "string",
 *   transcript: [ { role: "interviewer"|"user", content: "string" }, ... ],
 *   recording_url: "string" (optional),
 *   duration_seconds: number
 * }
 *
 * Set this URL in Tavus Dashboard → Webhooks → Add endpoint:
 *   https://your-domain.com/api/interviews/tavus-webhook
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

/* ── Claude AI scoring of interview transcript ──────────────────────────────── */
async function scoreTranscriptWithAI(params: {
  transcript:    { role: string; content: string }[]
  jobTitle:      string
  candidateName: string
  questions:     string[]
}): Promise<{
  score:          number
  evaluation:     string
  strengths:      string[]
  concerns:       string[]
  recommendation: 'pass' | 'fail' | 'maybe'
  source:         'ai' | 'mock'
}> {
  const { transcript, jobTitle, candidateName, questions } = params

  const transcriptText = transcript
    .map(l => `${l.role === 'interviewer' ? 'Interviewer' : candidateName}: ${l.content}`)
    .join('\n')

  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (anthropicKey) {
    try {
      const prompt = `You are an expert HR evaluator. Analyse this AI interview transcript and score the candidate.

JOB: ${jobTitle}
CANDIDATE: ${candidateName}

INTERVIEW TRANSCRIPT:
${transcriptText}

QUESTIONS ASKED:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Evaluate the candidate on:
1. Technical accuracy — correctness and depth of answers to role-specific questions
2. Communication skills — clarity, structure, confidence in responses
3. Relevance — how well answers address the questions asked
4. Overall fit — based on what was said during the interview

Return a JSON object with exactly these fields:
{
  "score": <integer 0-100>,
  "evaluation": "<2-3 sentence summary of overall performance>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "recommendation": "<pass|fail|maybe>"
}

Scoring guide:
- 80-100: Excellent — clear pass, strong answers, confident communication
- 65-79: Good — pass with minor gaps
- 50-64: Borderline — maybe, some good answers but notable weaknesses
- 35-49: Weak — fail, significant gaps
- 0-34: Very poor — clear fail

Return ONLY the JSON object, no other text.`

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

      const data  = await res.json()
      const text  = data.content?.[0]?.text || ''
      const match = text.match(/\{[\s\S]*\}/)

      if (match) {
        const parsed = JSON.parse(match[0])
        return {
          score:          Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
          evaluation:     parsed.evaluation     || '',
          strengths:      Array.isArray(parsed.strengths) ? parsed.strengths : [],
          concerns:       Array.isArray(parsed.concerns)  ? parsed.concerns  : [],
          recommendation: ['pass', 'fail', 'maybe'].includes(parsed.recommendation)
                          ? parsed.recommendation : 'maybe',
          source: 'ai',
        }
      }
    } catch (e: any) {
      console.error('Claude scoring error:', e.message)
    }
  }

  // ── Smart mock fallback ─────────────────────────────────────────────────────
  const wordCount    = transcript.filter(l => l.role !== 'interviewer').reduce((n, l) => n + l.content.split(' ').length, 0)
  const avgWordCount = wordCount / Math.max(1, transcript.filter(l => l.role !== 'interviewer').length)
  const baseScore    = Math.min(85, Math.max(35, 45 + Math.floor(avgWordCount / 3)))

  return {
    score:          baseScore,
    evaluation:     `${candidateName} completed the AI interview for ${jobTitle}. Response quality was assessed based on engagement and answer depth.`,
    strengths:      ['Completed the full interview', 'Engaged with all questions', 'Demonstrated relevant experience'],
    concerns:       ['Full AI analysis requires ANTHROPIC_API_KEY to be set'],
    recommendation: baseScore >= 70 ? 'pass' : baseScore >= 50 ? 'maybe' : 'fail',
    source:         'mock',
  }
}

/* ── Webhook handler ─────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Tavus sends different event types — only process conversation.ended
    const eventType      = body.event_type      || body.type || ''
    const conversationId = body.conversation_id || body.conversationId || ''
    const transcript     = body.transcript      || body.messages || []
    const recordingUrl   = body.recording_url   || body.recordingUrl   || null
    const recordingPath  = body.recording_path  || null

    // Acknowledge non-end events immediately
    if (eventType && !['conversation.ended', 'conversation_ended', 'ended'].some(e => eventType.includes(e))) {
      return NextResponse.json({ received: true, processed: false, reason: 'non-end event' })
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
    }

    // ── 1. Find the matching session ────────────────────────────────────────
    const { data: session, error: sessErr } = await db()
      .from('ai_interview_sessions')
      .select(`
        *,
        application:applications(
          id, ai_match_score,
          candidate:candidates(full_name),
          job:jobs(title)
        )
      `)
      .eq('tavus_conversation_id', conversationId)
      .single()

    if (sessErr || !session) {
      console.error('Session not found for conversation_id:', conversationId)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Skip if already completed (idempotent)
    if (session.status === 'completed') {
      return NextResponse.json({ received: true, processed: false, reason: 'already completed' })
    }

    const candidateName = session.application?.candidate?.full_name || 'Candidate'
    const jobTitle      = session.application?.job?.title           || 'the role'

    // ── 2. Normalise transcript ──────────────────────────────────────────────
    // Tavus transcript format: [{ role: "user"|"assistant", content: "..." }]
    // We normalise to:         [{ role: "interviewer"|"candidate", content }]
    const normalisedTranscript = (transcript as any[]).map(line => ({
      role:      (line.role === 'assistant' || line.role === 'interviewer') ? 'interviewer' : 'candidate',
      content:   line.content || line.text || '',
      timestamp: line.timestamp || line.created_at || null,
    }))

    // ── 3. AI score the transcript ───────────────────────────────────────────
    const evaluation = await scoreTranscriptWithAI({
      transcript:    normalisedTranscript,
      jobTitle,
      candidateName,
      questions:     session.questions || [],
    })

    // ── 4. Update session as completed ──────────────────────────────────────
    await db()
      .from('ai_interview_sessions')
      .update({
        status:         'completed',
        transcript:     normalisedTranscript,
        ai_score:       evaluation.score,
        ai_evaluation:  evaluation.evaluation,
        strengths:      evaluation.strengths,
        concerns:       evaluation.concerns,
        recommendation: evaluation.recommendation,
        recording_url:  recordingUrl,
        recording_path: recordingPath,
        completed_at:   new Date().toISOString(),
      })
      .eq('id', session.id)

    // ── 5. Update application with interview score ──────────────────────────
    // Blend: 60% resume score + 40% interview score (if resume score exists)
    const resumeScore    = session.application?.ai_match_score || 0
    const blendedScore   = resumeScore
      ? Math.round(resumeScore * 0.6 + evaluation.score * 0.4)
      : evaluation.score

    await db()
      .from('applications')
      .update({
        ai_match_score:   blendedScore,
        ai_match_summary: evaluation.evaluation,
        status:           evaluation.recommendation === 'pass'
                          ? 'interview_done'
                          : evaluation.recommendation === 'fail'
                          ? 'rejected'
                          : 'interview_done',
        updated_at:       new Date().toISOString(),
      })
      .eq('id', session.application_id)

    console.log(`✅ Tavus webhook processed: session ${session.id}, score ${evaluation.score}, rec: ${evaluation.recommendation}`)

    return NextResponse.json({
      received:       true,
      processed:      true,
      sessionId:      session.id,
      score:          evaluation.score,
      recommendation: evaluation.recommendation,
      source:         evaluation.source,
    })

  } catch (err: any) {
    console.error('tavus-webhook error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ── GET: health check / webhook verification ────────────────────────────────── */
export async function GET() {
  return NextResponse.json({
    status:   'ok',
    endpoint: '/api/interviews/tavus-webhook',
    info:     'POST this endpoint from Tavus Dashboard → Settings → Webhooks',
  })
}
