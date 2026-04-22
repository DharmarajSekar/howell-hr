import { NextResponse } from 'next/server'
import { mockGenerateJD } from '@/lib/ai-mock'

export async function POST(req: Request) {
  const params = await req.json()
  const result = await mockGenerateJD(params)
  return NextResponse.json(result)
}
