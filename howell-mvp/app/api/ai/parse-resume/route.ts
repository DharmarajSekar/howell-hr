/**
 * POST /api/ai/parse-resume
 *
 * Accepts either:
 *   - JSON body:  { resumeText: string }
 *   - FormData:   resume = File  (pdf / txt / docx)
 *
 * If ANTHROPIC_API_KEY is set → Claude does the extraction (best quality).
 * If not set → local regex heuristics extract real data from the file text.
 *   Never falls back to hardcoded mock data — always returns what is in the file.
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/* ── Text extraction from uploaded file ─────────────────────────────────────── */
async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext    = (file.name.split('.').pop() ?? '').toLowerCase()

  if (ext === 'txt') {
    return buffer.toString('utf-8')
  }

  if (ext === 'pdf') {
    const raw = buffer.toString('latin1')

    // Pull strings from inside PDF text objects (BT … ET blocks)
    const blocks: string[] = []
    const btEt = /BT([\s\S]*?)ET/g
    let m: RegExpExecArray | null
    while ((m = btEt.exec(raw)) !== null) {
      const inner = m[1]
      // PDF string literals: ( … )
      const strRe = /\(([^)]{1,300})\)/g
      let sm: RegExpExecArray | null
      while ((sm = strRe.exec(inner)) !== null) {
        const chunk = sm[1].replace(/\\[nrt\\()]/g, ' ').trim()
        if (chunk.length > 2) blocks.push(chunk)
      }
    }
    if (blocks.length >= 5) return blocks.join(' ')

    // Fallback: grab long printable-ASCII runs
    const printable = raw.match(/[ -~\t\n\r]{6,}/g) ?? []
    return printable.filter(s => s.trim().length > 5).join(' ')
  }

  // docx / doc — grab readable UTF-8 runs
  const raw = buffer.toString('utf-8', 0, buffer.length)
  const printable = raw.match(/[\w\s@.,\-:;()+]{8,}/g) ?? []
  return printable.join(' ')
}

/* ── Heuristic parser (no API key required) ─────────────────────────────────── */
function heuristicParse(text: string) {
  const t = text.replace(/\s+/g, ' ')

  // Email
  const email = (t.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i) ?? [])[0] ?? ''

  // Phone — Indian / international formats
  const phone = (t.match(/(?:\+?\d[\d\s\-().]{8,14}\d)/)?.[0] ?? '').trim()

  // Name — first line that looks like "Firstname Lastname" (capitalised, 2-4 words)
  const nameLine = t.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})\b/)
  const full_name = nameLine?.[1] ?? ''

  // Location — common city names
  const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai',
    'Kolkata', 'Ahmedabad', 'Noida', 'Gurugram', 'Gurgaon', 'Kochi', 'Jaipur',
    'Dubai', 'Abu Dhabi', 'Riyadh', 'Doha', 'Singapore', 'London', 'New York']
  const location = CITIES.find(c => new RegExp(`\\b${c}\\b`, 'i').test(t)) ?? ''

  // Experience years — look for "X years" / "X+ years"
  const expMatch = t.match(/(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s*of)?(?:\s*experience)?/i)
  const experience_years = expMatch ? parseInt(expMatch[1]) : 0

  // Current title — look after common resume headings
  const titleMatch = t.match(
    /(?:current\s+(?:title|position|role)|designation|working\s+as|position)\s*[:\-–]?\s*([A-Z][^\n.]{3,60})/i
  )
  let current_title = titleMatch?.[1]?.trim() ?? ''
  // Fallback: look for known seniority words
  if (!current_title) {
    const seniorityMatch = t.match(
      /\b((?:Senior|Junior|Lead|Principal|Staff|Associate)?\s*(?:Software|Data|DevOps|Full[\s-]?Stack|Backend|Frontend|Product|HR|Talent|ELV|MEP|Civil|Mechanical|Electrical|Site|Project)?\s*(?:Engineer|Developer|Manager|Analyst|Consultant|Architect|Designer|Specialist|Officer))\b/i
    )
    current_title = seniorityMatch?.[1]?.trim() ?? ''
  }

  // Current company — look after "at", "company:", common patterns
  const compMatch = t.match(
    /(?:at|company\s*[:\-–]|employer\s*[:\-–]|working\s+at|employed\s+(?:at|by))\s+([A-Z][A-Za-z0-9\s&.,]{2,40})/i
  )
  const current_company = compMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? ''

  // Skills — common tech keywords
  const SKILL_PATTERNS = [
    // Programming / frameworks
    'JavaScript','TypeScript','Python','Java','C#','C\\+\\+','Go','Rust','Ruby','PHP','Swift','Kotlin',
    'React','Angular','Vue','Node\\.js','Express','Django','Flask','Spring Boot','Laravel',
    'AWS','Azure','GCP','Docker','Kubernetes','Terraform','CI/CD','Jenkins','GitHub Actions',
    // Data
    'SQL','PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','Tableau','Power BI','Excel','Pandas','Spark',
    // HR / ops
    'SAP','Workday','Salesforce','Jira','Confluence','Agile','Scrum','PMP',
    // ELV / engineering
    'CCTV','Access Control','BMS','AutoCAD','Revit','AutoCAD MEP','Honeywell','Bosch','Hikvision',
    'Structured Cabling','Fire Alarm','PA System','HVAC','MEP','ELV','IBMS',
    // Generic professional
    'Project Management','Stakeholder Management','Team Leadership','Communication',
  ]
  const skills: string[] = []
  for (const skill of SKILL_PATTERNS) {
    if (new RegExp(`\\b${skill}\\b`, 'i').test(t) && skills.length < 12) {
      skills.push(skill.replace(/\\/g, ''))
    }
  }

  // Salary expectation — look for CTC / LPA / salary figures
  const salaryMatch = t.match(/(?:expected\s+(?:ctc|salary)|ctc\s+expectation|salary\s+expectation)\s*[:\-–]?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\.?p\.?a)?/i)
    ?? t.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?\s+per\s+annum)/i)
  const salary_expectation = salaryMatch ? parseFloat(salaryMatch[1]) : 0

  // Summary — take the first longish sentence-like block as a summary base
  const sentences = t.match(/[A-Z][^.!?]{30,200}[.!?]/g) ?? []
  const summary = sentences.slice(0, 2).join(' ').slice(0, 300)

  return {
    full_name,
    email,
    phone,
    current_title,
    current_company,
    experience_years,
    skills,
    location,
    salary_expectation,
    summary: summary || `Professional with experience in ${skills.slice(0, 3).join(', ') || 'their field'}.`,
    source: 'heuristic',
  }
}

