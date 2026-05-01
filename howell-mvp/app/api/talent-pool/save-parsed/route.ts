/**
 * POST /api/talent-pool/save-parsed
 *
 * Saves an AI-parsed resume to the candidates master table.
 * Called after HR reviews the parsed data and clicks "Add to Talent Pool".
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
    const candidate = await req.json()

    const email = (candidate.email && candidate.email.includes('@'))
      ? candidate.email
      : `${(candidate.full_name || 'unknown').toLowerCase().replace(/\s+/g,'.')}.parsed@sourced.howell`

    // Check if already exists
    const { data: existing } = await db()
      .from('candidates')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (existing && existing.length > 0) {
      // Update existing with fresh parsed data
      await db()
        .from('candidates')
        .update({
          full_name:          candidate.full_name,
          phone:              candidate.phone || null,
          current_title:      candidate.current_title || null,
          current_company:    candidate.current_company || null,
          experience_years:   candidate.experience_years || 0,
          skills:             candidate.skills || [],
          location:           candidate.location || null,
          salary_expectation: candidate.salary_expectation || null,
          summary:            candidate.summary || null,
          resume_parsed:      true,
          resume_text:        candidate.resume_text || null,
          source:             existing[0].hasOwnProperty('source') ? undefined : 'direct',
        })
        .eq('id', existing[0].id)

      return NextResponse.json({ success: true, action: 'updated', candidateId: existing[0].id })
    }

    // Insert new
    const { data: inserted, error } = await db()
      .from('candidates')
      .insert({
        full_name:          candidate.full_name,
        email,
        phone:              candidate.phone || null,
        current_title:      candidate.current_title || null,
        current_company:    candidate.current_company || null,
        experience_years:   candidate.experience_years || 0,
        skills:             candidate.skills || [],
        location:           candidate.location || null,
        salary_expectation: candidate.salary_expectation || null,
        summary:            candidate.summary || null,
        source:             'direct',
        resume_parsed:      true,
        resume_text:        candidate.resume_text || null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: 'created', candidateId: inserted!.id })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
