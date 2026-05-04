/**
 * POST /api/onboarding/feedback   — submit Day-30/60/90 check-in feedback
 * GET  /api/onboarding/feedback   — list all feedback (with AI sentiment)
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function analyzeSentiment(responses: Record<string, any>): Promise<{
  sentiment: 'positive' | 'neutral' | 'at_risk';
  risk_score: number;
  summary: string;
  flags: string[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  const responsesText = Object.entries(responses)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join('\n\n')

  if (!apiKey) {
    // Simple fallback based on numeric scores
    const scores = Object.values(responses).filter(v => typeof v === 'number') as number[]
    const avg    = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 3
    const risk_score = avg < 2.5 ? 75 : avg < 3.5 ? 40 : 15
    return {
      sentiment:  risk_score > 60 ? 'at_risk' : risk_score > 30 ? 'neutral' : 'positive',
      risk_score,
      summary:    'Feedback analysis based on rating scores.',
      flags:      risk_score > 60 ? ['Low satisfaction scores'] : [],
    }
  }

  try {
    const prompt = `You are an HR analyst. Analyse this new joiner feedback and return a JSON risk assessment.

Feedback responses:
${responsesText}

Return ONLY valid JSON — no markdown, no extra text:
{
  "sentiment": "positive" | "neutral" | "at_risk",
  "risk_score": <number 0–100, higher = more at risk of dissatisfaction/attrition>,
  "summary": "<1–2 sentence plain English summary of the employee's onboarding experience>",
  "flags": ["<specific concern if any>"]
}

Risk scoring guide:
- 0–30: positive experience, low attrition risk
- 31–60: some concerns, monitor closely
- 61–100: at risk, intervention recommended`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 300,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })
    const aiData = await res.json()
    const raw    = aiData.content?.[0]?.text?.trim() || ''
    const clean  = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    if (parsed.sentiment && typeof parsed.risk_score === 'number') return parsed
  } catch {}

  return { sentiment: 'neutral', risk_score: 40, summary: 'Feedback received. Analysis pending.', flags: [] }
}

export async function GET() {
  try {
    const { data, error } = await svc()
      .from('onboarding_feedback')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      onboarding_record_id,
      employee_name,
      employee_id,
      check_in_day,   // 30 | 60 | 90
      responses,      // { question: answer }
    } = body

    if (!onboarding_record_id || !responses || !check_in_day) {
      return NextResponse.json({ error: 'onboarding_record_id, check_in_day, and responses are required' }, { status: 400 })
    }

    // Run AI sentiment analysis
    const analysis = await analyzeSentiment(responses)

    // Save feedback
    const { data, error } = await svc()
      .from('onboarding_feedback')
      .insert({
        onboarding_record_id,
        employee_name,
        employee_id,
        check_in_day,
        responses,
        sentiment:    analysis.sentiment,
        risk_score:   analysis.risk_score,
        ai_summary:   analysis.summary,
        flags:        analysis.flags,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fire risk alert if at_risk
    if (analysis.sentiment === 'at_risk' || analysis.risk_score > 60) {
      await svc()
        .from('notifications')
        .insert({
          type:        'onboarding_risk_alert',
          title:       `Onboarding Risk Alert — ${employee_name}`,
          message:     `Day-${check_in_day} check-in flagged: ${analysis.summary} Flags: ${analysis.flags.join(', ') || 'None'}`,
          severity:    'warning',
          entity_id:   onboarding_record_id,
          entity_type: 'onboarding_record',
          status:      'sent',
          sent_at:     new Date().toISOString(),
        })
    }

    return NextResponse.json({ ...data, analysis }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
