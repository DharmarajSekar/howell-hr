/**
 * POST /api/ivr/record
 *
 * Twilio IVR Webhook — Recording Callback
 *
 * Called after each candidate recording is complete.
 * Reads the next question or hangs up after the last one.
 *
 * Query params: q (question index, 0-based), callSid
 * Twilio body: RecordingUrl, RecordingDuration, TranscriptionText (async)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://howell-hr.vercel.app'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const DEFAULT_QUESTIONS = [
  'Please briefly introduce yourself and describe your most relevant experience for this role.',
  'What interests you most about working with Howell Group?',
  'Describe a challenging situation at work and how you resolved it.',
  'What are your salary expectations and your earliest available joining date?',
]

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const qIndex   = parseInt(searchParams.get('q') || '0', 10)
  const callSid  = searchParams.get('callSid') || ''

  const body         = await req.formData()
  const recordingUrl = body.get('RecordingUrl')?.toString() || ''
  const duration     = body.get('RecordingDuration')?.toString() || '0'

  // Save this recording reference
  try {
    // Find session by callSid
    const { data: sessions } = await svc()
      .from('pre_screen_sessions')
      .select('id, job_title')
      .eq('call_sid', callSid)
      .limit(1)

    if (sessions && sessions.length > 0) {
      const session   = sessions[0]
      const questions = getQuestionsForTitle(session.job_title || '')

      // Save recording metadata as a response row
      await svc().from('pre_screen_responses').upsert({
        session_id:   session.id,
        sort_order:   qIndex,
        question:     questions[qIndex] || `Question ${qIndex + 1}`,
        answer:       `[Voice recording — ${duration}s] ${recordingUrl}`,
        score:        null,  // will be filled by transcription callback
        feedback:     'Awaiting AI transcription…',
      }, { onConflict: 'session_id,sort_order' })

      const nextQ = qIndex + 1
      const questions2 = getQuestionsForTitle(session.job_title || '')

      if (nextQ >= questions2.length) {
        // All questions done — mark completed
        await svc()
          .from('pre_screen_sessions')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', session.id)

        return new NextResponse(buildFinalTwiML(), {
          headers: { 'Content-Type': 'text/xml' },
        })
      }

      // Next question
      const twiml = buildNextQuestionTwiML(questions2, nextQ, callSid)
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      })
    }
  } catch { /* proceed */ }

  // Fallback — check if more questions remain using index
  const nextQ = qIndex + 1
  if (nextQ >= DEFAULT_QUESTIONS.length) {
    return new NextResponse(buildFinalTwiML(), { headers: { 'Content-Type': 'text/xml' } })
  }
  return new NextResponse(
    buildNextQuestionTwiML(DEFAULT_QUESTIONS, nextQ, callSid),
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

function buildNextQuestionTwiML(questions: string[], index: number, callSid: string): string {
  const question  = questions[index]
  const recordUrl = `${APP_URL}/api/ivr/record?q=${index}&callSid=${encodeURIComponent(callSid)}`
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="Polly.Aditi" language="en-IN">Question ${index + 1} of ${questions.length}. ${question}</Say>
  <Pause length="1"/>
  <Record
    action="${recordUrl}"
    method="POST"
    maxLength="120"
    timeout="5"
    finishOnKey="*"
    playBeep="true"
    transcribe="true"
    transcribeCallback="${APP_URL}/api/ivr/transcribe?q=${index}&callSid=${encodeURIComponent(callSid)}"
  />
  <Hangup/>
</Response>`
}

function buildFinalTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    Thank you for completing the pre-screen interview.
    Our recruitment team will review your responses and be in touch within two business days.
    We wish you the very best. Goodbye.
  </Say>
  <Hangup/>
</Response>`
}

function getQuestionsForTitle(title: string): string[] {
  const t = title.toLowerCase()
  if (t.includes('engineer') || t.includes('developer'))
    return [
      'Please briefly describe your technical background and the key projects you have worked on.',
      'Describe a challenging technical problem you solved. What was your approach?',
      'Tell us about your experience with relevant tools and technologies for this role.',
      'What are your salary expectations and your earliest available joining date?',
    ]
  return DEFAULT_QUESTIONS
}
