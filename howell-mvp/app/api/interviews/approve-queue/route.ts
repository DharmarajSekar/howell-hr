/**
 * POST /api/interviews/approve-queue
 * Approve or reject a pending auto-schedule queue item.
 * On approval, creates the AI interview session immediately.
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

export async function POST(req: NextRequest) {
  try {
    const { queueId, action, approvedBy } = await req.json()
    // action: 'approve' | 'reject'
    if (!queueId || !action) {
      return NextResponse.json({ error: 'queueId and action required' }, { status: 400 })
    }

    // Fetch the queue item
    const { data: item, error: fetchErr } = await db()
      .from('interview_auto_queue')
      .select('*, round:interview_rounds(name, type, tavus_persona_id, ai_questions), application:applications(id, candidate:candidates(full_name, email), job:jobs(title))')
      .eq('id', queueId)
      .single()

    if (fetchErr || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }

    if (action === 'reject') {
      await db()
        .from('interview_auto_queue')
        .update({ status: 'rejected', hr_approved_by: approvedBy || 'HR', hr_approved_at: new Date().toISOString() })
        .eq('id', queueId)

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    // Approve: update queue status
    await db()
      .from('interview_auto_queue')
      .update({ status: 'approved', hr_approved_by: approvedBy || 'HR', hr_approved_at: new Date().toISOString() })
      .eq('id', queueId)

    // Create AI session if round type is 'ai'
    let session = null
    if (item.round?.type === 'ai') {
      const tavusKey = process.env.TAVUS_API_KEY
      const personaId = item.round?.tavus_persona_id || null
      const candidateName = item.application?.candidate?.full_name || 'Candidate'
      const jobTitle = item.application?.job?.title || 'the role'
      const questions: string[] = item.round?.ai_questions || []

      let tavusConversationId: string | null = null
      let tavusConversationUrl: string | null = null

      if (tavusKey && personaId) {
        try {
          const context = `
You are an AI HR interviewer conducting a screening interview for the role of ${jobTitle}.
The candidate's name is ${candidateName}.
Ask the following questions one by one and evaluate the candidate professionally.

Questions:
${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

After all questions, thank the candidate and end professionally. Be warm and encouraging.
          `.trim()

          const res = await fetch('https://tavusapi.com/v2/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': tavusKey },
            body: JSON.stringify({
              replica_id: personaId,
              persona_id: personaId,
              conversation_name: `${jobTitle} — ${candidateName} — AI Screening`,
              conversational_context: context,
              properties: {
                max_call_duration: 3600,
                participant_left_timeout: 60,
                enable_recording: true,
                enable_transcription: true,
              },
            }),
          })
          const tavusData = await res.json()
          tavusConversationId  = tavusData.conversation_id || null
          tavusConversationUrl = tavusData.conversation_url || null
        } catch (e: any) {
          console.error('Tavus error:', e.message)
        }
      }

      if (!tavusConversationId) {
        tavusConversationId = `mock-${Date.now()}`
      }

      const { data: newSession } = await db()
        .from('ai_interview_sessions')
        .insert({
          application_id:        item.application_id,
          round_id:              item.round_id,
          tavus_conversation_id: tavusConversationId,
          tavus_conversation_url: tavusConversationUrl,
          status:                'scheduled',
          scheduled_at:          item.scheduled_for || new Date().toISOString(),
        })
        .select()
        .single()

      session = newSession

      // Mark queue item as done
      await db()
        .from('interview_auto_queue')
        .update({ status: 'done' })
        .eq('id', queueId)
    }

    return NextResponse.json({ success: true, status: 'approved', session })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
