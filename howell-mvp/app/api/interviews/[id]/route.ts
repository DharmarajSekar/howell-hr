/**
 * PATCH /api/interviews/[id]
 * Saves structured interviewer feedback to the interviews table.
 * Feedback is stored as JSON in the `feedback` text column.
 * Overall rating is stored in the `rating` int column.
 * Also marks the interview as completed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { categories, recommendation, comments, interviewer, overall_rating, status } = body

    const updateData: Record<string, any> = {}

    // Store structured feedback as JSON in the feedback column
    if (categories !== undefined || comments !== undefined || recommendation !== undefined) {
      updateData.feedback = JSON.stringify({
        categories:     categories     || {},
        recommendation: recommendation || 'hold',
        comments:       comments       || '',
        interviewer:    interviewer    || 'HR',
        submitted_at:   new Date().toISOString(),
      })
    }

    // Overall rating = average of category scores, or explicitly provided
    if (overall_rating !== undefined) {
      updateData.rating = overall_rating
    } else if (categories) {
      const vals = Object.values(categories as Record<string, number>).filter(v => v > 0)
      if (vals.length) updateData.rating = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    }

    if (status) updateData.status = status

    const { data, error } = await db()
      .from('interviews')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, interview: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