/* ── Claude-powered parser ──────────────────────────────────────────────────── */
async function claudeParse(resumeText: string, apiKey: string) {
  const prompt = `You are an expert HR recruiter. Extract structured information from the following resume text.

Return ONLY a valid JSON object with exactly these fields (no markdown, no explanation):
{
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "current_title": "string",
  "current_company": "string",
  "experience_years": number,
  "skills": ["array","of","strings"],
  "location": "string",
  "salary_expectation": number,
  "summary": "string — 2 sentences summarising the candidate"
}

Resume text:
---
${resumeText.slice(0, 4000)}
---`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-3-haiku-20240307',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) return null

  const aiData = await response.json()
  const text   = aiData.content?.[0]?.text ?? ''
  const match  = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  const p = JSON.parse(match[0])
  return {
    full_name:          p.full_name          ?? '',
    email:              p.email              ?? '',
    phone:              p.phone              ?? '',
    current_title:      p.current_title      ?? '',
    current_company:    p.current_company    ?? '',
    experience_years:   parseInt(p.experience_years)   || 0,
    skills:             Array.isArray(p.skills) ? p.skills.slice(0, 12) : [],
    location:           p.location           ?? '',
    salary_expectation: parseFloat(p.salary_expectation) || 0,
    summary:            p.summary            ?? '',
    source:             'ai',
  }
}

/* ── Route handler ──────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    let resumeText = ''
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('resume') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      resumeText = await extractText(file)
    } else {
      const body = await req.json()
      resumeText = body.resumeText ?? ''
    }

    if (!resumeText || resumeText.trim().length < 20) {
      return NextResponse.json(
        { error: 'Could not extract text from the file. Please try a text-based PDF or a .txt file.' },
        { status: 400 }
      )
    }

    // Try Claude first (best quality)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      try {
        const result = await claudeParse(resumeText, apiKey)
        if (result) return NextResponse.json(result)
      } catch (e) {
        console.error('Claude parse failed, falling back to heuristic:', e)
      }
    }

    // Always fall back to heuristic (real data from the file — never hardcoded mock)
    const heuristic = heuristicParse(resumeText)
    return NextResponse.json(heuristic)

  } catch (err: any) {
    console.error('parse-resume error:', err.message)
    return NextResponse.json(
      { error: 'Failed to parse resume. Please fill in your details manually.' },
      { status: 500 }
    )
  }
}
