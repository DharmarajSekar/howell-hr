export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const records = await db.bgv.all()
    return NextResponse.json(records)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const record = await db.bgv.create({
      ...body,
      status: 'initiated',
      identity_check: 'pending',
      education_check: 'pending',
      employment_check: 'pending',
      address_check: 'pending',
      criminal_check: 'pending',
      fraud_flag: false,
    })
    return NextResponse.json(record)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
