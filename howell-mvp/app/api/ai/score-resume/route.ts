/**
 * POST /api/ai/score-resume
 *
 * Evaluates a candidate against a job opening.
 * 1. Runs hard eligibility checks (experience, salary, location)
 * 2. Calls Claude API to score resume vs JD (or falls back to smart mock)
 * 3. Returns structured result used by the screening pipeline
 *
 * Body: {
 *   jobId?, jobTitle, jobDescription?, jobRequirements?, jobSkills?,
 *   jobExperienceMin?, jobExperienceMax?, jobSalaryMin?, jobSalaryMax?, jobLocation?,
 *   candidateName, candidateTitle?, candidateSkills?, candidateExperienceYears?,
 *   candidateSalaryExpectation?, candidateLocation?, candidateSummary?
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { mockScoreResume } from '@/lib/ai-mock'

export const dynamic = 'force-dynamic'

// ── Eligibility helpers ───────────────────────────────────────
function checkExperience(years: number, min: number, max: number) {
  if (!min && !max) return { pass: true, detail: 'No experience requirement set' }
  if (years < min)  return { pass: false, detail: `${years} yrs experience is below the minimum ${min} yrs required` }
  if (max && years > max + 5) return { pass: true, detail: `${years} yrs — overqualified but eligible` }
  return { pass: true, detail: `${years} yrs experience meets ${min}–${max} yr requirement` }
}

function checkSalary(expected: number, budgetMin: number, budgetMax: number) {
  if (!expected || (!budgetMin && !budgetMax)) return { pass: true, detail: 'Salary not specified — to confirm in interview' }
  if (budgetMax && expected > budgetMax * 1.15)
    return { pass: false, detail: `Expected ₹${expected}L exceeds budget ceiling ₹${budgetMax}L (>15% over)` }
  if (budgetMin && expected < budgetMin * 0.6)
    return { pass: true, detail: `Expected ₹${expected}L is below budget — confirm interest` }
  return { pass: true, detail: `Expected ₹${expected}L within budget ₹${budgetMin}–${budgetMax}L` }
}

function checkLocation(candidateLoc: string, jobLoc: string) {
  if (!candidateLoc || !jobLoc) return { pass: true, detail: 'Location not specified' }
  const c = candidateLoc.toLowerCase()
  const j = jobLoc.toLowerCase()
  if (j.includes('remote') || j.includes('pan india') || j.includes('multiple')) return { pass: true, detail: 'Remote/flexible role — location not a constraint' }
  // Extract city from location strings like "Mumbai, India"
  const cCity = c.split(',')[0].trim()
  const jCity = j.split(',')[0].trim()
  if (c.includes(jCity) || j.includes(cCity) || cCity === jCity) return { pass: true, detail: `${candidateLoc} matches job location` }
  return { pass: true, detail: `${candidateLoc} vs ${jobLoc} — relocation to confirm in interview` }
}

// ── Main handler ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      jobTitle             = '',
      jobDescription       = '',
      jobRequirements      = '',
      jobSkills            = [] as string[],
      jobExperienceMin     = 0,
      jobExperienceMax     = 0,
      jobSalaryMin         = 0,
      jobSalaryMax         = 0,
      jobLocation          = '',
      candidateName        = 'Candidate',
      candidateTitle       = '',
      candidateSkills      = [] as string[],
      candidateExperienceYears = 0,
      candidateSalaryExpectation = 0,
      candidateLocation    = '',
      candidateSummary     = '',
    } = body

    // ── 1. Hard eligibility checks ─────────────────────────
    const expCheck  = checkExperience(candidateExperienceYears, jobExperienceMin, jobExperienceMax)
    const salCheck  = checkSalary(candidateSalaryExpectation, jobSalaryMin, jobSalaryMax)
    const locCheck  = checkLocation(candidateLocation, jobLocation)

    // Hard reject only on experience (salary/location are soft rejections)
    const hardReject = !expCheck.pass
    if (hardReject) {
      return NextResponse.json({
        score:       0,
        summary:     `${candidateName} does not meet the minimum experience requirement. ${expCheck.detail}.`,
        strengths:   [],
        gaps:        [expCheck.detail],
        eligibility: { experience: expCheck, salary: salCheck, location: locCheck },
        auto_reject: true,
        reject_reason: expCheck.detail,
      })
    }

    // ── 2. AI scoring ──────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Smart mock — at least uses skills overlap
      const skillsMatch = candidateSkills.filter((s: string) =>
        (jobRequirements + jobDescription + jobSkills.join(' ')).toLowerCase().includes(s.toLowerCase())
      ).length
      const baseScore = Math.min(95, 45 + (skillsMatch * 8) + (expCheck.pass ? 15 : 0))
      return NextResponse.json({
        score:    baseScore,
        summary:  `${candidateName} shows a ${baseScore >= 75 ? 'strong' : 'moderate'} match for ${jobTitle}. ${skillsMatch} of ${candidateSkills.length} skills align with the JD.`,
        strengths: candidateSkills.slice(0, 3).map((s: string) => `Proficiency in ${s}`),
        gaps:      baseScore < 75 ? ['Some specialised requirements need verification in interview'] : [],
        eligibility: { experience: expCheck, salary: salCheck, location: locCheck },
        auto_reject: false,
        reject_reason: null,
        source: 'smart_mock',
      })
    }

    const prompt = `You are a senior HR recruiter evaluating a candidate for a job opening. Score the candidate's fit honestly and objectively.

JOB DETAILS:
Title: ${jobTitle}
Location: ${jobLocation}
Experience Required: ${jobExperienceMin}–${jobExperienceMax} years
Salary Budget: ${jobSalaryMin && jobSalaryMax ? `₹${jobSalaryMin}–${jobSalaryMax} LPA` : 'Not disclosed'}
Required Skills: ${jobSkills.join(', ') || 'Not specified'}
Requirements: ${jobRequirements.slice(0, 800) || 'Not provided'}
Description: ${jobDescription.slice(0, 600) || 'Not provided'}

CANDIDATE PROFILE:
Name: ${candidateName}
Current Title: ${candidateTitle}
Experience: ${candidateExperienceYears} years
Location: ${candidateLocation}
Salary Expectation: ${candidateSalaryExpectation ? `₹${candidateSalaryExpectation} LPA` : 'Not specified'}
Skills: ${candidateSkills.join(', ') || 'Not specified'}
Summary: ${candidateSummary.slice(0, 400) || 'Not provided'}

ELIGIBILITY PRE-CHECK:
- Experience: ${expCheck.detail}
- Salary: ${salCheck.detail}
- Location: ${locCheck.detail}

Evaluate the candidate's fit for this role. Return ONLY a valid JSON object:
{
  "score": <integer 0-100 representing overall fit>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>"]
}

Scoring guide:
- 85–100: Exceptional match, strongly recommend shortlisting
- 70–84: Good match, recommend shortlisting
- 55–69: Partial match, recommend screening interview
- 40–54: Weak match, consider only if pipeline is thin
- 0–39: Poor match, do not shortlist

Be honest. A random score defeats the purpose. Base it on actual skill overlap and experience alignment.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 600,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

    const aiData = await response.json()
    const text   = aiData.content?.[0]?.text || ''
    const match  = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in Claude response')

    const parsed = JSON.parse(match[0])

    return NextResponse.json({
      score:        Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
      summary:      parsed.summary  || '',
      strengths:    Array.isArray(parsed.strengths) ? parsed.strengths : [],
      gaps:         Array.isArray(parsed.gaps)      ? parsed.gaps      : [],
      eligibility:  { experience: expCheck, salary: salCheck, location: locCheck },
      auto_reject:  false,
      reject_reason: null,
      source:       'ai',
    })

  } catch (err: any) {
    console.error('score-resume error:', err.message)
    // Final fallback
    const { jobTitle = '', candidateName = '' } = await req.json().catch(() => ({}))
    const mock = await mockScoreResume(jobTitle, candidateName)
    return NextResponse.json({ ...mock, source: 'mock_error' })
  }
}
