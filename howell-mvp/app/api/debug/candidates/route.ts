import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('candidates')
    .select('id, full_name, email, source, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({
    total: data?.length ?? 0,
    error: error?.message ?? null,
    sourceSummary: data?.reduce((acc: Record<string, number>, c: any) => {
      acc[c.source || 'null'] = (acc[c.source || 'null'] || 0) + 1
      return acc
    }, {}),
    candidates: data?.map((c: any) => ({
      name: c.full_name,
      email: c.email,
      source: c.source,
      created: c.created_at,
    }))
  })
}
