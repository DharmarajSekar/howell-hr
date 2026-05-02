/**
 * POST /api/candidates/add-to-pipeline
 * Uses the same db instance from lib/db.ts that powers all other reads/writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { full_name, email, phone, current_title, current_company,
            experience_years, location, salary_expectation, skills, summary, job_id } = body

    // Validate
    if (!full_name?.trim()) return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    if (!email?.trim())     return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (!job_id)            return NextResponse.json({ error: 'Please select a job' }, { status: 400 })

    // Step 1: Upsert candidate using existing db layer
    const candidate = await db.candidates.upsert({
      full_name:          full_name.trim(),
      email:              email.trim().toLowerCase(),
      phone:              phone            || null,
      current_title:      current_title    || null,
      current_company:    current_company  || null,
      experience_years:   experience_years ? parseInt(experience_years) : 0,
      location:           location         || null,
      salary_expectation: salary_expectation ? parseInt(salary_expectation) : null,
      skills:             Array.isArray(skills) ? skills : [],
      summary:            summary          || null,
      source:             'direct',
    })

    if (!candidate?.id) {
      return NextResponse.json({ error: 'Failed to save candidate to database' }, { status: 500 })
    }

    // Step 2: Check if application already exists
    const existing = await db.applications.forJob(job_id)
    const duplicate = existing.find((a: any) => a.candidate_id === candidate.id)
    if (duplicate) {
      return NextResponse.json({ candidate, application: duplicate, alreadyApplied: true })
    }

    // Step 3: Create application using existing db layer
    const application = await db.applications.create({
      candidate_id: candidate.id,
      job_id,
      status: 'applied',
    })

    if (!application?.id) {
      return NextResponse.json({ error: 'Candidate saved but failed to create application' }, { status: 500 })
    }

    // Step 4: Fire AI screening in background
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/screening/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: application.id }),
    }).catch(() => {})

    return NextResponse.json({ candidate, application }, { status: 201 })

  } catch (err: any) {
    console.error('[add-to-pipeline]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
