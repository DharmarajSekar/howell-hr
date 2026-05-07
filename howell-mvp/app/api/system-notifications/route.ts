/**
 * GET  /api/system-notifications  — list all, newest first
 * POST /api/system-notifications  — create one (internal use by other routes)
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

export async function GET(req: NextRequest) {
  try {
    const url        = new URL(req.url)
    const unreadOnly = url.searchParams.get('unread') === 'true'
    const limit      = parseInt(url.searchParams.get('limit') || '50', 10)

    let query = svc()
      .from('system_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) query = query.eq('is_read', false)

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
    const { data, error } = await svc()
      .from('system_notifications')
      .insert({ ...body, is_read: false })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
