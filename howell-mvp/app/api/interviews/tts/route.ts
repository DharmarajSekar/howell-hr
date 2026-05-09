/**
 * POST /api/interviews/tts
 * Converts text to speech via ElevenLabs and streams the MP3 audio back.
 * The client decodes this into PCM to send to HeyGen for lip-sync,
 * and also plays it directly for high-quality voice output.
 *
 * Body: { text: string, voiceId?: string }
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // Use provided voiceId, env default, or the built-in "Rachel" voice
    const vid =
      voiceId ||
      process.env.ELEVENLABS_VOICE_ID ||
      '21m00Tcm4TlvDq8ikWAM'  // Rachel – clear professional female voice

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'xi-api-key':    apiKey,
          'Accept':        'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',   // fastest model (~300ms latency)
          voice_settings: {
            stability:        0.55,
            similarity_boost: 0.75,
            style:            0.0,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: `ElevenLabs error: ${errText}` },
        { status: res.status }
      )
    }

    const audioBuffer = await res.arrayBuffer()

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type':   'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control':  'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
