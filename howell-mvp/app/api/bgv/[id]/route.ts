/**
 * GET   /api/bgv/[id]   — fetch single BGV record
 * PATCH /api/bgv/[id]   — update check statuses; fires system hiring alert if fraud_flag=true
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSystemNotification } from '@/lib/notify'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await svc()
      .from('bgv_records')
      .select('*, documents:bgv_documents(*)')
      .eq('id', params.id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()

    // Update the BGV record
    const { data: bgv, error } = await svc()
      .from('bgv_records')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Fire system-wide alert if fraud detected ─────────────────────────────
    if (body.fraud_flag === true && bgv) {
      const fraudNote = body.fraud_notes || 'Discrepancy detected during background verification. Manual review required before proceeding with hire.'

      // 1. Write to system_notifications
      await createSystemNotification({
        type:        'bgv_fraud_alert',
        title:       `🚨 BGV Fraud Alert — ${bgv.candidate_name}`,
        message:     `BGV Red Flag raised for ${bgv.candidate_name}: ${fraudNote}. Application has been auto-rejected pending review.`,
        severity:    'critical',
        link:        `/bgv`,
        entity_id:   params.id,
        entity_type: 'bgv_record',
      })

      // 2. Auto-reject the application
      if (bgv.application_id) {
        await svc()
          .from('applications')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', bgv.application_id)
      }
    }

    return NextResponse.json(bgv)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
