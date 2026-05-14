/**
 * POST /api/interviews/violations
 *
 * Called by the candidate interview page whenever an integrity violation is
 * detected (tab switch, fullscreen exit, camera off, paste, long silence).
 * Stored in Supabase so HR can review the integrity report alongside scores.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { applicationId, roundId, type, details, timestamp } = await req.json()
    if (!applicationId || !type) {
      return NextResponse.json({ error: 'applicationId and type required' }, { status: 400 })
    }

    // Upsert into interview_violations — create row if not exists, otherwise append
    const { data: existing } = await db()
      .from('interview_violations')
      .select('id, violations')
      .eq('application_id', applicationId)
      .eq('round_id', roundId || '')
      .maybeSingle()

    const newEntry = { type, details: details || '', timestamp: timestamp || new Date().toISOString() }

    if (existing) {
      const updated = [...(existing.violations || []), newEntry]
      await db()
        .from('interview_violations')
        .update({ violations: updated, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await db()
        .from('interview_violations')
        .insert({
          application_id: applicationId,
          round_id:       roundId || '',
          violations:     [newEntry],
          created_at:     new Date().toISOString(),
          updated_at:     new Date().toISOString(),
        })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[violations]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const applicationId = new URL(req.url).searchParams.get('applicationId')
  if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 })

  const { data } = await db()
    .from('interview_violations')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ violations: data || [] })
}
