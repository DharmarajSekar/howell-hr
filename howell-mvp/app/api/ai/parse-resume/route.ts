export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { mockParseResume } from '@/lib/ai-mock'

export async function POST() {
  const result = await mockParseResume()
  return NextResponse.json(result)
}
