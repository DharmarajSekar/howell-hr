/**
 * POST /api/ivr/voice
 *
 * Twilio IVR Webhook — Entry Point
 *
 * Twilio calls this endpoint when a candidate dials the IVR number.
 * Returns TwiML XML that greets the caller and reads the first pre-screen question.
 *
 * Expected Twilio params (form-encoded):
 *   CallSid, From, To, CallStatus
 *
 * Environment variables needed:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER
 *   NEXT_PUBLIC_APP_URL (e.g. https://howell-hr.vercel.app)
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

// Default questions read over the phone if no active session is found
const DEFAULT_QUESTIONS = [
  'Please briefly introduce yourself and describe your most relevant experience for this role.',
  'What interests you most about working with Howell Group?',
  'Describe a challenging situation at work and how you resolved it.',
  'What are your salary expectations and your earliest available joining date?',
]

function buildTwiML(questions: string[], questionIndex: number, callSid: string): string {
  const isLast    = questionIndex >= questions.length - 1
  const question  = questions[questionIndex] || questions[0]
  const recordUrl = `${APP_URL}/api/ivr/record?q=${questionIndex}&callSid=${encodeURIComponent(callSid)}`

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${questionIndex === 0 ? `
  <Say voice="Polly.Aditi" language="en-IN">
    Welcome to Howell Group's automated pre-screen interview.
    This call will ask you ${questions.length} short questions.
    Please speak clearly after the beep. Press any key to stop recording each answer.
    Let's begin.
  </Say>` : ''}
  <Pause length="1"/>
  <Say voice="Polly.Aditi" language="en-IN">Question ${questionIndex + 1} of ${questions.length}. ${question}</Say>
  <Pause length="1"/>
  <Record
    action="${recordUrl}"
    method="POST"
    maxLength="120"
    timeout="5"
    finishOnKey="*"
    playBeep="true"
    transcribe="true"
    transcribeCallback="${APP_URL}/api/ivr/transcribe?q=${questionIndex}&callSid=${encodeURIComponent(callSid)}"
  />
  <Say voice="Polly.Aditi" language="en-IN">We did not receive a response. Please call again when you are ready.</Say>
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

export async function POST(req: NextRequest) {
  const body   = await req.formData()
  const callSid = body.get('CallSid')?.toString() || 'unknown'
  const from    = body.get('From')?.toString() || ''

  // Try to find an active pre-screen session for this phone number
  let questions = DEFAULT_QUESTIONS
  let sessionId: string | null = null

  try {
    // Look up candidate by phone number
    const { data: candidate } = await svc()
      .from('candidates')
      .select('id, full_name')
      .eq('phone', from)
      .single()

    if (candidate) {
      // Find their latest shortlisted pre-screen session
      const { data: sessions } = await svc()
        .from('pre_screen_sessions')
        .select(`*, application:applications(job:jobs(*))`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (sessions && sessions.length > 0) {
        const session   = sessions[0]
        sessionId       = session.id
        const jobTitle  = session.application?.job?.title || ''
        questions       = getQuestionsForTitle(jobTitle)

        // Mark session as in_progress and store callSid
        await svc()
          .from('pre_screen_sessions')
          .update({ status: 'in_progress', call_sid: callSid })
          .eq('id', sessionId)
      }
    }

    // Store call metadata in notifications for tracking
    await svc().from('notifications').insert({
      type:    'ivr_call_started',
      title:   'IVR Pre-Screen Started',
      message: `Incoming call from ${from}. CallSid: ${callSid}`,
      read:    false,
    })
  } catch { /* non-critical — proceed with default questions */ }

  const twiml = buildTwiML(questions, 0, callSid)
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
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
  if (t.includes('manager') || t.includes('lead'))
    return [
      'Please describe your leadership experience, including team size and industry.',
      'How do you handle underperforming team members? Give a specific example.',
      'Describe a successful project you led from start to finish.',
      'What are your compensation expectations for this role?',
    ]
  return DEFAULT_QUESTIONS
}
