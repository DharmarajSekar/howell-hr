import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Bulk-saves all portal-fetched profiles to the candidates table.
 * Called automatically when profiles are fetched — no manual action needed.
 * Uses upsert on email so duplicate pulls don't create duplicate records.
 */
export async function POST(request: NextRequest) {
  try {
    const { profiles, jobId } = await request.json()

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ saved: 0, results: [] })
    }

    const results = await Promise.allSettled(
      profiles.map(async (profile: any) => {
        // Build a deterministic email for portal profiles that don't expose real email
        const safeEmail = (profile.email && !profile.email.includes('Available'))
          ? profile.email
          : `${profile.name.toLowerCase()
              .replace(/\s+/g, '.')
              .replace(/[^a-z0-9.]/g, '')}.${profile.source.toLowerCase().replace(/\s+/g,'')}@sourced.howell`

        const candidateData: Record<string, any> = {
          full_name:          profile.name            || 'Unknown',
          email:              safeEmail,
          phone:              (profile.phone && !profile.phone.includes('Available')) ? profile.phone : '',
          current_title:      profile.title           || '',
          current_company:    'Via Portal Sync',
          experience_years:   parseInt(profile.experience) || 0,
          skills:             Array.isArray(profile.skills) ? profile.skills : [],
          location:           profile.location        || '',
          salary_expectation: 0,
          source:             `portal_sync_${(profile.source||'').toLowerCase().replace(/\s+/g,'_')}`,
          summary:            profile.summary         || '',
          created_at:         new Date().toISOString(),
        }

        const saved = await db.candidates.upsert(candidateData)

        // If a job context is provided, also create a sourcing-stage application
        // Only create if one doesn't already exist for this candidate+job combo
        if (saved && jobId) {
          try {
            const existing = await db.applications.forJob(jobId)
            const alreadyApplied = existing.some((a: any) => a.candidate_id === saved.id)

            if (!alreadyApplied) {
              await db.applications.create({
                job_id:           jobId,
                candidate_id:     saved.id,
                status:           'applied',
                ai_match_score:   profile.matchScore || 0,
                ai_match_summary: `Auto-sourced from ${profile.source} via AI portal sync. Match score: ${profile.matchScore || 0}%`,
                ai_strengths:     Array.isArray(profile.skills) ? profile.skills.slice(0, 3) : [],
                ai_gaps:          [],
                notes:            `Auto-fetched from ${profile.source} on ${new Date().toLocaleDateString('en-IN')}`,
                created_at:       new Date().toISOString(),
                updated_at:       new Date().toISOString(),
              })
            }
          } catch {
            // Application creation is best-effort — candidate is already saved
          }
        }

        return { id: profile.id, candidateId: saved?.id, email: safeEmail, status: 'saved' }
      })
    )

    const saved     = results.filter(r => r.status === 'fulfilled').length
    const failed    = results.filter(r => r.status === 'rejected').length
    const savedIds  = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => ({ portalId: r.value.id, candidateId: r.value.candidateId }))

    return NextResponse.json({ saved, failed, total: profiles.length, savedIds })
  } catch (error: any) {
    console.error('Bulk sync error:', error)
    return NextResponse.json({ error: error.message, saved: 0 }, { status: 500 })
  }
}
