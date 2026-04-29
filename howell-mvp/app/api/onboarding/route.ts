export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DEFAULT_TASKS = [
  { category: 'Documents', title: 'Submit signed offer letter' },
  { category: 'Documents', title: 'Submit educational certificates' },
  { category: 'Documents', title: 'Submit previous employment letters' },
  { category: 'Documents', title: 'Submit PAN card & Aadhaar copy' },
  { category: 'Documents', title: 'Submit 3-month bank statement' },
  { category: 'IT Setup',  title: 'Laptop provisioned' },
  { category: 'IT Setup',  title: 'Corporate email account created' },
  { category: 'IT Setup',  title: 'Access to HR systems granted' },
  { category: 'Induction', title: 'Orientation session scheduled' },
  { category: 'Induction', title: 'Meet the team — intro call' },
  { category: 'Induction', title: 'Company handbook & policies shared' },
  { category: 'Day 1 Kit', title: 'Welcome kit dispatched' },
  { category: 'Day 1 Kit', title: 'Buddy assigned' },
]

export async function GET() {
  return NextResponse.json(await db.onboarding.all())
}

export async function POST(req: Request) {
  const data = await req.json()
  const record = await db.onboarding.create(
    { ...data, status: 'in_progress' },
    DEFAULT_TASKS.map(t => ({ ...t, completed: false }))
  )
  return NextResponse.json(record, { status: 201 })
}

export async function PATCH(req: Request) {
  const { id, task_id, completed } = await req.json()
  return NextResponse.json(await db.onboarding.updateTask(id, task_id, completed))
}
