/**
 * POST /api/offers/benchmark
 * Uses Claude to suggest a market salary benchmark for a given role + location.
 * Body: { role: string, location?: string, experience_years?: number, department?: string }
 * Returns: { min, max, median, notes, optimisation_tips }
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { role, location = 'India', experience_years, department, ctc_offered } = await req.json()

    if (!role) return NextResponse.json({ error: 'role is required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fallback: rule-based estimate
      const base = estimateBase(role)
      return NextResponse.json({
        min:    base * 0.8,
        max:    base * 1.3,
        median: base,
        notes:  `Estimated benchmark for ${role} — install ANTHROPIC_API_KEY for AI-powered market data.`,
        optimisation_tips: [],
      })
    }

    const expNote = experience_years ? `with approximately ${experience_years} years of experience` : ''
    const ctcNote = ctc_offered ? `The planned offer is ₹${ctc_offered} LPA.` : ''

    const prompt = `You are a compensation expert specialising in the Indian job market. Provide a realistic salary benchmark for the following role.

Role: ${role}
Department: ${department || 'Not specified'}
Location: ${location}
${expNote}
${ctcNote}

Respond ONLY with valid JSON in this exact format (no markdown, no backticks, no explanation):
{
  "min": <number in LPA>,
  "max": <number in LPA>,
  "median": <number in LPA>,
  "notes": "<2–3 sentence market commentary>",
  "optimisation_tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

Rules:
- All salary values must be realistic for the Indian market in 2025-2026
- min/max/median must be numbers only (no strings)
- optimisation_tips = 3 actionable suggestions to make the offer more attractive
- If ctc_offered is given, comment on whether it is within / above / below the range in the notes field`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 500,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await res.json()
    const raw    = aiData.content?.[0]?.text?.trim() || ''

    let parsed: any
    try {
      // Strip any accidental markdown fences
      const clean = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      // Fallback if Claude returns non-JSON
      const base = estimateBase(role)
      parsed = {
        min:    Math.round(base * 0.8),
        max:    Math.round(base * 1.3),
        median: base,
        notes:  raw.slice(0, 200) || `Market benchmark for ${role} in ${location}.`,
        optimisation_tips: [],
      }
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** Simple rule-based fallback when no API key */
function estimateBase(role: string): number {
  const r = role.toLowerCase()
  if (r.includes('senior') && r.includes('engineer'))    return 18
  if (r.includes('lead') || r.includes('manager'))       return 22
  if (r.includes('director') || r.includes('vp'))        return 35
  if (r.includes('hr') || r.includes('business partner'))return 20
  if (r.includes('analyst'))                              return 12
  if (r.includes('engineer') || r.includes('developer')) return 14
  return 15
}
