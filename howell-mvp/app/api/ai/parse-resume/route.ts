/**
 * POST /api/ai/parse-resume
 *
 * Accepts either:
 *   - JSON body: { resumeText: string }
 *   - FormData:  resume = File (pdf / txt / docx)
 *
 * Calls Claude API to extract structured candidate data.
 * Falls back to mock if no ANTHROPIC_API_KEY is set.
 */
import { NextRequest, NextResponse } from 'next/server'
import { mockParseResume } from '@/lib/ai-mock'

export const dynamic = 'force-dynamic'

/** Best-effort text extraction from a file buffer */
async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext    = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'txt') {
    // Plain text — direct decode
    return buffer.toString('utf-8')
  }

  if (ext === 'pdf') {
    // PDFs embed readable text — extract printable ASCII / UTF-8 runs
    const raw = buffer.toString('latin1')
    // Pull strings from inside PDF text objects (BT ... ET blocks)
    const blocks: string[] = []
    const btEt = /BT([\s\S]*?)ET/g
    let m: RegExpExecArray | null
    while ((m = btEt.exec(raw)) !== null) {
      // Extract content inside parentheses (PDF string literals)
      const inner = m[1]
      const strRe = /\(([^)]{1,300})\)/g
      let sm: RegExpExecArray | null
      while ((sm = strRe.exec(inner)) !== null) {
        const chunk = sm[1].replace(/\\[nrt\\()]/g, ' ').trim()
        if (chunk.length > 2) blocks.push(chunk)
      }
    }
    if (blocks.length > 0) return blocks.join(' ')

    // Fallback: extract any long runs of printable ASCII
    const printable = raw.match(/[ -~\t\n\r]{6,}/g) ?? []
    return printable.filter(s => s.trim().length > 5).join(' ').slice(0, 6000)
  }

  // For docx and other formats, try UTF-8 decode and grab readable runs
  const raw = buffer.toString('utf-8', 0, buffer.length)
  const printable = raw.match(/[\w\s@.,\-:;()+]{8,}/g) ?? []
  return printable.join(' ').slice(0, 6000)
}

export async function POST(req: NextRequest) {
  try {
    let resumeText = ''
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      // File upload path
      const form = await req.formData()
      const file = form.get('resume') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      resumeText = await extractText(file)
    } else {
      // JSON path (backward-compatible)
      const body = await req.json()
      resumeText = body.resumeText ?? ''
    }

    if (!resumeText || resumeText.trim().length < 20) {
      return NextResponse.json({ error: 'Could not extract enough text from the file. Try a text-based PDF or a .txt file.' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
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

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      const mock = await mockParseResume()
      return NextResponse.json({ ...mock, source: 'mock_fallback' })
    }

    const parsed = JSON.parse(jsonMatch[0])

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
