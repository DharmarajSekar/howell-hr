/**
 * POST /api/onboarding/generate-tasks
 * Uses Claude to generate a personalised onboarding checklist for a given role.
 * Body: { job_title: string, department?: string }
 * Returns: { tasks: Array<{ category, title }> }
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Fallback static tasks grouped by role keyword
function fallbackTasks(jobTitle: string): Array<{ category: string; title: string }> {
  const role = jobTitle.toLowerCase()
  const base = [
    { category: 'Documents',  title: 'Submit signed offer letter' },
    { category: 'Documents',  title: 'Submit PAN card & Aadhaar copy' },
    { category: 'Documents',  title: 'Submit educational certificates' },
    { category: 'Documents',  title: 'Submit previous employment letters' },
    { category: 'Documents',  title: 'Submit 3-month bank statement' },
    { category: 'IT Setup',   title: 'Laptop / workstation provisioned' },
    { category: 'IT Setup',   title: 'Corporate email account created' },
    { category: 'IT Setup',   title: 'Access to HR & finance systems granted' },
    { category: 'Induction',  title: 'HR orientation session completed' },
    { category: 'Induction',  title: 'Company handbook & policies shared' },
    { category: 'Induction',  title: 'Meet the team — intro call' },
    { category: 'Day 1 Kit',  title: 'Welcome kit dispatched' },
    { category: 'Day 1 Kit',  title: 'Buddy / mentor assigned' },
  ]
  if (role.includes('engineer') || role.includes('developer') || role.includes('technical')) {
    return [
      ...base,
      { category: 'IT Setup',  title: 'GitHub / GitLab access granted' },
      { category: 'IT Setup',  title: 'Dev environment setup completed' },
      { category: 'Induction', title: 'Technical onboarding with engineering lead' },
      { category: 'Induction', title: 'Project briefing and codebase walkthrough' },
    ]
  }
  if (role.includes('hr') || role.includes('human resource')) {
    return [
      ...base,
      { category: 'IT Setup',  title: 'HRMS (Zoho / Darwinbox) access granted' },
      { category: 'IT Setup',  title: 'ATS access and configuration completed' },
      { category: 'Induction', title: 'HR policies and compliance briefing' },
      { category: 'Induction', title: 'Meet department heads and key stakeholders' },
    ]
  }
  if (role.includes('manager') || role.includes('lead')) {
    return [
      ...base,
      { category: 'IT Setup',  title: 'Management dashboard and reporting tools access' },
      { category: 'Induction', title: 'Leadership briefing with CHRO / MD' },
      { category: 'Induction', title: 'Direct reports introduction and 1:1 schedule' },
      { category: 'Induction', title: 'OKR and goal-setting session' },
    ]
  }
  return base
}

export async function POST(req: NextRequest) {
  try {
    const { job_title, department } = await req.json()
    if (!job_title) return NextResponse.json({ tasks: fallbackTasks('') })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ tasks: fallbackTasks(job_title) })
    }

    const prompt = `You are an HR specialist creating a personalised onboarding checklist for a new hire.

New hire role: ${job_title}
Department: ${department || 'Not specified'}

Generate a personalised onboarding checklist with 14–18 tasks. Group them into exactly these 4 categories:
- "Documents" — paperwork, certificates, ID proofs needed
- "IT Setup" — systems, tools, access, accounts specific to this role
- "Induction" — meetings, training, briefings, shadowing specific to this role
- "Day 1 Kit" — physical/digital items to send/set up

Make the tasks specific to the role — an HR manager needs different tools than a software engineer. Be realistic for an Indian corporate context.

Return ONLY valid JSON — no markdown, no backticks, no explanation:
{
  "tasks": [
    { "category": "Documents", "title": "..." },
    { "category": "IT Setup",  "title": "..." }
  ]
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 800,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await res.json()
    const raw    = aiData.content?.[0]?.text?.trim() || ''

    try {
      const clean  = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      if (Array.isArray(parsed.tasks)) {
        return NextResponse.json({ tasks: parsed.tasks, ai_generated: true })
      }
    } catch {}

    return NextResponse.json({ tasks: fallbackTasks(job_title) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
