/**
 * GET  /api/screening/knockout-config?jobId=xxx  — list knockout questions for a job
 * POST /api/screening/knockout-config             — create a knockout question
 * PUT  /api/screening/knockout-config             — update a knockout question
 * DELETE /api/screening/knockout-config?id=xxx   — delete a question
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

export async function GET(req: NextRequest) {
  const jobId = new URL(req.url).searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ questions: [] })
  const { data, error } = await db()
    .from('knockout_questions')
    .select('*')
    .eq('job_id', jobId)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db()
    .from('knockout_questions')
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}

export async function PUT(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const { data, error } = await db()
    .from('knockout_questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db().from('knockout_questions').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
