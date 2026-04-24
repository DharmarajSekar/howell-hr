export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get('job_id')
  return NextResponse.json(jobId ? await db.applications.forJob(jobId) : await db.applications.all())
}
export async function POST(req: Request) {
  return NextResponse.json(await db.applications.create(await req.json()), { status: 201 })
}
