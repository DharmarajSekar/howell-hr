export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const app = await db.applications.find(params.id)
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(app)
}
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(await db.applications.update(params.id, await req.json()))
}
