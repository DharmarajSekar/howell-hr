/**
 * POST /api/portals/save-profiles
 *
 * Saves fetched portal profiles to the CANDIDATES MASTER table only.
 * Does NOT create application records — portal sourcing is not the same as applying.
 * HR must explicitly shortlist a candidate (via the sourcing page) to create an application.
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const profiles: any[] = body.profiles || []

    if (profiles.length === 0) {
      return NextResponse.json({ saved: 0, failed: 0, total: 0 })
    }

    let saved = 0, failed = 0
    const errors: string[] = []

    for (const p of profiles) {
      try {
        // Build deterministic email
        const cleanName = (p.name || 'unknown').toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
        const cleanSrc  = (p.source || 'portal').toLowerCase().replace(/[^a-z0-9]/g, '')
        const email = (
          p.email &&
          !p.email.toLowerCase().includes('available') &&
          p.email.includes('@')
        )
          ? p.email.substring(0, 200)
          : `${cleanName}.${cleanSrc}@sourced.howell`.substring(0, 200)

        // Build candidate row — saved to candidates master only
        const row = {
          full_name:          (p.name     || 'Unknown').substring(0, 200),
          email,
          phone:              (p.phone && !p.phone.toLowerCase().includes('available')) ? p.phone : '',
          current_title:      (p.title    || '').substring(0, 200),
          current_company:    (p.company  || 'Via Portal Sync').substring(0, 200),
          experience_years:   Math.max(0, parseInt(p.experience) || 0),
          skills:             Array.isArray(p.skills) ? p.skills.slice(0, 20) : [],
          location:           (p.location || '').substring(0, 200),
          salary_expectation: 0,
          source:             `portal_sync_${cleanSrc}`.substring(0, 100),
          summary:            (p.summary  || '').substring(0, 1000),
        }

        // Check if already exists
        const { data: found, error: findErr } = await db()
          .from('candidates')
          .select('id')
          .eq('email', email)
          .limit(1)

        if (findErr) {
          errors.push(`FIND ${p.name}: ${findErr.message}`)
          failed++
          continue
        }

        if (found && found.length > 0) {
          // Update existing record
          const { error: upErr } = await db()
            .from('candidates')
            .update(row)
            .eq('id', found[0].id)
          if (upErr) {
            errors.push(`UPDATE ${p.name}: ${upErr.message}`)
            failed++
            continue
          }
        } else {
          // Insert new record
          const { error: insErr } = await db()
            .from('candidates')
            .insert(row)
          if (insErr) {
            errors.push(`INSERT ${p.name}: ${insErr.message}`)
            failed++
            continue
          }
        }

        saved++

      } catch (e: any) {
        errors.push(`EXCEPTION ${p.name}: ${e.message}`)
        failed++
      }
    }

    return NextResponse.json({
      saved,
      failed,
      total:  profiles.length,
      errors: errors.length ? errors : undefined,
    })

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, saved: 0, failed: 0, total: 0 },
      { status: 500 }
    )
  }
}
