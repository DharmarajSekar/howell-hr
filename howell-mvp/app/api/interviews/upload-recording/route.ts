/**
 * POST /api/interviews/upload-recording
 *
 * Public endpoint — no auth required (sessionId acts as token).
 * Receives a multipart FormData with:
 *   - video: Blob  (WebM video+audio)
 *   - sessionId: string (ai_sessions.id UUID)
 *
 * Uploads the video to Supabase Storage bucket "interview-recordings"
 * and saves the public URL back to ai_sessions.recording_url.
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

export async function POST(req: NextRequest) {
  try {
    const form      = await req.formData()
    const videoFile = form.get('video') as File | null
    const sessionId = form.get('sessionId') as string | null

    if (!videoFile || !sessionId) {
      return NextResponse.json({ error: 'Missing video or sessionId' }, { status: 400 })
    }

    const supabase   = db()
    const arrayBuf   = await videoFile.arrayBuffer()
    const buffer     = Buffer.from(arrayBuf)
    const filename   = `${sessionId}.webm`
    const bucketName = 'interview-recordings'

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filename, buffer, {
        contentType: videoFile.type || 'video/webm',
        upsert: true,
      })

    if (uploadError) {
      console.error('[upload-recording] Storage upload error:', uploadError.message)
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filename)

    const recordingUrl = urlData?.publicUrl ?? null

    // Save URL back to ai_interview_sessions
    if (recordingUrl) {
      const { error: dbError } = await supabase
        .from('ai_interview_sessions')
        .update({ recording_url: recordingUrl })
        .eq('id', sessionId)

      if (dbError) {
        console.error('[upload-recording] DB update error:', dbError.message)
        // Non-fatal — file is still uploaded
      }
    }

    return NextResponse.json({ success: true, recordingUrl })
  } catch (err: any) {
    console.error('[upload-recording] Unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
