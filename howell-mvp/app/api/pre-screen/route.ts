export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const sessions = await db.preScreen.allSessions()
    return NextResponse.json(sessions)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { application_id, candidate_name, job_title } = await req.json()
    const session = await db.preScreen.createSession({
      application_id,
      candidate_name,
      job_title,
      status: 'pending',
    })
    return NextResponse.json(session)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
