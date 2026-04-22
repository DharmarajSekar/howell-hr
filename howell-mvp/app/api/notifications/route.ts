import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  return NextResponse.json(await db.notifications.all())
}
export async function POST(req: Request) {
  const data = await req.json()
  return NextResponse.json(await db.notifications.create({ ...data, status: 'sent', sent_at: new Date().toISOString() }), { status: 201 })
}
