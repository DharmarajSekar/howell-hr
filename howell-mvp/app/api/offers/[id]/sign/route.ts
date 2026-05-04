/**
 * POST /api/offers/[id]/sign
 * Saves a candidate's digital signature (base64 PNG from canvas) and marks the offer as accepted.
 * Body: { signature_data: string (base64 PNG), candidate_name?: string }
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
    const { signature_data } = await req.json()

    if (!signature_data) {
      return NextResponse.json({ error: 'signature_data is required' }, { status: 400 })
    }

    const signedAt = new Date().toISOString()

    const { data, error } = await svc()
      .from('offers')
      .update({
        candidate_signature: signature_data,
        signed_at:           signedAt,
        status:              'accepted',
        accepted_at:         signedAt,
        updated_at:          signedAt,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, signed_at: signedAt, offer: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
