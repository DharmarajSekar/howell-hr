/**
 * POST /api/chatbot/candidate
 * 24/7 Claude-powered chatbot for candidate queries.
 * Accepts { message, candidateName, stage, history[] } and returns { reply }
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

const FALLBACK_REPLIES: Record<string, string> = {
  status:       "Your application is currently under review. Our team will reach out within 3–5 business days with an update. If you haven't heard back after 5 days, feel free to write to careers@howellgroup.com.",
  interview:    "We'll send you an interview invite via email with the date, time, and meeting link. Please check your inbox (and spam folder). If you need to reschedule, reply to the invite email.",
  offer:        "Once your offer is approved, you'll receive a formal offer letter via email. You'll also get a WhatsApp message from our HR team. Please review and sign within 5 business days.",
  documents:    "You'll need to submit: Aadhaar card, PAN card, last 3 months' payslips, educational certificates, and your previous employer's relieving letter. HR will share a checklist after the offer is accepted.",
  joining:      "Your joining date will be confirmed in your offer letter. Please report to the HR desk at 9:30 AM on your first day. Bring originals of all submitted documents.",
  salary:       "All compensation-related questions will be addressed by your HR business partner after the offer letter is sent. We ensure our packages are competitive and market-aligned.",
  contact:      "You can reach our HR team at hr@howellgroup.com or call +91-44-2345-6789 (Mon–Fri, 9 AM–6 PM IST).",
}

function fallbackReply(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('status') || lower.includes('application') || lower.includes('update')) return FALLBACK_REPLIES.status
  if (lower.includes('interview') || lower.includes('schedule') || lower.includes('meeting')) return FALLBACK_REPLIES.interview
  if (lower.includes('offer') || lower.includes('letter') || lower.includes('salary') || lower.includes('ctc')) return FALLBACK_REPLIES.salary
  if (lower.includes('document') || lower.includes('certificate') || lower.includes('aadhaar') || lower.includes('pan')) return FALLBACK_REPLIES.documents
  if (lower.includes('join') || lower.includes('start') || lower.includes('first day') || lower.includes('onboard')) return FALLBACK_REPLIES.joining
  if (lower.includes('contact') || lower.includes('email') || lower.includes('phone') || lower.includes('reach')) return FALLBACK_REPLIES.contact
  return "Thank you for your question! Our HR team will get back to you shortly. For urgent queries, please email hr@howellgroup.com or call +91-44-2345-6789."
}

export async function POST(req: NextRequest) {
  try {
    const { message, candidateName, stage, history = [] } = await req.json()
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ reply: fallbackReply(message) })
    }

    const systemPrompt = `You are a friendly and professional HR assistant chatbot for Howell Group, a large infrastructure and construction company in India. You help job candidates with their queries 24/7.

Candidate context:
- Name: ${candidateName || 'the candidate'}
- Current hiring stage: ${stage || 'Applied'}

Your responsibilities:
- Answer questions about application status, interview process, documents required, offer letters, joining date, and onboarding
- Be warm, professional, and concise — reply in 2–4 sentences max
- If you don't know specific details, give a helpful general answer and suggest they contact hr@howellgroup.com
- Never make up specific dates, salaries, or decisions that haven't been confirmed
- Respond in the same language the candidate uses (Hindi or English)
- Always end with a reassuring note

Do NOT:
- Share internal HR processes or confidential information
- Make hiring decisions or give salary commitments
- Be negative or dismissive about the candidate's chances`

    const messages = [
      ...history.slice(-8).map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 300,
        system:     systemPrompt,
        messages,
      }),
    })

    const data  = await res.json()
    const reply = data.content?.[0]?.text?.trim() || fallbackReply(message)
    return NextResponse.json({ reply })
  } catch (e: any) {
    return NextResponse.json({ reply: fallbackReply('') })
  }
}
