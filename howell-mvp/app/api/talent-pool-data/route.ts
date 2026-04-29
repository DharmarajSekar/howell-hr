import { NextResponse } from 'next/server'
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
    const [candidatesRes, applicationsRes, jobsRes] = await Promise.all([
      svc().from('candidates').select('*').order('created_at', { ascending: false }),
      svc().from('applications').select('*, candidate:candidates(*), job:jobs(*)').order('created_at', { ascending: false }),
      svc().from('jobs').select('*').order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      candidates:   candidatesRes.data   || [],
      applications: applicationsRes.data || [],
      jobs:         jobsRes.data         || [],
      errors: {
        candidates:   candidatesRes.error?.message   || null,
        applications: applicationsRes.error?.message || null,
        jobs:         jobsRes.error?.message         || null,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
