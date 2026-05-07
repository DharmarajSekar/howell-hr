export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'
import { createSystemNotification } from '@/lib/notify'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Auto-message templates fired when pipeline stage changes */
const STAGE_MESSAGES: Record<string, { channel: string; message: (name: string, role: string) => string }> = {
  shortlisted: {
    channel: 'WhatsApp',
    message: (name, role) =>
      `Hi ${name}, great news! You have been shortlisted for ${role} at Howell. Our team will contact you shortly to schedule an interview.`,
  },
  interview: {
    channel: 'WhatsApp',
    message: (name, role) =>
      `Hi ${name}, your interview for ${role} has been scheduled. Please check your email for the calendar invite and meeting details.`,
  },
  offer: {
    channel: 'Email',
    message: (name, role) =>
      `Dear ${name}, we are delighted to extend an offer for the ${role} position at Howell. Please check your email for the formal offer letter.`,
  },
  hired: {
    channel: 'WhatsApp',
    message: (name, role) =>
      `Welcome to Howell, ${name}! 🎉 We are excited to have you join us as ${role}. Our HR team will be in touch with your onboarding details.`,
  },
  rejected: {
    channel: 'Email',
    message: (name, role) =>
      `Dear ${name}, thank you for your interest in ${role} at Howell. After careful consideration, we will not be moving forward at this time. We wish you the very best in your career journey.`,
  },
}

async function fireAutoMessage(
  candidateName: string,
  candidateId: string | null,
  applicationId: string,
  newStatus: string,
  role: string
) {
  const tmpl = STAGE_MESSAGES[newStatus]
  if (!tmpl) return

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    await fetch(`${base}/api/communications`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_name:  candidateName,
        candidate_id:    candidateId,
        application_id:  applicationId,
        channel:         tmpl.channel,
        stage:           newStatus.charAt(0).toUpperCase() + newStatus.slice(1),
        message:         tmpl.message(candidateName, role || 'the role'),
        direction:       'out',
        auto_triggered:  true,
      }),
    })
  } catch (e) {
    // Non-blocking — log but don't fail the main request
    console.error('Auto-message failed:', e)
  }
}

async function autoBGV(candidateName: string, candidateId: string | null, applicationId: string) {
  try {
    const { data: existing } = await svc()
      .from('bgv_records')
      .select('id')
      .eq('application_id', applicationId)
      .maybeSingle()

    if (existing) return // BGV already exists

    await svc()
      .from('bgv_records')
      .insert({
        candidate_name:    candidateName,
        candidate_id:      candidateId || null,
        application_id:    applicationId,
        status:            'pending',
        identity_check:    'pending',
        education_check:   'pending',
        employment_check:  'pending',
        reference_check:   'pending',
        fraud_flag:        false,
        initiated_at:      new Date().toISOString(),
        notes:             'Auto-initiated on candidate hire',
      })
  } catch (e) {
    console.error('Auto-BGV initiation failed:', e)
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const app = await db.applications.find(params.id)
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(app)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  // Fetch current app to compare status
  const currentApp = await db.applications.find(params.id)

  const updated = await db.applications.update(params.id, body)

  // Fire side-effects when status changes
  if (body.status && currentApp && body.status !== currentApp.status) {
    const candidateName = currentApp.candidate_name || currentApp.name || 'Candidate'
    const candidateId   = currentApp.candidate_id || null
    const role          = currentApp.job_title || currentApp.role || 'the role'

    // 1. Auto-message candidate
    await fireAutoMessage(candidateName, candidateId, params.id, body.status, role)

    // 2. Auto-initiate BGV when hired
    if (body.status === 'hired') {
      await autoBGV(candidateName, candidateId, params.id)

      // 2b. Increment positions_filled; auto-close only when all positions are filled
      const jobId = currentApp.job_id || currentApp.job?.id
      if (jobId) {
        try {
          // Fetch current job openings state
          const { data: job } = await svc()
            .from('jobs')
            .select('openings, positions_filled, title')
            .eq('id', jobId)
            .single()

          if (job) {
            const newFilled = (job.positions_filled || 0) + 1
            const openings  = job.openings || 1
            const allFilled = newFilled >= openings
            const remaining = openings - newFilled

            await svc()
              .from('jobs')
              .update({
                positions_filled: newFilled,
                status:           allFilled ? 'closed' : undefined,
                updated_at:       new Date().toISOString(),
              })
              .eq('id', jobId)

            if (allFilled) {
              // All seats filled — auto-close
              createSystemNotification({
                type:        'job_closed',
                title:       `All positions filled — ${job.title || role}`,
                message:     `${candidateName} was the last hire for ${role}. All ${openings} position${openings > 1 ? 's' : ''} are now filled. Job posting has been automatically closed.`,
                severity:    'info',
                link:        `/jobs`,
                entity_id:   jobId,
                entity_type: 'job',
              })
            } else {
              // Partial hire — notify remaining seats
              createSystemNotification({
                type:        'position_filled',
                title:       `Position filled — ${remaining} remaining for ${role}`,
                message:     `${candidateName} was hired for ${role}. ${newFilled}/${openings} positions filled. ${remaining} seat${remaining > 1 ? 's' : ''} still open.`,
                severity:    'info',
                link:        `/jobs`,
                entity_id:   jobId,
                entity_type: 'job',
              })
            }
          }
        } catch (e) {
          console.error('Position tracking failed (non-fatal):', e)
        }
      }
    }

    // 3. System notification for key stage transitions
    const NOTIF_MAP: Record<string, { title: string; message: string; severity: 'info' | 'warning' | 'critical' }> = {
      shortlisted:         { severity: 'info',    title: `Shortlisted — ${candidateName}`,           message: `${candidateName} has been shortlisted for ${role}. Interview scheduling can begin.` },
      interview_scheduled: { severity: 'info',    title: `Interview scheduled — ${candidateName}`,   message: `An interview has been scheduled for ${candidateName} applying for ${role}.` },
      interview_done:      { severity: 'info',    title: `Interview completed — ${candidateName}`,   message: `${candidateName}'s interview for ${role} is complete. Awaiting panel feedback.` },
      offer:               { severity: 'info',    title: `Offer extended — ${candidateName}`,        message: `An offer letter has been sent to ${candidateName} for ${role}.` },
      hired:               { severity: 'info',    title: `🎉 Hired — ${candidateName}`,              message: `${candidateName} has been hired for ${role}. Onboarding has been initiated automatically.` },
      rejected:            { severity: 'warning', title: `Application rejected — ${candidateName}`,  message: `${candidateName}'s application for ${role} has been rejected.` },
    }
    const notifTemplate = NOTIF_MAP[body.status]
    if (notifTemplate) {
      createSystemNotification({
        ...notifTemplate,
        type:        body.status,
        link:        `/candidates/${params.id}`,
        entity_id:   params.id,
        entity_type: 'application',
      })
    }
  }

  return NextResponse.json(updated)
}
