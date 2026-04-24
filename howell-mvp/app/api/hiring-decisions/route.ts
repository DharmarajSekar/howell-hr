export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const decisions = await db.hiringDecisions.all()
    return NextResponse.json(decisions)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const decision = await db.hiringDecisions.create(body)
    return NextResponse.json(decision)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
