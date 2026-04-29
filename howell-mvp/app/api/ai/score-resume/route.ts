export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { mockScoreResume } from '@/lib/ai-mock'

export async function POST(req: Request) {
  const { jobTitle, candidateName } = await req.json()
  const result = await mockScoreResume(jobTitle, candidateName)
  return NextResponse.json(result)
}
