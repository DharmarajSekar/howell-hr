export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await db.preScreen.findSession(params.id)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(session)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — complete session, save responses, compute score
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { responses, status } = await req.json()

    if (responses) {
      await db.preScreen.saveResponses(params.id, responses)
    }

    if (status === 'completed') {
      const session = await db.preScreen.findSession(params.id)
      const scored  = (session?.responses || []).filter((r: any) => r.score !== null && r.score !== undefined)
      const overall = scored.length
        ? Math.round(scored.reduce((s: number, r: any) => s + r.score, 0) / scored.length)
        : 0
      const rec = overall >= 70 ? 'Strong Hire' : overall >= 50 ? 'Consider' : 'Not Recommended'
      await db.preScreen.updateSession(params.id, {
        status: 'completed',
        overall_score: overall,
        ai_recommendation: rec,
        completed_at: new Date().toISOString(),
      })
    } else if (status) {
      await db.preScreen.updateSession(params.id, { status })
    }

    const updated = await db.preScreen.findSession(params.id)
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
