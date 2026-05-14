'use client'

/**
 * Candidate Interview Page
 * ========================
 * The candidate opens this link (shared by HR) and joins the Daily.co room
 * where the Pipecat bot is already waiting as "Alex (AI Interviewer)".
 *
 * Layout:
 *   ┌────────────────────────────┐  ┌─────────────────┐
 *   │  Simli avatar (bot video)  │  │  Candidate cam  │
 *   │         640 × 480          │  │    320 × 240    │
 *   └────────────────────────────┘  └─────────────────┘
 *
 * URL params (set by /api/interviews/create-ai-session):
 *   ?room=<daily-room-url>
 *   &token=<participant-token>
 *   &name=<candidate-name>
 *   &applicationId=<id>
 */

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Wifi, WifiOff } from 'lucide-react'

type Status = 'init' | 'joining' | 'waiting_for_bot' | 'active' | 'ended' | 'error'

function attachTrack(el: HTMLVideoElement | HTMLAudioElement | null, track: MediaStreamTrack | null) {
  if (!el || !track) return
  el.srcObject = new MediaStream([track])
}

export default function CandidateInterviewPage() {
  // URL params read client-side to avoid SSR issues
  const [roomUrl,       setRoomUrl]       = useState<string | null>(null)
  const [token,         setToken]         = useState<string | null>(null)
  const [candidateName, setCandidateName] = useState('Candidate')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setRoomUrl(p.get('room'))
    setToken(p.get('token'))
    setCandidateName(p.get('name') || 'Candidate')
  }, [])

  const [status,         setStatus]         = useState<Status>('init')
  const [errorMsg,       setErrorMsg]       = useState('')
  const [micMuted,       setMicMuted]       = useState(false)
  const [camOff,         setCamOff]         = useState(false)
  const [networkQuality, setNetworkQuality] = useState<'good' | 'poor' | 'unknown'>('unknown')

  const botVideoRef   = useRef<HTMLVideoElement>(null)
  const botAudioRef   = useRef<HTMLAudioElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const callRef       = useRef<any>(null)

  // Join Daily room via @daily-co/daily-js
  useEffect(() => {
    if (!roomUrl) return
    let co: any

    const join = async () => {
      setStatus('joining')
      try {
        const { default: DailyIframe } = await import('@daily-co/daily-js')
        co = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: true,
        })
        callRef.current = co

        co.on('joined-meeting',         () => setStatus('waiting_for_bot'))
        co.on('left-meeting',           () => setStatus('ended'))
        co.on('error',                  (e: any) => { setErrorMsg(e?.errorMsg || 'Connection error'); setStatus('error') })
        co.on('participant-joined',     () => syncParticipants(co))
        co.on('participant-updated',    () => syncParticipants(co))
        co.on('participant-left',       () => syncParticipants(co))
        co.on('network-quality-change', (e: any) => setNetworkQuality(e?.threshold === 'good' ? 'good' : 'poor'))

        await co.join({ url: roomUrl, token: token || undefined, userName: candidateName })
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to join interview room')
        setStatus('error')
      }
    }

    join()
    return () => { co?.leave().catch(() => {}); co?.destroy().catch(() => {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl])

  function syncParticipants(co: any) {
    const participants = co.participants() as Record<string, any>
    let botVideo: MediaStreamTrack | null  = null
    let botAudio: MediaStreamTrack | null  = null
    let localVideo: MediaStreamTrack | null = null

    Object.values(participants).forEach((p: any) => {
      if (p.local) {
        localVideo = p.tracks?.video?.persistentTrack ?? null
      } else {
        botVideo = p.tracks?.video?.persistentTrack ?? null
        botAudio = p.tracks?.audio?.persistentTrack ?? null
        if (p.tracks?.video?.state === 'playable') setStatus('active')
      }
    })

    attachTrack(botVideoRef.current,   botVideo)
    attachTrack(botAudioRef.current,   botAudio)
    attachTrack(localVideoRef.current, localVideo)
  }

  function toggleMic() {
    if (!callRef.current) return
    micMuted ? callRef.current.setLocalAudio(true) : callRef.current.setLocalAudio(false)
    setMicMuted(p => !p)
  }
  function toggleCam() {
    if (!callRef.current) return
    camOff ? callRef.current.setLocalVideo(true) : callRef.current.setLocalVideo(false)
    setCamOff(p => !p)
  }
  function leaveCall() { callRef.current?.leave(); setStatus('ended') }

  // ── Render states ─────────────────────────────────────────────────────────

  if (!roomUrl && status === 'init') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="text-center max-w-sm px-6">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-bold mb-2">Invalid Interview Link</h1>
        <p className="text-gray-400 text-sm">This link is missing required parameters. Please check your email for the correct interview link.</p>
      </div>
    </div>
  )

  if (status === 'error') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="text-center max-w-sm px-6">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold mb-2">Connection Failed</h1>
        <p className="text-gray-400 text-sm mb-4">{errorMsg}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">
          Try Again
        </button>
      </div>
    </div>
  )

  if (status === 'ended') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h1 className="text-2xl font-bold mb-3">Interview Complete</h1>
        <p className="text-gray-400 leading-relaxed">
          Thank you, <strong className="text-white">{candidateName}</strong>. Your responses have been recorded and our HR team will be in touch with next steps via email.
        </p>
      </div>
    </div>
  )

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm font-bold">H</div>
          <div>
            <p className="text-sm font-semibold leading-none">AI Interview</p>
            <p className="text-xs text-gray-400 mt-0.5">{candidateName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${networkQuality === 'good' ? 'bg-green-500/20 text-green-400' : networkQuality === 'poor' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
            {networkQuality === 'poor' ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {networkQuality === 'good' ? 'Good connection' : networkQuality === 'poor' ? 'Poor connection' : 'Connecting…'}
          </div>
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'active' ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {status === 'joining' ? 'Connecting…' : status === 'waiting_for_bot' ? 'AI Interviewer joining…' : 'Interview in Progress'}
          </div>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center p-6 gap-6 flex-wrap">

        {/* Simli avatar (from Pipecat bot) */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl" style={{ width: 640, height: 480 }}>
          <video ref={botVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <audio ref={botAudioRef} autoPlay />

          {(status === 'joining' || status === 'waiting_for_bot') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-purple-600/30 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-purple-600/50 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-purple-600 animate-pulse" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-white font-medium mb-1">
                {status === 'joining' ? 'Connecting to interview room…' : 'AI Interviewer is joining…'}
              </p>
              <p className="text-gray-400 text-sm">This usually takes a few seconds</p>
            </div>
          )}

          <div className="absolute bottom-3 left-4 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-sm font-medium flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            Alex · AI Interviewer
          </div>
        </div>

        {/* Candidate local video */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-xl" style={{ width: 320, height: 240 }}>
          <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] ${camOff ? 'hidden' : ''}`} />
          {camOff && (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-400">
                {candidateName[0]?.toUpperCase()}
              </div>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-sm font-medium flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            {candidateName} · You
          </div>
          {micMuted && (
            <div className="absolute top-3 right-3 bg-red-500/90 p-1.5 rounded-lg">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pb-8">
        <button onClick={toggleMic} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={micMuted ? 'Unmute' : 'Mute'}>
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button onClick={toggleCam} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${camOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={camOff ? 'Turn camera on' : 'Turn camera off'}>
          {camOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>
        <button onClick={leaveCall} className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all" title="Leave interview">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center pb-4 text-xs text-gray-600">
        This interview is being recorded and evaluated by AI. Results will be reviewed by HR.
      </div>
    </div>
  )
}
