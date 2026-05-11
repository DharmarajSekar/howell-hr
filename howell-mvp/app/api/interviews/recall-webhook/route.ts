/**
 * POST /api/interviews/recall-webhook
 *
 * Receives real-time events from Recall.ai bot:
 *   - bot.transcript.data   → candidate speech → live Claude scoring
 *   - bot.done              → full transcript ready → final score
 *   - bot.status_change     → join / leave events
 *
 * Live score is stored in interviews.live_score and interviews.live_transcript
 * so the AI Room page can poll and display it in real time.
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

// ── Claude live scoring (fast, low-token) ────────────────────────────────────

async function scoreCandidateResponse(params: {
  candidateName:  string
  jobTitle:       string
  question:       string
  answer:         string
  previousScore:  number | null
}): Promise<{ score: number; signal: string; tip: string }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    // Fallback heuristic scoring
    const words      = params.answer.split(' ').length
    const heuristic  = Math.min(100, Math.max(30, words * 1.5))
    return { score: Math.round(heuristic), signal: 'Neutral', tip: 'AI key not configured — heuristic score.' }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role:    'user',
          content: `Score this interview answer 0-100. Be strict and fair.

ROLE: ${params.jobTitle}
CANDIDATE: ${params.candidateName}
QUESTION: ${params.question || '(follow-up)'}
ANSWER: ${params.answer}

Return ONLY valid JSON:
{"score":85,"signal":"Strong","tip":"Good quantified example. Ask about scale next."}

signal must be one of: Strong | Good | Neutral | Weak | Poor
tip is one short coaching sentence for the interviewer (max 12 words).`,
        }],
      }),
    })

    const data  = await res.json()
    const text  = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (typeof parsed.score === 'number') return parsed
    }
  } catch (e: any) {
    console.error('Claude scoring error:', e.message)
  }

  return { score: 50, signal: 'Neutral', tip: 'Could not score — check Claude API.' }
}

// ── Running average helper ────────────────────────────────────────────────────

function computeAverage(scores: number[]): number {
  if (!scores.length) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

// ── Main webhook handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event, data } = body

    console.log('Recall webhook event:', event, 'bot:', data?.bot_id)

    // ── Bot joined the meeting ────────────────────────────────────────────────
    if (event === 'bot.status_change') {
      const status = data?.status?.code || data?.status
      const botId  = data?.bot_id

      if (botId && (status === 'in_call_recording' || status === 'joining_call')) {
        await db()
          .from('interviews')
          .update({ recall_bot_status: status, updated_at: new Date().toISOString() })
          .eq('recall_bot_id', botId)
      }

      return NextResponse.json({ received: true })
    }

    // ── Real-time transcript chunk (fires every few seconds) ──────────────────
    if (event === 'bot.transcript.data') {
      const botId       = data?.bot_id
      const transcript  = data?.transcript      // { speaker, words, is_final, ... }
      const metadata    = data?.metadata || {}

      if (!botId || !transcript) return NextResponse.json({ received: true })

      // Only score when Recall marks this as a final (complete) utterance
      if (!transcript.is_final) return NextResponse.json({ received: true })

      const speaker  = transcript.speaker || ''
      const text     = transcript.words?.map((w: any) => w.text).join(' ').trim() || ''

      if (!text || text.split(' ').length < 5) return NextResponse.json({ received: true })

      // Find the interview record by bot_id
      const { data: interview } = await db()
        .from('interviews')
        .select('id, candidate_name, job_title, live_transcript, live_score, live_scores_array')
        .eq('recall_bot_id', botId)
        .maybeSingle()

      if (!interview) return NextResponse.json({ received: true })

      // Build transcript entry
      const existingTranscript: any[] = interview.live_transcript || []
      const newEntry = {
        speaker,
        text,
        timestamp: new Date().toISOString(),
        is_candidate: !speaker.toLowerCase().includes('bot') && !speaker.toLowerCase().includes('interviewer'),
      }
      const updatedTranscript = [...existingTranscript, newEntry]

      // Only score candidate speech (not bot / interviewer turns)
      if (!newEntry.is_candidate) {
        await db()
          .from('interviews')
          .update({ live_transcript: updatedTranscript, updated_at: new Date().toISOString() })
          .eq('id', interview.id)
        return NextResponse.json({ received: true })
      }

      // Find the most recent interviewer question for context
      const lastQuestion = [...updatedTranscript]
        .reverse()
        .find(t => !t.is_candidate)?.text || ''

      // Score with Claude (fast haiku model, ≈200ms latency)
      const evaluation = await scoreCandidateResponse({
        candidateName: interview.candidate_name || metadata.candidate_name || 'Candidate',
        jobTitle:      interview.job_title      || metadata.job_title      || 'the role',
        question:      lastQuestion,
        answer:        text,
        previousScore: interview.live_score,
      })

      // Update running score array
      const scoresArray: number[] = interview.live_scores_array || []
      scoresArray.push(evaluation.score)
      const avgScore = computeAverage(scoresArray)

      // Save to DB
      await db()
        .from('interviews')
        .update({
          live_transcript:    updatedTranscript,
          live_score:         avgScore,
          live_last_score:    evaluation.score,
          live_last_signal:   evaluation.signal,
          live_last_tip:      evaluation.tip,
          live_scores_array:  scoresArray,
          updated_at:         new Date().toISOString(),
        })
        .eq('id', interview.id)

      return NextResponse.json({ received: true, scored: true, score: evaluation.score })
    }

    // ── Bot finished / meeting ended ─────────────────────────────────────────
    if (event === 'bot.done' || event === 'bot.meeting_ended') {
      const botId = data?.bot_id
      if (!botId) return NextResponse.json({ received: true })

      const { data: interview } = await db()
        .from('interviews')
        .select('id, live_scores_array, candidate_name, job_title, live_transcript')
        .eq('recall_bot_id', botId)
        .maybeSingle()

      if (!interview) return NextResponse.json({ received: true })

      const finalScore = computeAverage(interview.live_scores_array || [])

      // Generate final Claude summary from full transcript
      let finalSummary = ''
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (anthropicKey && interview.live_transcript?.length > 0) {
        try {
          const transcriptText = (interview.live_transcript as any[])
            .map((t: any) => `${t.is_candidate ? 'CANDIDATE' : 'INTERVIEWER'}: ${t.text}`)
            .join('\n')

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 400,
              messages: [{
                role: 'user',
                content: `Summarise this interview for the hiring team in 3 bullet points max.
Role: ${interview.job_title}, Candidate: ${interview.candidate_name}

TRANSCRIPT:
${transcriptText.slice(0, 4000)}

Return JSON: {"summary":"...","strengths":["..."],"gaps":["..."],"recommendation":"Strong Hire|Hire|Consider|Reject"}`,
              }],
            }),
          })
          const d = await res.json()
          const t = d.content?.[0]?.text || ''
          const m = t.match(/\{[\s\S]*\}/)
          if (m) finalSummary = m[0]
        } catch (e: any) {
          console.error('Final summary error:', e.message)
        }
      }

      await db()
        .from('interviews')
        .update({
          live_score:          finalScore,
          recall_bot_status:   'done',
          final_ai_summary:    finalSummary,
          updated_at:          new Date().toISOString(),
        })
        .eq('id', interview.id)

      return NextResponse.json({ received: true, finalScore })
    }

    return NextResponse.json({ received: true })
  } catch (e: any) {
    console.error('recall-webhook error:', e.message)
    // Always return 200 to Recall.ai — retries on non-200
    return NextResponse.json({ received: true, error: e.message })
  }
}
