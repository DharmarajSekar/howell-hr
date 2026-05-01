/**
 * POST /api/ai/parse-resume
 *
 * Accepts resume text (pasted or extracted from file client-side).
 * Calls Claude API to extract structured candidate data.
 * Falls back to mock if no ANTHROPIC_API_KEY is set.
 *
 * Body: { resumeText: string }
 * Returns: { full_name, email, phone, current_title, current_company,
 *             experience_years, skills, location, salary_expectation, summary }
 */
import { NextRequest, NextResponse } from 'next/server'
import { mockParseResume } from '@/lib/ai-mock'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { resumeText } = await req.json()

    if (!resumeText || resumeText.trim().length < 30) {
      return NextResponse.json({ error: 'Resume text is too short or empty' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fall back to intelligent mock
      const mock = await mockParseResume()
      return NextResponse.json({ ...mock, source: 'mock' })
    }

    const prompt = `You are an expert HR recruiter. Extract structured information from the following resume text.

Return ONLY a valid JSON object with exactly these fields (no markdown, no explanation):
{
  "full_name": "string — candidate's full name",
  "email": "string — email address or empty string",
  "phone": "string — phone number or empty string",
  "current_title": "string — most recent job title",
  "current_company": "string — most recent employer",
  "experience_years": number — total years of work experience (integer),
  "skills": ["array", "of", "skill", "strings"] — max 12 key technical/professional skills,
  "location": "string — city/state they are based in or empty string",
  "salary_expectation": number — expected salary in LPA (Indian rupee lakhs per annum) or 0 if not mentioned,
  "summary": "string — a 2-sentence AI summary of this candidate's background and strengths"
}

Resume text:
---
${resumeText.slice(0, 4000)}
---`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':        'application/json',
        'x-api-key':           apiKey,
        'anthropic-version':   '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 800,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const mock = await mockParseResume()
      return NextResponse.json({ ...mock, source: 'mock_fallback' })
    }

    const aiData = await response.json()
    const text   = aiData.content?.[0]?.text || ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      const mock = await mockParseResume()
      return NextResponse.json({ ...mock, source: 'mock_fallback' })
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Sanitise fields
    return NextResponse.json({
      full_name:          parsed.full_name          || 'Unknown',
      email:              parsed.email               || '',
      phone:              parsed.phone               || '',
      current_title:      parsed.current_title       || '',
      current_company:    parsed.current_company     || '',
      experience_years:   parseInt(parsed.experience_years) || 0,
      skills:             Array.isArray(parsed.skills) ? parsed.skills.slice(0, 12) : [],
      location:           parsed.location            || '',
      salary_expectation: parseFloat(parsed.salary_expectation) || 0,
      summary:            parsed.summary             || '',
      source:             'ai',
    })

  } catch (err: any) {
    console.error('parse-resume error:', err.message)
    const mock = await mockParseResume()
    return NextResponse.json({ ...mock, source: 'mock_error' })
  }
}
