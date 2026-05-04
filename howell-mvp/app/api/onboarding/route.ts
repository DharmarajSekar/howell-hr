export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCorporateEmail(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/)
  const first = clean[0] || 'employee'
  const last  = clean.slice(1).join('') || 'howell'
  return `${first}.${last}@howellgroup.com`
}

async function getNextEmployeeId(): Promise<string> {
  try {
    const { data } = await svc()
      .from('employees')
      .select('employee_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data?.employee_id) {
      const num = parseInt(data.employee_id.replace('EMP-', ''), 10)
      return `EMP-${String(num + 1).padStart(4, '0')}`
    }
  } catch {}
  return 'EMP-0043'
}

function generateKitItems(jobTitle: string): string[] {
  const role = jobTitle.toLowerCase()
  const base = [
    'Company Policy Handbook (PDF)',
    'Code of Conduct & Ethics Guidelines',
    'Leave Policy & Holiday Calendar 2026',
    'Employee Benefits Guide',
    'Payroll & Compensation FAQs',
  ]
  if (role.includes('engineer') || role.includes('developer')) {
    return [...base, 'Engineering Standards & Best Practices Guide', 'Dev Environment Setup Guide', 'Security & Data Handling Policy']
  }
  if (role.includes('hr') || role.includes('human resource')) {
    return [...base, 'HR Operating Procedures Manual', 'Confidentiality & POSH Policy', 'Recruitment SOP']
  }
  if (role.includes('manager') || role.includes('lead')) {
    return [...base, 'Manager\'s Playbook', 'Performance Management Guide', 'Team Communication SOP']
  }
  return base
}

function generateSystemsAccess(jobTitle: string): any[] {
  const role = jobTitle.toLowerCase()
  const base = [
    { system: 'Google Workspace (Gmail + Drive)', status: 'provisioned' },
    { system: 'Slack',                            status: 'provisioned' },
    { system: 'Howell HRMS (Zoho People)',        status: 'provisioned' },
    { system: 'Expense Management (Zoho Expense)',status: 'pending' },
  ]
  if (role.includes('engineer') || role.includes('developer') || role.includes('technical') || role.includes('site')) {
    return [...base,
      { system: 'GitHub / GitLab',        status: 'provisioned' },
      { system: 'Jira / Linear (PM)',     status: 'provisioned' },
      { system: 'AWS / GCP Console',      status: 'pending' },
    ]
  }
  if (role.includes('hr') || role.includes('human resource')) {
    return [...base,
      { system: 'Howell ATS (Recruitment)',     status: 'provisioned' },
      { system: 'Background Verification Portal', status: 'provisioned' },
    ]
  }
  if (role.includes('manager') || role.includes('lead')) {
    return [...base,
      { system: 'Reporting Dashboard (Metabase)', status: 'provisioned' },
      { system: 'Finance / Budget Portal',        status: 'pending' },
    ]
  }
  return base
}

async function fetchPersonalisedTasks(jobTitle: string, department?: string) {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res  = await fetch(`${base}/api/onboarding/generate-tasks`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ job_title: jobTitle, department }),
    })
    const data = await res.json()
    return data.tasks || null
  } catch {
    return null
  }
}

const STATIC_TASKS = [
  { category: 'Documents',  title: 'Submit signed offer letter' },
  { category: 'Documents',  title: 'Submit educational certificates' },
  { category: 'Documents',  title: 'Submit previous employment letters' },
  { category: 'Documents',  title: 'Submit PAN card & Aadhaar copy' },
  { category: 'Documents',  title: 'Submit 3-month bank statement' },
  { category: 'IT Setup',   title: 'Laptop / workstation provisioned' },
  { category: 'IT Setup',   title: 'Corporate email account created' },
  { category: 'IT Setup',   title: 'Access to HR systems granted' },
  { category: 'Induction',  title: 'HR orientation session scheduled' },
  { category: 'Induction',  title: 'Meet the team — intro call' },
  { category: 'Induction',  title: 'Company handbook & policies shared' },
  { category: 'Day 1 Kit',  title: 'Welcome kit dispatched' },
  { category: 'Day 1 Kit',  title: 'Buddy / mentor assigned' },
]

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  const { data } = await svc()
    .from('onboarding_records')
    .select('*, tasks:onboarding_tasks(*)')
    .order('created_at', { ascending: false })
  const sorted = (data || []).map((r: any) => ({
    ...r,
    tasks: (r.tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  }))
  return NextResponse.json(sorted)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    candidate_name, job_title, joining_date,
    candidate_id, department, personal_email,
  } = body

  // 1. Generate personalised tasks via Claude
  let tasks = await fetchPersonalisedTasks(job_title, department)
  if (!tasks || !tasks.length) tasks = STATIC_TASKS

  // 2. Create employee record (HRMS)
  const employee_id      = await getNextEmployeeId()
  const corporate_email  = generateCorporateEmail(candidate_name)
  const kit_items        = generateKitItems(job_title)
  const systems_access   = generateSystemsAccess(job_title)

  let employeeRecord: any = null
  try {
    const { data: emp } = await svc()
      .from('employees')
      .insert({
        employee_id,
        candidate_id:    candidate_id || null,
        full_name:       candidate_name,
        personal_email:  personal_email || null,
        corporate_email,
        job_title,
        department:      department || 'Engineering',
        joining_date:    joining_date || null,
        systems_access,
        it_provisioned:      true,
        welcome_email_sent:  true,
        welcome_email_at:    new Date().toISOString(),
        kit_dispatched:      true,
        kit_dispatched_at:   new Date().toISOString(),
      })
      .select()
      .single()
    employeeRecord = emp
  } catch (e) {
    // employees table may not exist yet — continue without it
    console.error('Employee record creation failed:', e)
  }

  // 3. Create onboarding record
  const { data: record, error: recErr } = await svc()
    .from('onboarding_records')
    .insert({
      candidate_name,
      job_title,
      joining_date:  joining_date || null,
      status:        'in_progress',
      employee_id:   employeeRecord?.employee_id || employee_id,
      candidate_id:  candidate_id || null,
      corporate_email,
      department:    department || 'Engineering',
      welcome_email_sent: true,
      kit_dispatched:     true,
      kit_items:     kit_items,
    })
    .select()
    .single()

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 })

  // 4. Insert tasks with sort_order
  if (tasks.length) {
    await svc()
      .from('onboarding_tasks')
      .insert(tasks.map((t: any, i: number) => ({
        record_id:  record.id,
        category:   t.category,
        title:      t.title,
        completed:  false,
        sort_order: i,
      })))
  }

  // 5. Fetch complete record with tasks
  const { data: full } = await svc()
    .from('onboarding_records')
    .select('*, tasks:onboarding_tasks(*)')
    .eq('id', record.id)
    .single()

  const result = {
    ...(full || record),
    tasks: ((full as any)?.tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    employee: employeeRecord,
    kit_items,
    systems_access,
  }

  return NextResponse.json(result, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { id, task_id, completed } = await req.json()
  await svc().from('onboarding_tasks').update({ completed }).eq('id', task_id)
  const { data } = await svc()
    .from('onboarding_records')
    .select('*, tasks:onboarding_tasks(*)')
    .eq('id', id)
    .single()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...data,
    tasks: ((data as any).tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  })
}
