/**
 * POST /api/interviews/tts-pcm
 * ElevenLabs TTS with PCM16 @ 16 kHz output — exactly what Simli's
 * sendAudioData() expects.
 *
 * Body: { text: string, voiceId?: string }
 * Response: raw PCM16 binary (Content-Type: audio/pcm)
 *
 * Required env: ELEVENLABS_API_KEY
 * Optional env: ELEVENLABS_VOICE_ID (default: Rachel — clear professional female)
 *
 * Why PCM16?
 *   Simli's SimliClient.sendAudioData() expects raw 16-bit signed PCM
 *   sampled at 16 000 Hz, mono, little-endian. ElevenLabs supports this
 *   natively via output_format=pcm_16000.
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
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 503 }
      )
    }

    const vid =
      voiceId ||
      process.env.ELEVENLABS_VOICE_ID ||
      '21m00Tcm4TlvDq8ikWAM' // Rachel — clear, professional female voice

    // Request PCM16 @ 16 kHz directly — no conversion needed
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=pcm_16000`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',  // fastest, lowest latency
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[tts-pcm] ElevenLabs error:', errText)
      return NextResponse.json(
        { error: `ElevenLabs error: ${res.status}` },
        { status: res.status }
      )
    }

    const pcmBuffer = await res.arrayBuffer()

    // Calculate duration for the client to know when audio ends
    // PCM16 @ 16kHz mono = 32 000 bytes/sec
    const durationMs = Math.round((pcmBuffer.byteLength / 32000) * 1000)

    return new NextResponse(pcmBuffer, {
      status: 200,
      headers: {
        'Content-Type':   'audio/pcm',
        'X-Sample-Rate':  '16000',
        'X-Bit-Depth':    '16',
        'X-Channels':     '1',
        'X-Duration-Ms':  String(durationMs),
        'Cache-Control':  'no-store',
      },
    })
  } catch (err: any) {
    console.error('[tts-pcm] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
