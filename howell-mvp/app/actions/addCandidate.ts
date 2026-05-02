'use server'

import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function addCandidateAction(formData: {
  full_name: string
  email: string
  phone: string
  current_title: string
  current_company: string
  experience_years: string
  location: string
  salary_expectation: string
  skills: string[]
  summary: string
  job_id: string
}) {
  const { full_name, email, phone, current_title, current_company,
          experience_years, location, salary_expectation, skills, summary, job_id } = formData

  if (!full_name?.trim()) return { error: 'Full name is required' }
  if (!email?.trim())     return { error: 'Email is required' }
  if (!job_id)            return { error: 'Please select a job' }

  // Step 1: Upsert candidate
  const { data: candidate, error: candErr } = await db()
    .from('candidates')
    .upsert({
      full_name:          full_name.trim(),
      email:              email.trim().toLowerCase(),
      phone:              phone           || null,
      current_title:      current_title   || null,
      current_company:    current_company || null,
      experience_years:   experience_years ? parseInt(experience_years) : 0,
      location:           location        || null,
      salary_expectation: salary_expectation ? parseInt(salary_expectation) : null,
      skills:             Array.isArray(skills) ? skills : [],
      summary:            summary         || null,
      source:             'direct',
    }, { onConflict: 'email' })
    .select()
    .single()

  if (candErr || !candidate?.id) {
    return { error: `Failed to save candidate: ${candErr?.message || 'unknown error'}` }
  }

  // Step 2: Check for duplicate application
  const { data: existing } = await db()
    .from('applications')
    .select('id')
    .eq('candidate_id', candidate.id)
    .eq('job_id', job_id)
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'This candidate already applied for this job', alreadyApplied: true }
  }

  // Step 3: Create application
  const { data: application, error: appErr } = await db()
    .from('applications')
    .insert({ candidate_id: candidate.id, job_id, status: 'applied' })
    .select()
    .single()

  if (appErr || !application?.id) {
    return { error: `Candidate saved but application failed: ${appErr?.message || 'unknown error'}` }
  }

  // Step 4: Trigger AI screening (fire and forget)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/screening/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: application.id }),
    }).catch(() => {})
  } catch {}

  return { success: true, candidateId: candidate.id, applicationId: application.id }
}
