/**
 * GET /api/cron/daily-sourcing
 *
 * Runs daily via Vercel Cron (configured in vercel.json).
 * For every active job, fetches fresh profiles from JSearch
 * and saves new candidates to the master database.
 * Updates sourcing_campaigns with new totals.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function buildQuery(job: any): string {
  const base    = job.title || ''
  const reqText = ((job.requirements || '') + ' ' + (job.description || '')).toUpperCase()
  const SKILLS  = ['BMS','ELV','CCTV','PMP','SQL','PYTHON','AUTOCAD','HRBP','SAP','WORKDAY',
    'AGILE','POWER BI','MS PROJECT','LENEL','HONEYWELL','SIEMENS','ACCESS CONTROL','MEP','HRMS']
  const found   = SKILLS.filter(s => reqText.includes(s)).slice(0, 4)
  return [base, ...found].join(' ').trim()
}

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron or an authorised source
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const log: string[] = []
  let totalSaved = 0

  try {
    // Fetch all active jobs
    const { data: jobs } = await db()
      .from('jobs')
      .select('*')
      .eq('status', 'active')

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No active jobs to source for', totalSaved: 0 })
    }

    log.push(`Processing ${jobs.length} active jobs`)

    for (const job of jobs) {
      const query    = buildQuery(job)
      const location = job.location || ''

      try {
        // Fetch from JSearch
        const baseUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://howell-hr.vercel.app'
        const fetchRes = await fetch(
          `${baseUrl}/api/portals/jsearch?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`
        )
        const fetchData = await fetchRes.json()
        const profiles  = fetchData.profiles || []

        if (profiles.length === 0) {
          log.push(`${job.title}: no profiles found`)
          continue
        }

        // Save profiles to candidates master
        const saveRes = await fetch(`${baseUrl}/api/portals/save-profiles`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ profiles, jobId: job.id }),
        })
        const saveData = await saveRes.json()
        const saved    = saveData.saved || 0
        totalSaved    += saved

        log.push(`${job.title}: fetched ${profiles.length}, saved ${saved} new profiles`)

        // Update or create sourcing campaign record
        const { data: existing } = await db()
          .from('sourcing_campaigns')
          .select('id, total_reached')
          .eq('job_id', job.id)
          .limit(1)

        if (existing && existing.length > 0) {
          await db()
            .from('sourcing_campaigns')
            .update({
              total_reached: (existing[0].total_reached || 0) + profiles.length,
              updated_at:    new Date().toISOString(),
              ai_summary:    `Daily AI sourcing active. Latest run: ${new Date().toLocaleDateString('en-IN')} — ${profiles.length} profiles scanned, ${saved} new added.`,
            })
            .eq('id', existing[0].id)
        } else {
          await db()
            .from('sourcing_campaigns')
            .insert({
              job_id:        job.id,
              job_title:     job.title,
              platforms:     ['LinkedIn', 'Indeed', 'Glassdoor'],
              status:        'active',
              total_reached: profiles.length,
              responses:     0,
              interested:    0,
              ai_summary:    `Daily AI sourcing active. First run: ${new Date().toLocaleDateString('en-IN')} — ${profiles.length} profiles scanned, ${saved} new added.`,
            })
        }

      } catch (jobErr: any) {
        log.push(`${job.title}: ERROR — ${jobErr.message}`)
      }
    }

    return NextResponse.json({
      success:    true,
      totalSaved,
      jobsProcessed: jobs.length,
      log,
      runAt:      new Date().toISOString(),
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
