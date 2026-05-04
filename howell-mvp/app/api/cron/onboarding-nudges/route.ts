/**
 * GET /api/cron/onboarding-nudges
 * Cron job — checks overdue onboarding tasks and fires WhatsApp/notification nudges.
 * Schedule: run daily at 9 AM.
 * Vercel cron: add to vercel.json — { "crons": [{ "path": "/api/cron/onboarding-nudges", "schedule": "0 9 * * *" }] }
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
  // Simple auth — check cron secret header
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now    = new Date()
  const nudged: string[] = []
  const errors: string[] = []

  try {
    // 1. Find incomplete tasks with a due_date that has passed
    const { data: overdueTasks } = await svc()
      .from('onboarding_tasks')
      .select('*, onboarding_records!inner(candidate_name, job_title, corporate_email, employee_id, status)')
      .eq('completed', false)
      .not('due_date', 'is', null)
      .lt('due_date', now.toISOString())
      .eq('onboarding_records.status', 'in_progress')

    if (!overdueTasks?.length) {
      return NextResponse.json({ message: 'No overdue tasks found', nudged: [], timestamp: now.toISOString() })
    }

    // Group by record to avoid spamming
    const grouped: Record<string, any> = {}
    for (const task of overdueTasks) {
      const rec = (task as any).onboarding_records
      const key = task.record_id
      if (!grouped[key]) {
        grouped[key] = {
          record_id:      task.record_id,
          candidate_name: rec?.candidate_name || 'Employee',
          job_title:      rec?.job_title || 'New Hire',
          employee_id:    rec?.employee_id || '',
          tasks:          [],
        }
      }
      grouped[key].tasks.push(task.title)
    }

    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    for (const group of Object.values(grouped)) {
      const taskList = group.tasks.slice(0, 3).join(', ') + (group.tasks.length > 3 ? ` (+${group.tasks.length - 3} more)` : '')
      const nudgeMsg = `Hi ${group.candidate_name}, this is a reminder from Howell HR. You have ${group.tasks.length} pending onboarding task(s) that require your attention: ${taskList}. Please log in to complete them.`

      try {
        // Fire WhatsApp nudge
        await fetch(`${base}/api/communications`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate_name:  group.candidate_name,
            channel:         'WhatsApp',
            stage:           'Onboarding',
            message:         nudgeMsg,
            direction:       'out',
            auto_triggered:  true,
          }),
        })

        // Log notification
        await svc()
          .from('notifications')
          .insert({
            type:        'onboarding_nudge',
            title:       `Onboarding Reminder — ${group.candidate_name}`,
            message:     `${group.tasks.length} overdue task(s): ${taskList}`,
            severity:    'warning',
            entity_id:   group.record_id,
            entity_type: 'onboarding_record',
            status:      'sent',
            sent_at:     now.toISOString(),
          })

        nudged.push(group.candidate_name)
      } catch (e: any) {
        errors.push(`${group.candidate_name}: ${e.message}`)
      }
    }

    return NextResponse.json({
      message:   `Nudges sent for ${nudged.length} employee(s)`,
      nudged,
      errors,
      timestamp: now.toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
