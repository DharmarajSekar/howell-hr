/**
 * GET  /api/communications  — list all messages (optionally filtered)
 * POST /api/communications  — send a message + log to DB
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Simulate actual channel delivery (swap for Twilio/SendGrid in production) */
async function simulateDelivery(channel: string, _message: string): Promise<{ delivered: boolean; provider_ref: string }> {
  // In production: call Twilio API for WhatsApp/SMS, SendGrid for Email
  await new Promise(r => setTimeout(r, 80))
  return { delivered: true, provider_ref: `SIM-${Date.now()}` }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const channel    = searchParams.get('channel')
    const stage      = searchParams.get('stage')
    const candidate  = searchParams.get('candidate')
    const limit      = parseInt(searchParams.get('limit') || '100')

    let query = svc()
      .from('candidate_messages')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (channel && channel !== 'All')     query = query.eq('channel', channel)
    if (stage   && stage !== 'All Stages') query = query.eq('stage', stage)
    if (candidate)                         query = query.ilike('candidate_name', `%${candidate}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      candidate_name,
      candidate_id,
      application_id,
      channel,           // 'WhatsApp' | 'Email' | 'SMS'
      stage,
      message,
      direction = 'out', // 'out' = HR → candidate, 'in' = candidate → HR
      auto_triggered = false,
    } = body

    if (!candidate_name || !channel || !message) {
      return NextResponse.json({ error: 'candidate_name, channel, and message are required' }, { status: 400 })
    }

    // Simulate channel delivery
    const { delivered, provider_ref } = await simulateDelivery(channel, message)

    const { data, error } = await svc()
      .from('candidate_messages')
      .insert({
        candidate_name,
        candidate_id:    candidate_id || null,
        application_id:  application_id || null,
        channel,
        stage:           stage || null,
        message,
        direction,
        status:          direction === 'in' ? 'received' : delivered ? 'delivered' : 'failed',
        auto_triggered,
        provider_ref,
        sent_at:         new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
