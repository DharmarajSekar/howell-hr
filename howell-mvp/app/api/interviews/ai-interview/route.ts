/**
 * AI Interview conversation engine (Gemini-powered)
 *
 * GET  /api/interviews/ai-interview?applicationId=X&roundId=Y
 *      → Load candidate info + questions, create ai_session record
 *      → { candidateName, jobTitle, questions, sessionId }
 *
 * POST /api/interviews/ai-interview
 *      → Evaluate candidate answer, return next bot speech + score
 *      Body: { candidateName, jobTitle, questions[], questionIndex,
 *              candidateAnswer, scores[], sessionId }
 *      → { speech, score, signal, avgScore, nextQuestionIndex, isComplete }
 *
 * PATCH /api/interviews/ai-interview
 *      → Save final interview result to DB
 *      Body: { sessionId, transcript[], avgScore, evaluation{} }
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

/* ── Helpers ─────────────────────────────────────────────────────────────── */

async function callAI(prompt: string, maxTokens = 400) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }),
    }
  )
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

function avg(arr: number[]) {
  if (!arr.length) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

/* ── GET: Load interview data ────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const applicationId = searchParams.get('applicationId')
    const roundId       = searchParams.get('roundId')

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    // Load application → candidate + job
    const { data: app, error: appErr } = await db()
      .from('applications')
      .select(`
        id,
        candidate:candidates ( full_name, email, current_title ),
        job:jobs ( id, title )
      `)
      .eq('id', applicationId)
      .single()

    if (appErr || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const candidate = (app as any).candidate
    const job       = (app as any).job

    // Load questions from interview_rounds if roundId provided
    let questions: string[] = []
    if (roundId) {
      const { data: round } = await db()
        .from('interview_rounds')
        .select('questions, question_set, config')
        .eq('id', roundId)
        .maybeSingle()

      if (round) {
        // Try different column names depending on your schema
        questions =
          round.questions ||
          round.question_set ||
          (round.config as any)?.questions ||
          []
      }
    }

    // Fallback: generate 6 general questions with Gemini if none found
    if (!questions.length) {
      const raw = await callAI(
        `Generate 6 professional interview questions for a ${job?.title ?? 'the role'} position.
Return ONLY a JSON array of strings: ["Q1?","Q2?","Q3?","Q4?","Q5?","Q6?"]`,
        300
      )
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        try { questions = JSON.parse(match[0]) } catch { /* ignore */ }
      }
      if (!questions.length) {
        questions = [
          `Tell me about your background and why you're interested in this ${job?.title} role.`,
          'Describe a challenging project you led. What was the outcome?',
          'How do you handle competing priorities when everything feels urgent?',
          'Give an example of a time you had to learn something new quickly.',
          'Tell me about a conflict with a colleague and how you resolved it.',
          'Where do you see yourself in 3 years?',
        ]
      }
    }

    // Create an ai_session record to track this interview
    const { data: session, error: sessErr } = await db()
      .from('ai_sessions')
      .insert({
        application_id: applicationId,
        status:         'in_progress',
        scheduled_at:   new Date().toISOString(),
      })
      .select('id')
      .single()

    if (sessErr) {
      console.error('Session insert error:', sessErr.message)
    }

    return NextResponse.json({
      sessionId:     session?.id ?? null,
      candidateName: candidate?.full_name ?? 'Candidate',
      jobTitle:      job?.title           ?? 'the role',
      questions,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ── POST: Process candidate answer, return next bot speech ─────────────── */

export async function POST(req: NextRequest) {
  try {
    const {
      candidateName,
      jobTitle,
      questions,
      questionIndex,
      candidateAnswer,
      scores = [],
    }: {
      candidateName:   string
      jobTitle:        string
      questions:       string[]
      questionIndex:   number
      candidateAnswer: string | null
      scores:          number[]
    } = await req.json()

    const totalQuestions = questions.length
    const isOpening      = questionIndex === 0 && !candidateAnswer
    const isLastQuestion = questionIndex >= totalQuestions - 1
    const currentQ       = questions[questionIndex] ?? ''
    const nextQ          = questions[questionIndex + 1] ?? ''

    /* ── Opening greeting ─────────────────────────────────────────────── */
    if (isOpening) {
      const speech = await callAI(
        `You are Alex, a warm professional AI interviewer at HOWELL HR.
Greet ${candidateName} briefly (2 sentences), explain this is an AI-assisted interview for the ${jobTitle} role,
then immediately ask: "${currentQ}"
Be natural and friendly. Max 60 words total.`,
        200
      )
      return NextResponse.json({
        speech:            speech.trim(),
        score:             null,
        signal:            null,
        avgScore:          null,
        nextQuestionIndex: 0,
        isComplete:        false,
      })
    }

    /* ── Score answer + generate next speech ──────────────────────────── */
    const prompt = `You are Alex, an AI interviewer. Evaluate this interview answer strictly.

ROLE: ${jobTitle}
CANDIDATE: ${candidateName}
QUESTION ${questionIndex + 1}/${totalQuestions}: "${currentQ}"
ANSWER: "${candidateAnswer}"

${isLastQuestion
  ? 'This is the LAST question. After acknowledging the answer, wrap up warmly and thank the candidate.'
  : `After acknowledging the answer, transition to the NEXT question: "${nextQ}"`
}

Return ONLY valid JSON (no extra text):
{
  "score": 78,
  "signal": "Good",
  "speech": "${isLastQuestion
    ? 'Thank you so much for that answer, [name]. That wraps up our interview today...'
    : 'That is a great point. [brief acknowledgment]. My next question is: [next question]'
  }",
  "isComplete": ${isLastQuestion}
}

signal must be one of: Strong | Good | Neutral | Weak | Poor
speech must be natural spoken language, max 60 words.`

    const raw   = await callAI(prompt, 400)
    const match = raw.match(/\{[\s\S]*?\}/)

    let parsed: any = null
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch { /* ignore */ }
    }

    if (!parsed) {
      // Graceful fallback
      parsed = {
        score:      50,
        signal:     'Neutral',
        speech:     isLastQuestion
          ? `Thank you for sharing that, ${candidateName}. That concludes our interview today. We'll be in touch soon.`
          : `Thank you. Let's move on — ${nextQ}`,
        isComplete: isLastQuestion,
      }
    }

    const newScores  = [...scores, parsed.score]
    const avgScore   = avg(newScores)

    return NextResponse.json({
      speech:            parsed.speech,
      score:             parsed.score,
      signal:            parsed.signal,
      avgScore,
      nextQuestionIndex: parsed.isComplete ? questionIndex : questionIndex + 1,
      isComplete:        parsed.isComplete ?? isLastQuestion,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/* ── PATCH: Save final interview to DB ───────────────────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, transcript, avgScore, candidateName, jobTitle } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    // Generate final evaluation
    const transcriptText = (transcript as any[])
      .map((t: any) => `${t.role === 'candidate' ? 'CANDIDATE' : 'INTERVIEWER'}: ${t.text}`)
      .join('\n')

    let evaluation: any = {}
    try {
      const raw = await callAI(
        `Summarise this interview for the hiring team. Role: ${jobTitle}, Candidate: ${candidateName}.
Average score: ${avgScore}/100.

TRANSCRIPT:
${transcriptText.slice(0, 4000)}

Return JSON: {
  "summary": "2-3 sentence summary",
  "strengths": ["strength1","strength2"],
  "concerns": ["concern1","concern2"],
  "recommendation": "Strong Hire|Hire|Consider|Reject"
}`,
        500
      )
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) evaluation = JSON.parse(m[0])
    } catch { /* ignore */ }

    // Save to ai_sessions
    await db()
      .from('ai_sessions')
      .update({
        status:         'completed',
        transcript,
        ai_score:       avgScore,
        ai_evaluation:  evaluation.summary      ?? '',
        strengths:      evaluation.strengths    ?? [],
        concerns:       evaluation.concerns     ?? [],
        recommendation: evaluation.recommendation === 'Strong Hire' || evaluation.recommendation === 'Hire'
          ? 'pass'
          : evaluation.recommendation === 'Reject'
            ? 'fail'
            : 'maybe',
        completed_at:   new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      })
      .eq('id', sessionId)

    return NextResponse.json({ success: true, evaluation })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
