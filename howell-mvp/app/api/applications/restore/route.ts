/**
 * POST /api/applications/restore
 * Restores a rejected application back to 'applied' status.
 * Body: { applicationId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json()
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
    }

    const { error } = await db
      .from('applications')
      .update({
        status:     'applied',
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
