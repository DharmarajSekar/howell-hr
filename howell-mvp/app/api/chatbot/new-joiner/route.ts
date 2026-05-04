/**
 * POST /api/chatbot/new-joiner
 * Claude-powered chatbot for new joiners during onboarding.
 * Accepts { message, employeeName, role, department, history[] }
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

function fallbackReply(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('laptop') || lower.includes('system') || lower.includes('computer'))
    return "Your laptop/workstation should be provisioned by your IT team on Day 1. If it isn't ready, please contact it@howellgroup.com or raise a ticket via the IT helpdesk."
  if (lower.includes('email') || lower.includes('gmail') || lower.includes('corporate'))
    return "Your corporate email (firstname.lastname@howellgroup.com) has been created. Check your welcome email for login credentials. If you face issues, contact it@howellgroup.com."
  if (lower.includes('leave') || lower.includes('holiday') || lower.includes('absent'))
    return "Leave policy details are in the Company Policy Handbook shared in your onboarding kit. You get 12 earned leaves + 12 casual/sick leaves per year. Apply via Zoho People HRMS."
  if (lower.includes('salary') || lower.includes('payroll') || lower.includes('payslip'))
    return "Salaries are processed on the last working day of each month. Payslips are available on Zoho People HRMS. For payroll queries, contact payroll@howellgroup.com."
  if (lower.includes('buddy') || lower.includes('mentor'))
    return "Your buddy/mentor assignment is listed in your onboarding checklist. They'll reach out on Day 1. If you haven't heard from them, contact your HR business partner."
  if (lower.includes('id') || lower.includes('access card') || lower.includes('badge'))
    return "Your employee ID card will be issued at the HR desk on Day 1. Please bring original ID documents for verification. Your employee ID is on your offer letter and welcome email."
  if (lower.includes('github') || lower.includes('jira') || lower.includes('aws') || lower.includes('tool'))
    return "Tool access (GitHub, Jira, AWS, etc.) is being provisioned by your IT team. Status is visible in your onboarding checklist under 'IT Setup'. If any access is delayed, ping your manager."
  return "Great question! Your HR business partner or your buddy can help with this. You can also email hr@howellgroup.com. We want to make your first days as smooth as possible!"
}

export async function POST(req: NextRequest) {
  try {
    const { message, employeeName, role, department, employeeId, history = [] } = await req.json()
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ reply: fallbackReply(message) })
    }

    const systemPrompt = `You are "Howell Buddy" — a friendly AI assistant for new employees at Howell Group joining onboarding. You help new joiners navigate their first days with confidence.

New joiner context:
- Name: ${employeeName || 'the new joiner'}
- Employee ID: ${employeeId || 'being processed'}
- Role: ${role || 'not specified'}
- Department: ${department || 'not specified'}

You can help with:
- IT setup: corporate email, laptop, GitHub, Jira, AWS, system access
- HR processes: leave policy, payroll, expense claims, ID card, access card
- First-day logistics: where to report, what to bring, orientation schedule
- Company policies: leave, expenses, code of conduct, POSH, data security
- Team introductions: who to meet, buddy assignment, manager introductions
- Tools & systems: Zoho People, Zoho Expense, Slack, Google Workspace

Tone: warm, encouraging, concise. Reply in 2–4 sentences. Use bullet points only when listing 3+ items.
If you don't know something specific, suggest they ask their buddy, manager, or email hr@howellgroup.com.
Never share confidential company data, other employees' information, or make commitments on behalf of HR.`

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
        max_tokens: 350,
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
