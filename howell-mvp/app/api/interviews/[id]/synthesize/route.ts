/**
 * POST /api/interviews/[id]/synthesize
 * Uses Claude to synthesize all structured interviewer feedback
 * for a given interview into a concise summary for HR.
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Fetch the interview with application/candidate/job
    const { data: iv, error: ivErr } = await db()
      .from('interviews')
      .select('*, application:applications(*, candidate:candidates(*), job:jobs(*))')
      .eq('id', params.id)
      .single()

    if (ivErr || !iv) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })

    const candidate = iv.application?.candidate
    const job       = iv.application?.job

    // Parse structured feedback
    let feedbackData: any = {}
    try { feedbackData = JSON.parse(iv.feedback || '{}') } catch {}

    const { categories = {}, recommendation, comments, interviewer } = feedbackData
    const categoryLines = Object.entries(categories as Record<string, number>)
      .map(([k, v]) => `  • ${k.replace(/_/g, ' ')}: ${v}/5`)
      .join('\n')

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({
        summary: `${candidate?.full_name} demonstrated ${iv.rating && iv.rating >= 4 ? 'strong' : 'moderate'} performance. Recommendation: ${recommendation || 'hold'}. ${comments || ''}`.trim(),
        synthesized: false,
      })
    }

    const prompt = `You are an HR assistant. Synthesize this interview feedback into a concise, professional 3-4 sentence summary for the hiring team.

Candidate: ${candidate?.full_name || 'N/A'} | Role: ${job?.title || 'N/A'}
Interviewer: ${interviewer || 'HR'}
Overall rating: ${iv.rating}/5

Category scores:
${categoryLines || '  • No categories rated'}

Interviewer comments: "${comments || 'No comments provided'}"
Recommendation: ${recommendation || 'hold'}

Write a summary that:
- Highlights key strengths and any concerns
- States the interviewer's recommendation clearly
- Is objective, professional, and HR-appropriate
- Is 3-4 sentences max

Return ONLY the summary text, no labels or prefixes.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await res.json()
    const summary = aiData.content?.[0]?.text?.trim() || 'Could not generate summary.'

    // Save the AI summary back to the feedback JSON
    try {
      feedbackData.ai_summary = summary
      await db()
        .from('interviews')
        .update({ feedback: JSON.stringify(feedbackData) })
        .eq('id', params.id)
    } catch {}

    return NextResponse.json({ summary, synthesized: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
