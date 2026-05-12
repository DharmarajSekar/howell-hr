export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const appId = new URL(req.url).searchParams.get('application_id')
  return NextResponse.json(appId ? await db.interviews.forApplication(appId) : await db.interviews.all())
}
export async function POST(req: Request) {
  const data = await req.json()
  let iv: any
  try {
    iv = await db.interviews.create(data)
  } catch (e: any) {
    console.error('Interview create error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
  if (!iv) {
    return NextResponse.json({ error: 'Interview could not be saved — check Supabase interviews table exists' }, { status: 500 })
  }

  // Update application status to interview_scheduled
  if (data.application_id) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const svc = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await svc.from('applications')
        .update({ status: 'interview_scheduled', updated_at: new Date().toISOString() })
        .eq('id', data.application_id)
    } catch (e: any) {
      console.error('Failed to update application status:', e.message)
    }
  }

  if (data.candidate_name) {
    await db.notifications.create({
      recipient_name: data.candidate_name,
      recipient_email: data.candidate_email || '',
      recipient_phone: data.candidate_phone || '',
      channel: 'whatsapp',
      message: `Hi ${data.candidate_name},\n\nYour interview for *${data.job_title}* at Howell is confirmed!\n\n📅 ${new Date(data.scheduled_at).toLocaleString('en-IN')}\n${data.meeting_link ? `\n🔗 Join: ${data.meeting_link}` : ''}\n\nBest regards,\nHowell HR Team`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
  }
  return NextResponse.json(iv, { status: 201 })
}
