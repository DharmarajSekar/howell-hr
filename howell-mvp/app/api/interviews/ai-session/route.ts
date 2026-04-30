/**
 * POST /api/interviews/ai-session  — create Tavus conversation + DB session record
 * PATCH /api/interviews/ai-session — complete session, save recording + evaluation
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

// ── CREATE: kick off Tavus conversation ──────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { applicationId, roundId, candidateName, jobTitle, questions, personaId } = await req.json()

    const tavusKey = process.env.TAVUS_API_KEY

    let tavusConversationId: string | null = null
    let tavusConversationUrl: string | null = null

    if (tavusKey && personaId) {
      // ── Real Tavus API call ──
      try {
        const context = `
You are an AI HR interviewer for Howell, conducting a screening interview for the role of ${jobTitle}.
The candidate's name is ${candidateName}.
Your job is to ask the following questions one by one, listen carefully to each answer,
and evaluate the candidate professionally.

Questions to ask:
${(questions || []).map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

After all questions are answered, thank the candidate and end the interview professionally.
Be warm, professional, and encouraging throughout.
        `.trim()

        const res = await fetch('https://tavusapi.com/v2/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': tavusKey,
          },
          body: JSON.stringify({
            replica_id:          personaId,
            persona_id:          personaId,
            conversation_name:   `${jobTitle} — ${candidateName} — AI Screening`,
            conversational_context: context,
            properties: {
              max_call_duration:    3600,
              participant_left_timeout: 60,
              enable_recording:    true,
              enable_transcription: true,
            },
          }),
        })
        const tavusData = await res.json()
        tavusConversationId  = tavusData.conversation_id || null
        tavusConversationUrl = tavusData.conversation_url || null
      } catch (tavusErr: any) {
        console.error('Tavus API error:', tavusErr.message)
        // Fall through to mock
      }
    }

    // ── Mock fallback if no Tavus key ──
    if (!tavusConversationId) {
      tavusConversationId  = `mock-${Date.now()}`
      tavusConversationUrl = null // UI will show demo mode
    }

    // Save session to DB
    const { data: session, error } = await db()
      .from('ai_interview_sessions')
      .insert({
        application_id:        applicationId,
        round_id:              roundId,
        tavus_conversation_id: tavusConversationId,
        tavus_conversation_url: tavusConversationUrl,
        status:                'scheduled',
        scheduled_at:          new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      session,
      conversationUrl: tavusConversationUrl,
      isLive: !!tavusConversationUrl,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── COMPLETE: save transcript + evaluation after interview ends ───────────────
export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, transcript, aiScore, evaluation, strengths, concerns, recommendation, recordingPath } = await req.json()

    // Get recording URL from Supabase Storage if path provided
    let recordingUrl: string | null = null
    if (recordingPath) {
      const { data } = await db().storage
        .from('interview-recordings')
        .createSignedUrl(recordingPath, 60 * 60 * 24 * 7) // 7-day signed URL
      recordingUrl = data?.signedUrl || null
    }

    const { data: session, error } = await db()
      .from('ai_interview_sessions')
      .update({
        status:               'completed',
        transcript:           transcript || [],
        ai_score:             aiScore || 0,
        ai_evaluation:        evaluation || '',
        strengths:            strengths || [],
        concerns:             concerns || [],
        recommendation:       recommendation || 'maybe',
        recording_path:       recordingPath || null,
        recording_url:        recordingUrl,
        completed_at:         new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update application's ai_match_score if AI gave a score
    if (session?.application_id && aiScore) {
      await db()
        .from('applications')
        .update({ ai_match_score: aiScore, ai_match_summary: evaluation })
        .eq('id', session.application_id)
    }

    return NextResponse.json({ success: true, session })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── GET: fetch session details + recording ────────────────────────────────────
export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const { data, error } = await db()
    .from('ai_interview_sessions')
    .select('*, application:applications(*, candidate:candidates(*), job:jobs(*))')
    .eq('id', sessionId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ session: data })
}
