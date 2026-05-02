/**
 * POST /api/candidates/add-to-pipeline
 *
 * Single atomic endpoint that:
 * 1. Upserts candidate (on email conflict)
 * 2. Creates application linking them to a job
 * 3. Fires AI screening in background
 *
 * Returns { candidate, application, error? }
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
      full_name, email, phone, current_title, current_company,
      experience_years, location, salary_expectation, skills, summary,
      job_id,
    } = body

    // Validate required fields
    if (!full_name?.trim()) return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    if (!email?.trim())     return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (!job_id)            return NextResponse.json({ error: 'Job selection is required' }, { status: 400 })

    // ── 1. Upsert candidate ──────────────────────────────────────────────────
    const candidatePayload = {
      full_name:          full_name.trim(),
      email:              email.trim().toLowerCase(),
      phone:              phone         || null,
      current_title:      current_title || null,
      current_company:    current_company || null,
      experience_years:   experience_years ? parseInt(experience_years) : 0,
      location:           location      || null,
      salary_expectation: salary_expectation ? parseInt(salary_expectation) : null,
      skills:             Array.isArray(skills) ? skills : [],
      summary:            summary       || null,
      source:             'direct',
    }

    const { data: candidate, error: candErr } = await db()
      .from('candidates')
      .upsert(candidatePayload, { onConflict: 'email' })
      .select()
      .single()

    if (candErr || !candidate?.id) {
      console.error('Candidate upsert error:', candErr)
      return NextResponse.json(
        { error: candErr?.message || 'Failed to save candidate — check Supabase connection' },
        { status: 500 }
      )
    }

    // ── 2. Check for duplicate application ─────────────────────────────────
    const { data: existing } = await db()
      .from('applications')
      .select('id, status')
      .eq('candidate_id', candidate.id)
      .eq('job_id', job_id)
      .limit(1)

    if (existing && existing.length > 0) {
      // Already applied — return success with existing application
      return NextResponse.json({
        candidate,
        application:  existing[0],
        alreadyApplied: true,
        message: 'Candidate already has an application for this job',
      })
    }

    // ── 3. Create application ───────────────────────────────────────────────
    const { data: application, error: appErr } = await db()
      .from('applications')
      .insert({
        candidate_id: candidate.id,
        job_id,
        status: 'applied',
      })
      .select()
      .single()

    if (appErr || !application?.id) {
      console.error('Application insert error:', appErr)
      return NextResponse.json(
        { error: appErr?.message || 'Candidate saved but failed to create application', candidate },
        { status: 500 }
      )
    }

    // ── 4. Fire AI screening in background ─────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/screening/evaluate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ applicationId: application.id }),
    }).catch(err => console.error('Auto-screening error (non-fatal):', err.message))

    return NextResponse.json({ candidate, application }, { status: 201 })

  } catch (err: any) {
    console.error('add-to-pipeline error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
