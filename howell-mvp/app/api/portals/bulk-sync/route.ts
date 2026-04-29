import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { profiles, jobId } = await request.json()

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ saved: 0, failed: 0, total: 0 })
    }

    let saved = 0
    let failed = 0
    const errors: string[] = []
    const savedCandidateIds: Record<string, string> = {}

    for (const profile of profiles) {
      try {
        // Build safe deterministic email
        const cleanName   = (profile.name || 'unknown').toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
        const cleanSource = (profile.source || 'portal').toLowerCase().replace(/[^a-z0-9]/g, '')
        const safeEmail   = (profile.email && !profile.email.includes('Available') && profile.email.includes('@'))
          ? profile.email
          : `${cleanName}.${cleanSource}@sourced.howell`

        // Build candidate record — NO created_at (let Supabase set it)
        const candidateData = {
          full_name:          (profile.name         || 'Unknown').substring(0, 200),
          email:              safeEmail.substring(0, 200),
          phone:              (profile.phone && !profile.phone.includes('Available')) ? profile.phone : '',
          current_title:      (profile.title        || '').substring(0, 200),
          current_company:    'Via Portal Sync',
          experience_years:   Math.max(0, parseInt(profile.experience) || 0),
          skills:             Array.isArray(profile.skills) ? profile.skills.slice(0, 20) : [],
          location:           (profile.location     || '').substring(0, 200),
          salary_expectation: 0,
          source:             `portal_sync_${cleanSource}`.substring(0, 100),
          summary:            (profile.summary      || '').substring(0, 1000),
        }

        // Step 1: Check if candidate already exists by email (avoids onConflict constraint dependency)
        const { data: existing, error: findErr } = await svc()
          .from('candidates')
          .select('id')
          .eq('email', candidateData.email)
          .limit(1)

        if (findErr) {
          errors.push(`[find] ${profile.name}: ${findErr.message}`)
          failed++
          continue
        }

        let candidateId: string | null = null

        if (existing && existing.length > 0) {
          // Already in DB — update to refresh portal data
          const { error: updateErr } = await svc()
            .from('candidates')
            .update(candidateData)
            .eq('id', existing[0].id)

          if (updateErr) {
            errors.push(`[update] ${profile.name}: ${updateErr.message}`)
            failed++
            continue
          }
          candidateId = existing[0].id

        } else {
          // New candidate — plain INSERT (no onConflict needed)
          const { data: inserted, error: insertErr } = await svc()
            .from('candidates')
            .insert(candidateData)
            .select('id')
            .single()

          if (insertErr) {
            errors.push(`[insert] ${profile.name}: ${insertErr.message}`)
            failed++
            continue
          }
          candidateId = inserted?.id || null
        }

        if (!candidateId) {
          errors.push(`${profile.name}: no ID returned after save`)
          failed++
          continue
        }

        saved++
        savedCandidateIds[profile.id] = candidateId

        // Step 2: Create application record if job context provided
        if (jobId) {
          const { data: existingApp } = await svc()
            .from('applications')
            .select('id')
            .eq('job_id', jobId)
            .eq('candidate_id', candidateId)
            .limit(1)

          if (!existingApp || existingApp.length === 0) {
            await svc().from('applications').insert({
              job_id:           jobId,
              candidate_id:     candidateId,
              status:           'applied',
              ai_match_score:   profile.matchScore || 0,
              ai_match_summary: `Auto-sourced from ${profile.source} via AI portal sync. Match score: ${profile.matchScore || 0}%`,
              ai_strengths:     Array.isArray(profile.skills) ? profile.skills.slice(0, 3) : [],
              ai_gaps:          [],
              notes:            `Auto-fetched from ${profile.source} on ${new Date().toLocaleDateString('en-IN')}`,
            })
          }
        }

      } catch (err: any) {
        errors.push(`[exception] ${profile.name}: ${err.message}`)
        failed++
      }
    }

    return NextResponse.json({
      saved,
      failed,
      total:  profiles.length,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message, saved: 0, failed: 0 }, { status: 500 })
  }
}
