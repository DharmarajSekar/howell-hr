export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { document_type, file_name } = await req.json()
    const doc = await db.bgv.addDocument({
      bgv_record_id: params.id,
      document_type,
      file_name,
      file_url: null,
      status: 'uploaded',
      verified: false,
    })
    return NextResponse.json(doc)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
