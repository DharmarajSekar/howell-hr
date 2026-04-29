import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Step 1: Check what columns exist in candidates table
  const { data: existing, error: fetchErr } = await supabase
    .from('candidates')
    .select('*')
    .limit(1)

  // Step 2: Try inserting a test portal candidate
  const testCandidate = {
    full_name:         'Test Portal Candidate',
    email:             `test.portal.debug.${Date.now()}@sourced.howell`,
    phone:             '',
    current_title:     'Test Engineer',
    current_company:   'Via Portal Sync',
    experience_years:  3,
    skills:            ['BMS', 'CCTV', 'ELV'],
    location:          'Mumbai',
    salary_expectation: 0,
    source:            'portal_sync_jsearch',
    summary:           'Test profile from portal sync debug.',
  }

  const { data: saved, error: saveErr } = await supabase
    .from('candidates')
    .insert(testCandidate)
    .select()
    .single()

  // Step 3: Clean up test record
  if (saved?.id) {
    await supabase.from('candidates').delete().eq('id', saved.id)
  }

  return NextResponse.json({
    tableColumns:    existing ? Object.keys(existing[0] || {}) : [],
    fetchError:      fetchErr?.message || null,
    testSave:        saved ? 'SUCCESS' : 'FAILED',
    saveError:       saveErr?.message || null,
    saveErrorDetail: saveErr || null,
    testCandidate,
  })
}
