/**
 * POST /api/offers/[id]/approve
 * Advances the approval chain by one step.
 * Body: { comments?: string }
 *
 * Approval order: Hiring Manager (step 1) → HR Admin (step 2)
 * When all steps are approved, status → 'approved'
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { comments = '' } = await req.json().catch(() => ({}))

    // Fetch current offer
    const { data: offer, error: fetchErr } = await svc()
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchErr || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    const chain: any[]   = offer.approval_chain || []
    const currentStep: number = offer.current_step || 0

    // Find the step to approve (current_step is 1-indexed; index = currentStep - 1)
    const stepIndex = currentStep - 1
    if (stepIndex < 0 || stepIndex >= chain.length) {
      return NextResponse.json({ error: 'No pending approval step' }, { status: 400 })
    }

    const step = chain[stepIndex]
    if (step.status !== 'pending') {
      return NextResponse.json({ error: 'Current step is not pending' }, { status: 400 })
    }

    // Mark current step as approved
    chain[stepIndex] = {
      ...step,
      status:      'approved',
      approved_at: new Date().toISOString(),
      comments:    comments || 'Approved',
    }

    const nextStepIndex = stepIndex + 1
    let newCurrentStep  = currentStep + 1
    let newStatus       = offer.status

    if (nextStepIndex < chain.length) {
      // Unlock next step
      chain[nextStepIndex] = { ...chain[nextStepIndex], status: 'pending' }
    } else {
      // All steps approved
      newStatus = 'approved'
    }

    const { data, error } = await svc()
      .from('offers')
      .update({
        approval_chain: chain,
        current_step:   newCurrentStep,
        status:         newStatus,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, offer: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
