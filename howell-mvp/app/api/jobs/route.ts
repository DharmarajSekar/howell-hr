import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  return NextResponse.json(await db.jobs.all())
}
export async function POST(req: Request) {
  const data = await req.json()
  return NextResponse.json(await db.jobs.create(data), { status: 201 })
}
