/**
 * GET /api/debug/add-test
 * Tests the full add-candidate pipeline and reports exactly what fails.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, any> = {}

  // 1. Check env vars
  results.env = {
    supabase_url:          !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    service_role_key:      !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    url_value_prefix:      process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) || 'MISSING',
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase env vars', results })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 2. Test candidates table read
  const { data: readData, error: readErr } = await db
    .from('candidates')
    .select('id, full_name, source')
    .order('created_at', { ascending: false })
    .limit(3)
  results.candidates_read = { ok: !readErr, count: readData?.length, error: readErr?.message }

  // 3. Test candidate upsert (with a test email)
  const testEmail = `debug-test-${Date.now()}@howelltest.com`
  const { data: upsertData, error: upsertErr } = await db
    .from('candidates')
    .upsert({
      full_name: 'Debug Test User',
      email:     testEmail,
      source:    'direct',
    }, { onConflict: 'email' })
    .select()
    .single()
  results.candidate_upsert = { ok: !upsertErr, id: upsertData?.id, error: upsertErr?.message }

  // 4. If upsert worked, test application insert
  if (upsertData?.id) {
    // Get a real job id first
    const { data: jobs } = await db.from('jobs').select('id, title').limit(1)
    results.jobs_available = jobs?.length ? jobs[0] : 'NO JOBS FOUND'

    if (jobs && jobs.length > 0) {
      const { data: appData, error: appErr } = await db
        .from('applications')
        .insert({ candidate_id: upsertData.id, job_id: jobs[0].id, status: 'applied' })
        .select()
        .single()
      results.application_insert = { ok: !appErr, id: appData?.id, error: appErr?.message }

      // Cleanup test data
      if (appData?.id) await db.from('applications').delete().eq('id', appData.id)
      await db.from('candidates').delete().eq('id', upsertData.id)
      results.cleanup = 'done'
    }
  }

  const allOk = !readErr && !upsertErr
  return NextResponse.json({ status: allOk ? 'ALL OK' : 'ERRORS FOUND', results })
}
