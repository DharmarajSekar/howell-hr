/**
 * GET  /api/offers        — list all offers (newest first)
 * POST /api/offers        — create a new offer
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const { data, error } = await svc()
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      candidate_name, candidate_email, role, department, location,
      joining_date, ctc_annual, ctc_breakdown,
      benchmark_min, benchmark_max, benchmark_median, ai_benchmark_notes,
      application_id, notes, expiry_date,
    } = body

    if (!candidate_name || !role || !ctc_annual) {
      return NextResponse.json({ error: 'candidate_name, role, and ctc_annual are required' }, { status: 400 })
    }

    // Default approval chain: Hiring Manager → HR Admin
    const approval_chain = [
      { step: 1, role: 'Hiring Manager', approver_name: 'Rajesh Kumar',    status: 'pending', approved_at: null, comments: '' },
      { step: 2, role: 'HR Admin',       approver_name: 'Dharmaraj Sekar', status: 'waiting', approved_at: null, comments: '' },
    ]

    const { data, error } = await svc()
      .from('offers')
      .insert({
        candidate_name,
        candidate_email: candidate_email || null,
        role,
        department:    department    || 'Engineering',
        location:      location      || 'Chennai, India',
        joining_date:  joining_date  || null,
        ctc_annual:    Number(ctc_annual),
        ctc_breakdown: ctc_breakdown || {},
        benchmark_min:         benchmark_min         || null,
        benchmark_max:         benchmark_max         || null,
        benchmark_median:      benchmark_median      || null,
        ai_benchmark_notes:    ai_benchmark_notes    || null,
        application_id:        application_id        || null,
        notes:                 notes                 || null,
        expiry_date:           expiry_date           || null,
        approval_chain,
        current_step: 1,
        status: 'pending_approval',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
