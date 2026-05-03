/**
 * GET  /api/interviews/routing-rules  — list all active rules
 * POST /api/interviews/routing-rules  — create a rule
 * PUT  /api/interviews/routing-rules  — update a rule (body must include id)
 * DELETE /api/interviews/routing-rules?id=... — delete a rule
 *
 * Gracefully returns [] if the interview_routing_rules table doesn't exist yet.
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

export async function GET() {
  const { data, error } = await db()
    .from('interview_routing_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  // Table may not exist yet — return empty gracefully
  if (error) return NextResponse.json({ rules: [], tableExists: false })
  return NextResponse.json({ rules: data || [], tableExists: true })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db()
    .from('interview_routing_rules')
    .insert({
      name:                   body.name,
      role_level:             body.role_level             || 'any',
      candidate_location:     body.candidate_location     || '',
      office_location:        body.office_location        || '',
      interview_type:         body.interview_type,
      interview_platform:     body.interview_platform     || null,
      priority:               body.priority               ?? 0,
      is_active:              true,
    })
    .select()
    .single()

  if (error) {
    const isMissing = error.message.includes('does not exist')
    return NextResponse.json(
      { error: isMissing ? 'Run interview-routing-schema.sql in Supabase first' : error.message },
      { status: isMissing ? 503 : 500 }
    )
  }
  return NextResponse.json({ rule: data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await db()
    .from('interview_routing_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await db()
    .from('interview_routing_rules')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
