import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const job = await db.jobs.find(params.id)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(await db.jobs.update(params.id, await req.json()))
}
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await db.jobs.delete(params.id)
  return NextResponse.json({ ok: true })
}
