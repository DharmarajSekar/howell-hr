export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  return NextResponse.json(await db.jobs.all())
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Only include known jobs table columns — strip anything not in the schema
    // (skills requires the talent-pool-upgrade migration; handled gracefully below)
    const {
      title, department, location, employment_type,
      experience_min, experience_max, salary_min, salary_max,
      status, description, requirements, nice_to_have, skills,
    } = body

    const insertPayload: Record<string, any> = {
      title, department, location, employment_type,
      experience_min, experience_max,
      salary_min: salary_min ?? null,
      salary_max: salary_max ?? null,
      status: status || 'active',
      description, requirements, nice_to_have,
    }

    // Try inserting with skills first; if the column doesn't exist yet, retry without it
    let result = await svc().from('jobs').insert({ ...insertPayload, skills }).select().single()
    if (result.error?.message?.includes("'skills'")) {
      // skills column missing — insert without it so the job still saves
      result = await svc().from('jobs').insert(insertPayload).select().single()
    }
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    // Bust the Next.js page cache so /jobs renders fresh on next visit
    revalidatePath('/jobs')
    revalidatePath('/sourcing')
    return NextResponse.json(result.data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
