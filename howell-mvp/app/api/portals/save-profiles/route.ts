import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const profiles: any[] = body.profiles || []
    const jobId: string | null = body.jobId || null
    if (profiles.length === 0) return NextResponse.json({ saved: 0, failed: 0, total: 0 })
    let saved = 0, failed = 0
    const errors: string[] = []
    for (const p of profiles) {
      try {
        const cleanName = (p.name || 'unknown').toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
        const cleanSrc  = (p.source || 'portal').toLowerCase().replace(/[^a-z0-9]/g, '')
        const email = (p.email && !p.email.toLowerCase().includes('available') && p.email.includes('@'))
          ? p.email.substring(0, 200)
          : `${cleanName}.${cleanSrc}@sourced.howell`.substring(0, 200)
        const row = {
          full_name: (p.name || 'Unknown').substring(0, 200), email,
          phone: (p.phone && !p.phone.toLowerCase().includes('available')) ? p.phone : '',
          current_title: (p.title || '').substring(0, 200),
          current_company: 'Via Portal Sync',
          experience_years: Math.max(0, parseInt(p.experience) || 0),
          skills: Array.isArray(p.skills) ? p.skills.slice(0, 20) : [],
          location: (p.location || '').substring(0, 200),
          salary_expectation: 0,
          source: `portal_sync_${cleanSrc}`.substring(0, 100),
          summary: (p.summary || '').substring(0, 1000),
        }
        const { data: found, error: findErr } = await db().from('candidates').select('id').eq('email', email).limit(1)
        if (findErr) { errors.push(`FIND ${p.name}: ${findErr.message}`); failed++; continue }
        let candidateId: string | null = null
        if (found && found.length > 0) {
          const { error: upErr } = await db().from('candidates').update(row).eq('id', found[0].id)
          if (upErr) { errors.push(`UPDATE ${p.name}: ${upErr.message}`); failed++; continue }
          candidateId = found[0].id
        } else {
          const { data: ins, error: insErr } = await db().from('candidates').insert(row).select('id').single()
          if (insErr) { errors.push(`INSERT ${p.name}: ${insErr.message}`); failed++; continue }
          candidateId = ins?.id ?? null
        }
        if (!candidateId) { errors.push(`${p.name}: no ID`); failed++; continue }
        saved++
        if (jobId) {
          const { data: appExists } = await db().from('applications').select('id').eq('job_id', jobId).eq('candidate_id', candidateId).limit(1)
          if (!appExists || appExists.length === 0) {
            await db().from('applications').insert({
              job_id: jobId, candidate_id: candidateId, status: 'applied',
              ai_match_score: p.matchScore || 0,
              ai_match_summary: `Auto-sourced from ${p.source}. Match: ${p.matchScore || 0}%`,
              ai_strengths: Array.isArray(p.skills) ? p.skills.slice(0, 3) : [],
              ai_gaps: [], notes: `Fetched from ${p.source} on ${new Date().toLocaleDateString('en-IN')}`,
            })
          }
        }
      } catch (e: any) { errors.push(`EXCEPTION ${p.name}: ${e.message}`); failed++ }
    }
    return NextResponse.json({ saved, failed, total: profiles.length, errors: errors.length ? errors : undefined })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, saved: 0, failed: 0, total: 0 }, { status: 500 })
  }
}
