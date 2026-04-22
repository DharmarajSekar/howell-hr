import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const appId = new URL(req.url).searchParams.get('application_id')
  return NextResponse.json(appId ? await db.interviews.forApplication(appId) : await db.interviews.all())
}
export async function POST(req: Request) {
  const data = await req.json()
  const iv = await db.interviews.create(data)
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
