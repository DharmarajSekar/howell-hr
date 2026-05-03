/**
 * POST /api/candidates/add
 * REST equivalent of addCandidateAction — used for programmatic candidate creation
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
      experience_years, location, salary_expectation, skills, summary, job_id
    } = body

    if (!full_name?.trim()) return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    if (!email?.trim())     return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (!job_id)            return NextResponse.json({ error: 'Please select a job' }, { status: 400 })

    // Step 1: Upsert candidate — only include fields that are actually provided
    // so we don't overwrite existing valid data with empty values
    const skillsArr = Array.isArray(skills)
      ? skills
      : typeof skills === 'string'
        ? skills.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []

    const candidateData: Record<string, any> = {
      full_name: full_name.trim(),
      email:     email.trim().toLowerCase(),
      source:    'direct',
    }
    if (phone)              candidateData.phone              = phone
    if (current_title)      candidateData.current_title      = current_title
    if (current_company)    candidateData.current_company    = current_company
    if (experience_years)   candidateData.experience_years   = parseInt(experience_years)
    if (location)           candidateData.location           = location
    if (salary_expectation) candidateData.salary_expectation = parseInt(salary_expectation)
    if (skillsArr.length)   candidateData.skills             = skillsArr
    if (summary)            candidateData.summary            = summary

    const { data: candidate, error: candErr } = await db()
      .from('candidates')
      .upsert(candidateData, { onConflict: 'email' })
      .select()
      .single()

    if (candErr || !candidate?.id) {
      return NextResponse.json({ error: `Failed to save candidate: ${candErr?.message || 'unknown error'}` }, { status: 500 })
    }

    // Step 2: Check for duplicate application
    const { data: existing } = await db()
      .from('applications')
      .select('id')
      .eq('candidate_id', candidate.id)
      .eq('job_id', job_id)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'This candidate already applied for this job', alreadyApplied: true }, { status: 409 })
    }

    // Step 3: Create application
    const { data: application, error: appErr } = await db()
      .from('applications')
      .insert({ candidate_id: candidate.id, job_id, status: 'applied' })
      .select()
      .single()

    if (appErr || !application?.id) {
      return NextResponse.json({ error: `Candidate saved but application failed: ${appErr?.message || 'unknown error'}` }, { status: 500 })
    }

    // Step 4: Trigger AI screening (fire and forget)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://howell-hr.vercel.app'
      fetch(`${baseUrl}/api/screening/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application.id }),
      }).catch(() => {})
    } catch {}

    return NextResponse.json({ success: true, candidateId: candidate.id, applicationId: application.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
