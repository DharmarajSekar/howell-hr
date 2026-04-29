export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  return NextResponse.json(await db.candidates.all())
}
export async function POST(req: Request) {
  return NextResponse.json(await db.candidates.upsert(await req.json()), { status: 201 })
}
