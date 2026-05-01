/**
 * POST /api/talent-pool/add-referral
 *
 * Submits a new employee referral.
 * Creates a candidate with source = 'referral' and referral tracking fields.
 * If candidate email already exists, updates referral fields on the existing record.
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
    const {
      full_name,
      email,
      phone,
      current_title,
      current_company,
      experience_years,
      skills,
      location,
      salary_expectation,
      referred_by,
      referral_notes,
      job_id,         // optional — job they're being referred for
    } = body

    if (!full_name || !referred_by) {
      return NextResponse.json(
        { success: false, error: 'full_name and referred_by are required' },
        { status: 400 }
      )
    }

    // Build a deterministic email if none provided
    const candidateEmail = (email && email.includes('@'))
      ? email
      : `${full_name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}.referral@sourced.howell`

    // Check if candidate already exists
    const { data: existing } = await db()
      .from('candidates')
      .select('id')
      .eq('email', candidateEmail)
      .limit(1)

    let candidateId: string

    if (existing && existing.length > 0) {
      // Update referral info on existing record
      candidateId = existing[0].id
      await db()
        .from('candidates')
        .update({
          referred_by,
          referral_notes: referral_notes || null,
          referral_date:  new Date().toISOString(),
          source:         'referral',
        })
        .eq('id', candidateId)
    } else {
      // Insert new candidate
      const { data: inserted, error: insertErr } = await db()
        .from('candidates')
        .insert({
          full_name,
          email:              candidateEmail,
          phone:              phone || null,
          current_title:      current_title || null,
          current_company:    current_company || null,
          experience_years:   experience_years || 0,
          skills:             Array.isArray(skills) ? skills : [],
          location:           location || null,
          salary_expectation: salary_expectation || null,
          source:             'referral',
          summary:            `Referred by ${referred_by}. ${referral_notes || ''}`.trim(),
          referred_by,
          referral_notes:     referral_notes || null,
          referral_date:      new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertErr) {
        return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 })
      }
      candidateId = inserted!.id
    }

    // If a job was specified, create a pending application
    if (job_id && candidateId) {
      const { data: existingApp } = await db()
        .from('applications')
        .select('id')
        .eq('job_id', job_id)
        .eq('candidate_id', candidateId)
        .limit(1)

      if (!existingApp || existingApp.length === 0) {
        await db().from('applications').insert({
          job_id,
          candidate_id: candidateId,
          status:       'applied',
          notes:        `Referred by ${referred_by}`,
        })
      }
    }

    return NextResponse.json({ success: true, candidateId })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
