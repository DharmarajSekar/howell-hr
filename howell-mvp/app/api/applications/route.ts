export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSystemNotification } from '@/lib/notify'

export async function GET(req: Request) {
  const url    = new URL(req.url)
  const jobId  = url.searchParams.get('job_id')
  const status = url.searchParams.get('status')
  if (jobId) return NextResponse.json(await db.applications.forJob(jobId))
  const all = await db.applications.all()
  if (status) return NextResponse.json(all.filter((a: any) => a.status === status))
  return NextResponse.json(all)
}

export async function POST(req: NextRequest) {
  // Create the application
  const body = await req.json()
  const app  = await db.applications.create(body)

  if (app?.id) {
    // Fire-and-forget: run full AI screening pipeline in the background
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/screening/evaluate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ applicationId: app.id }),
    }).catch(err => console.error('Auto-screening error (non-fatal):', err.message))

    // System notification — new application received
    const candidateName = body.candidate_name || body.name || 'A candidate'
    const jobTitle      = body.job_title      || body.role || 'an open role'
    // Use candidate_id for the link so the candidate profile page loads correctly
    const candidateId   = app.candidate_id || body.candidate_id
    createSystemNotification({
      type:        'new_application',
      title:       `New application — ${jobTitle}`,
      message:     `${candidateName} has applied for ${jobTitle}. AI screening is running in the background.`,
      severity:    'info',
      link:        candidateId ? `/candidates/${candidateId}` : `/candidates`,
      entity_id:   app.id,
      entity_type: 'application',
    })
  }

  return NextResponse.json(app, { status: 201 })
}
