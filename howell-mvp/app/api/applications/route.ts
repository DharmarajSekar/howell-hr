export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get('job_id')
  return NextResponse.json(jobId ? await db.applications.forJob(jobId) : await db.applications.all())
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
  }

  return NextResponse.json(app, { status: 201 })
}
