/**
 * GET /api/portals/internal-search?query=ELV+Engineer&jobId=xxx
 *
 * Searches the internal candidates master database for matching profiles.
 * Covers: past applicants, previously sourced candidates, referred candidates, Resdex imports.
 * Returns candidates ranked by skill match score against the query.
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

function scoreCandidate(candidate: any, keywords: string[], jobTitle: string): number {
  let score = 0
  const skills    = (candidate.skills || []).map((s: string) => s.toLowerCase())
  const title     = (candidate.current_title || '').toLowerCase()
  const summary   = (candidate.summary || '').toLowerCase()
  const jobLower  = jobTitle.toLowerCase()

  // Title match
  if (title.includes(jobLower) || jobLower.includes(title)) score += 30
  else if (title.split(' ').some((w: string) => jobLower.includes(w) && w.length > 3)) score += 15

  // Skill matches
  keywords.forEach(kw => {
    if (skills.some((s: string) => s.includes(kw))) score += 12
    else if (summary.includes(kw)) score += 5
  })

  // Cap at 98
  return Math.min(98, score)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query  = searchParams.get('query') || ''
  const jobId  = searchParams.get('jobId') || null
  const limit  = parseInt(searchParams.get('limit') || '20')

  // Extract keywords from query
  const keywords = query.toLowerCase()
    .split(/[\s,+]+/)
    .filter(w => w.length > 2)

  // Fetch all candidates from internal DB
  const { data: allCandidates, error } = await db()
    .from('candidates')
    .select('id, full_name, email, phone, current_title, current_company, experience_years, skills, location, salary_expectation, source, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(500) // Scan last 500 candidates

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get existing applications for this job (to mark already-applied)
  let appliedCandidateIds = new Set<string>()
  if (jobId) {
    const { data: apps } = await db()
      .from('applications')
      .select('candidate_id')
      .eq('job_id', jobId)
    appliedCandidateIds = new Set((apps || []).map((a: any) => a.candidate_id))
  }

  // Score and filter candidates
  const jobTitle = query.split(' ').slice(0, 3).join(' ')
  const scored = (allCandidates || [])
    .map(c => ({
      id:           c.id,
      name:         c.full_name,
      title:        c.current_title || 'N/A',
      company:      c.current_company || 'N/A',
      location:     c.location || 'N/A',
      experience:   `${c.experience_years || 0} years`,
      skills:       c.skills || [],
      source:       formatSource(c.source),
      sourceRaw:    c.source || 'internal',
      matchScore:   scoreCandidate(c, keywords, jobTitle),
      summary:      c.summary || '',
      email:        c.email || '',
      phone:        c.phone || '',
      education:    '',
      alreadyApplied: appliedCandidateIds.has(c.id),
    }))
    .filter(c => c.matchScore > 0) // Only show relevant matches
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)

  return NextResponse.json({
    profiles: scored,
    total:    scored.length,
    source:   'internal',
  })
}

function formatSource(source: string | null): string {
  if (!source) return 'Internal DB'
  const s = source.toLowerCase()
  if (s.includes('linkedin'))   return 'LinkedIn (Archived)'
  if (s.includes('naukri'))     return 'Naukri (Archived)'
  if (s.includes('indeed'))     return 'Indeed (Archived)'
  if (s.includes('referral'))   return 'Referral'
  if (s.includes('portal_sync')) return 'Portal Sync'
  if (s.includes('apply_link')) return 'Direct Apply'
  if (s.includes('resdex'))     return 'Resdex'
  return 'Internal DB'
}
