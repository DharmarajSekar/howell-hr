import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Extracts key skills/keywords from a job description or requirements text
export function buildAIQuery(job: any): string {
  const titleWords = job.title || ''
  const reqText    = (job.requirements || '') + ' ' + (job.description || '')

  // Extract skill-like tokens: capitalized words, acronyms, known tech terms
  const skillPatterns = reqText.match(/\b(BMS|ELV|CCTV|PMP|SQL|Python|AutoCAD|HRBP|SAP|Workday|Agile|Scrum|BICSI|POSH|ISO|Power BI|MS Project|Lenel|Genetec|Honeywell|Siemens|Access Control|Structured Cabling|Fire Alarm|HVAC|MEP|EPC|HRMS|ATS|L&D|LMS)\b/gi) || []
  const uniqueSkills  = [...new Set(skillPatterns.map((s: string) => s.toUpperCase()))].slice(0, 5)

  return [titleWords, ...uniqueSkills].filter(Boolean).join(' ').trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile, jobId, matchScore } = body

    // Map portal profile → HRMS candidates table structure
    const candidateData = {
      full_name:         profile.name,
      email:             profile.email !== 'Available after connection'
                           ? profile.email
                           : `${profile.name.toLowerCase().replace(/\s+/g,'.').replace(/[^a-z.]/g,'')}@sourced.howell`,
      phone:             profile.phone !== 'Available after connection' ? profile.phone : '',
      current_title:     profile.title,
      current_company:   '',
      experience_years:  parseInt(profile.experience) || 0,
      skills:            profile.skills || [],
      location:          profile.location,
      salary_expectation: 0,
      source:            `Portal: ${profile.source}`,
      summary:           profile.summary || '',
      created_at:        new Date().toISOString(),
    }

    const saved = await db.candidates.upsert(candidateData)

    // If a job is specified, also create an application record
    if (saved && jobId) {
      await db.applications.create({
        job_id:           jobId,
        candidate_id:     saved.id,
        status:           'screening',
        ai_match_score:   matchScore || 0,
        ai_match_summary: `Sourced from ${profile.source} via AI portal sync. Match score: ${matchScore}%`,
        ai_strengths:     profile.skills?.slice(0, 3) || [],
        ai_gaps:          [],
        notes:            `Auto-synced from ${profile.source} on ${new Date().toLocaleDateString()}`,
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true, candidate: saved })
  } catch (error: any) {
    console.error('Sync candidate error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Also expose the query builder via GET for client use
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ query: '' })
  try {
    const job = await db.jobs.find(jobId)
    return NextResponse.json({ query: buildAIQuery(job), job })
  } catch {
    return NextResponse.json({ query: '' })
  }
}
