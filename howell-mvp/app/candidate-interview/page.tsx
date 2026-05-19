'use client'

/**
 * Candidate Interview Page — LiveKit + Simli Humanoid Avatar
 * ===========================================================
 * Audio pipeline:
 *   Railway bot → ElevenLabs TTS → LiveKit WebRTC → candidate browser
 *   → AudioContext PCM capture → Simli.sendAudioData() → humanoid avatar video
 *
 * URL params:
 *   ?room=<livekit-room-name>
 *   &token=<participant-token>
 *   &name=<candidate-name>
 *   &applicationId=<id>
 *   &lkUrl=<livekit-wss-url>
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Mic, MicOff, PhoneOff,
  Wifi, WifiOff, AlertTriangle, ShieldAlert,
  Maximize2, Eye, Clock
} from 'lucide-react'

type Status = 'init' | 'joining' | 'waiting_for_bot' | 'active' | 'ended' | 'error'
type ViolationType = 'tab_switch' | 'fullscreen_exit' | 'camera_disabled' | 'paste_detected' | 'long_silence'

interface Violation {
  type: ViolationType
  details: string
  timestamp: string
  count: number
}

const VIOLATION_META: Record<ViolationType, { title: string; desc: string; icon: string }> = {
  tab_switch:      { icon: '⚠️', title: 'Tab Switch Detected',     desc: 'Switching tabs during the interview is not allowed and has been flagged.' },
  fullscreen_exit: { icon: '⚠️', title: 'Fullscreen Required',     desc: 'Please stay in fullscreen throughout. Exiting has been flagged.' },
  camera_disabled: { icon: '⚠️', title: 'Camera Must Stay On',     desc: 'You cannot turn your camera off during the interview.' },
  paste_detected:  { icon: '⚠️', title: 'Paste Activity Detected', desc: 'Copy-paste activity has been detected and flagged for HR.' },
  long_silence:    { icon: '⏱️', title: 'Long Silence Detected',   desc: 'An unusually long silence was detected after a question.' },
}

const TAB_SWITCH_LIMIT  = 3
const SILENCE_THRESHOLD = 45   // seconds

export default function CandidateInterviewPage() {
  // ── URL params ─────────────────────────────────────────────────────────────
  const [roomName,      setRoomName]      = useState<string | null>(null)
  const [lkUrl,         setLkUrl]         = useState<string | null>(null)
  const [token,         setToken]         = useState<string | null>(null)
  const [candidateName, setCandidateName] = useState('Candidate')
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [roundId,       setRoundId]       = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setRoomName(p.get('room'))
    setLkUrl(p.get('lkUrl'))
    setToken(p.get('token'))
    setCandidateName(p.get('name') || 'Candidate')
    setApplicationId(p.get('applicationId'))
    setRoundId(p.get('roundId') || '')
  }, [])

  // ── Call state ─────────────────────────────────────────────────────────────
  const [status,         setStatus]         = useState<Status>('init')
  const [errorMsg,       setErrorMsg]       = useState('')
  const [micMuted,       setMicMuted]       = useState(false)
  const [networkQuality, setNetworkQuality] = useState<'good' | 'poor' | 'unknown'>('unknown')
  const [simliReady,      setSimliReady]     = useState(false)
  const [simliFailed,     setSimliFailed]    = useState(false)
  const [botSpeaking,     setBotSpeaking]    = useState(false)

  const simliVideoRef  = useRef<HTMLVideoElement>(null)
  const simliAudioRef  = useRef<HTMLAudioElement>(null)
  const localVideoRef  = useRef<HTMLVideoElement>(null)
  const botAudioRef    = useRef<HTMLAudioElement>(null)   // direct bot audio fallback
  const roomRef        = useRef<any>(null)
  const simliClientRef = useRef<any>(null)
  const audioCtxRef      = useRef<any>(null)
  const analyserRef      = useRef<any>(null)
  const botLevelTimerRef = useRef<any>(null)
  const speechRecRef     = useRef<any>(null)
  const [liveTranscript,    setLiveTranscript]    = useState('')
  const [candidateSpeaking, setCandidateSpeaking] = useState(false)

  // ── Anti-cheat state ───────────────────────────────────────────────────────
  const [violations,       setViolations]      = useState<Violation[]>([])
  const [activeWarning,    setActiveWarning]   = useState<ViolationType | null>(null)
  const [riskLevel,        setRiskLevel]       = useState<'low' | 'medium' | 'high'>('low')
  const [isFullscreen,     setIsFullscreen]    = useState(false)
  const [silenceSeconds,   setSilenceSeconds]  = useState(0)
  const [showIntroConsent, setShowIntroConsent]= useState(true)
  const [consentGiven,     setConsentGiven]    = useState(false)
  const tabSwitchCount  = useRef(0)
  const silenceTimer    = useRef<NodeJS.Timeout | null>(null)
  const silenceCountRef = useRef(0)
  const activeStatusRef = useRef<Status>('init')
  useEffect(() => { activeStatusRef.current = status }, [status])

  // ── Live transcription via Web Speech API ─────────────────────────────────
  useEffect(() => {
    if (status !== 'active') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e: any) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript
      }
      setLiveTranscript(text)
      setCandidateSpeaking(!e.results[e.results.length - 1].isFinal)
    }
    rec.onerror = () => {}
    rec.onend = () => { try { rec.start() } catch(e){} }
    try { rec.start() } catch(e) {}
    speechRecRef.current = rec
    return () => { try { rec.stop() } catch(e) {} }
  }, [status])

  // ── Log violation ──────────────────────────────────────────────────────────
  const logViolation = useCallback((type: ViolationType, details = '') => {
    const ts = new Date().toISOString()
    setViolations(prev => {
      const existing = prev.find(v => v.type === type)
      const updated  = existing
        ? prev.map(v => v.type === type ? { ...v, count: v.count + 1, timestamp: ts } : v)
        : [...prev, { type, details, timestamp: ts, count: 1 }]
      const tabCount  = updated.find(v => v.type === 'tab_switch')?.count || 0
      const fsCount   = updated.find(v => v.type === 'fullscreen_exit')?.count || 0
      setRiskLevel(tabCount + fsCount >= TAB_SWITCH_LIMIT ? 'high' : tabCount + fsCount >= 1 ? 'medium' : 'low')
      return updated
    })
    setActiveWarning(type)
    setTimeout(() => setActiveWarning(null), 4000)
    if (applicationId) {
      fetch('/api/interviews/violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, roundId, type, details, timestamp: ts }),
      }).catch(() => {})
    }
  }, [applicationId, roundId])

  // ── Anti-cheat hooks ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!applicationId) return
    const handleVisibility = () => {
      if (document.hidden && activeStatusRef.current === 'active') {
        tabSwitchCount.current += 1
        logViolation('tab_switch', `Tab hidden (occurrence ${tabSwitchCount.current})`)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [applicationId, logViolation])

  useEffect(() => {
    if (!applicationId) return
    const handlePaste = () => {
      if (activeStatusRef.current === 'active') logViolation('paste_detected', 'Clipboard paste during interview')
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [applicationId, logViolation])

  useEffect(() => {
    const handleFsChange = () => {
      const inFs = !!document.fullscreenElement
      setIsFullscreen(inFs)
      if (!inFs && activeStatusRef.current === 'active') logViolation('fullscreen_exit', 'Exited fullscreen during interview')
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [logViolation])

  useEffect(() => {
    if (status !== 'active') {
      if (silenceTimer.current) clearInterval(silenceTimer.current)
      setSilenceSeconds(0); silenceCountRef.current = 0
      return
    }
    silenceTimer.current = setInterval(() => {
      silenceCountRef.current += 1
      setSilenceSeconds(silenceCountRef.current)
      if (silenceCountRef.current === SILENCE_THRESHOLD) logViolation('long_silence', `Silent for ${SILENCE_THRESHOLD}s`)
    }, 1000)
    return () => { if (silenceTimer.current) clearInterval(silenceTimer.current) }
  }, [status, logViolation])

  useEffect(() => {
    if (!micMuted && status === 'active') { silenceCountRef.current = 0; setSilenceSeconds(0) }
  }, [micMuted, status])

  // Reset silence counter whenever candidate is actively speaking
  useEffect(() => {
    if (candidateSpeaking && status === 'active') { silenceCountRef.current = 0; setSilenceSeconds(0) }
  }, [candidateSpeaking, status])

  function enterFullscreen() {
    document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
  }

  // ── Initialise Simli (v3 API) ──────────────────────────────────────────────
  const initSimli = useCallback(async () => {
    // 20-second hard timeout — if Simli hasn't connected by then, show fallback
    const failTimer = setTimeout(() => {
      if (!simliClientRef.current) {
        console.warn('[Simli] Connection timeout after 20s — showing fallback avatar')
        setSimliFailed(true)
      }
    }, 20000)

    try {
      // Fetch API key + face ID from our server proxy (keeps key off the client)
      const cfgRes = await fetch('/api/interviews/simli-session')
      if (!cfgRes.ok) {
        console.warn('[Simli] Not configured (status', cfgRes.status, ') — showing fallback avatar')
        clearTimeout(failTimer)
        setSimliFailed(true)
        return false
      }
      const { apiKey, faceId } = await cfgRes.json()
      console.log('[Simli] Config received, faceId:', faceId)

      // Dynamic import — keeps bundle small and avoids SSR issues
      const { SimliClient, generateSimliSessionToken, LogLevel } = await import('simli-client')

      // v3: generateSimliSessionToken expects { apiKey, config: { faceId, handleSilence, ... } }
      const tokenData = await generateSimliSessionToken({
        apiKey,
        config: {
          faceId:           faceId,
          handleSilence:    true,
          maxSessionLength: 3600,
          maxIdleTime:      300,
        },
      })

      const sessionToken = tokenData?.session_token || tokenData?.sessionToken
      if (!sessionToken) throw new Error('No session token returned from Simli')
      console.log('[Simli] Session token obtained, starting client…')

      // v3 constructor — NO transport='livekit': that routes Simli through LiveKit's infra
      // and breaks phoneme-accurate lip sync. Use Simli's default WebRTC transport.
      const client = new SimliClient(
        sessionToken,
        simliVideoRef.current,
        simliAudioRef.current,
        null,          // iceServers — use Simli defaults
        LogLevel.WARN,
      )

      await client.start()
      clearTimeout(failTimer)
      simliClientRef.current = client
      setSimliReady(true)
      console.log('[Simli] Avatar ready ✓ faceId:', faceId)
      return true
    } catch (err) {
      clearTimeout(failTimer)
      console.warn('[Simli] Init error — showing fallback avatar:', err)
      setSimliFailed(true)
      return false
    }
  }, [])

  // ── Pipe bot audio → Simli via PCM sendAudioData (accurate phoneme lip sync) ──
  // WHY sendAudioData instead of listenToMediastreamTrack:
  //   WebRTC always resamples audio to 48kHz internally. Simli's phoneme detector
  //   expects 16kHz PCM16. Passing a 48kHz WebRTC track gives Simli the wrong data,
  //   causing generic mouth animation. We create a 16kHz AudioContext, capture the
  //   audio as PCM16 chunks, and send them directly — exactly what Simli needs.
  const pipeBotAudioToSimli = useCallback((mediaStreamTrack: MediaStreamTrack) => {
    if (!simliClientRef.current) return
    try {
      // Close any existing AudioContext
      if (audioCtxRef.current) { audioCtxRef.current.close() }

      // 16kHz matches Simli's sendAudioData expected sample rate
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(new MediaStream([mediaStreamTrack]))

      // ── 1. Capture PCM chunks and send to Simli for lip sync ──────────────
      // 512 samples @ 16kHz = 32ms per chunk — fine granularity for phoneme tracking
      const processor = ctx.createScriptProcessor(512, 1, 1)
      source.connect(processor)
      processor.connect(ctx.destination) // must connect to stay active
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!simliClientRef.current) return
        const float32 = e.inputBuffer.getChannelData(0)
        const pcm16   = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          const clamped = Math.max(-1, Math.min(1, float32[i]))
          pcm16[i] = Math.round(clamped * 32767)
        }
        simliClientRef.current.sendAudioData(new Uint8Array(pcm16.buffer))
      }

      // ── 2. Play audio through botAudioRef so candidate hears it ───────────
      const dest = ctx.createMediaStreamDestination()
      source.connect(dest)
      if (botAudioRef.current) {
        botAudioRef.current.srcObject = dest.stream
        botAudioRef.current.play().catch(() => {})
      }

      // ── 3. Level monitor for speaking/listening indicator ─────────────────
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      if (botLevelTimerRef.current) clearInterval(botLevelTimerRef.current)
      botLevelTimerRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setBotSpeaking(avg > 8)
      }, 120)

      setBotSpeaking(true)
      console.log('[Simli] PCM sendAudioData pipeline connected at 16kHz — phoneme-accurate lip sync active')
    } catch (err) {
      console.warn('[Simli] Audio pipeline error:', err)
    }
  }, [])

  // ── Join LiveKit room ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomName || !lkUrl || !token || !consentGiven) return

    let room: any

    const join = async () => {
      setStatus('joining')

      // Init Simli before joining so avatar is ready when bot speaks
      await initSimli()

      try {
        const { Room, RoomEvent, Track, ConnectionState } = await import('livekit-client')

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: { resolution: { width: 640, height: 480, frameRate: 30 } },
        })
        roomRef.current = room

        room.on(RoomEvent.Connected, async () => {
          console.log('[LiveKit] Connected')
          setStatus('waiting_for_bot')
          try {
            const [camPub] = await Promise.all([
              room.localParticipant.setCameraEnabled(true),
              room.localParticipant.setMicrophoneEnabled(true),
            ])
            if (camPub?.track && localVideoRef.current) camPub.track.attach(localVideoRef.current)
          } catch (mediaErr) {
            console.warn('[LiveKit] Media error:', mediaErr)
          }
        })

        room.on(RoomEvent.Disconnected, (reason: any) => {
          console.log('[LiveKit] Disconnected:', reason)
          if (activeStatusRef.current === 'active') setStatus('ended')
          else { setErrorMsg('The AI interviewer disconnected. Please generate a new link.'); setStatus('error') }
        })

        room.on(RoomEvent.ConnectionStateChanged, (state: any) => {
          if (state === ConnectionState.Reconnecting) setNetworkQuality('poor')
          else if (state === ConnectionState.Connected) setNetworkQuality('good')
        })

        room.on(RoomEvent.ParticipantConnected, (participant: any) => {
          console.log('[LiveKit] Participant joined:', participant.identity)
          participant.trackPublications?.forEach((pub: any) => {
            if (pub.isSubscribed && pub.track) handleRemoteTrack(pub.track)
          })
        })

        room.on(RoomEvent.TrackSubscribed, (track: any, _pub: any, participant: any) => {
          console.log('[LiveKit] Track subscribed:', track.kind, 'from', participant.identity)
          handleRemoteTrack(track)
        })

        room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
          if (typeof track.detach === 'function') track.detach()
        })

        room.on(RoomEvent.LocalTrackPublished, (pub: any) => {
          if (pub.source === Track.Source.Camera && pub.track && localVideoRef.current) {
            pub.track.attach(localVideoRef.current)
          }
        })

        await room.connect(lkUrl, token)

      } catch (err: any) {
        console.error('[LiveKit] Error:', err)
        setErrorMsg(err?.message || 'Failed to join interview room')
        setStatus('error')
      }
    }

    function setupBotAudioMonitor(track: MediaStreamTrack) {
      try {
        if (audioCtxRef.current) { audioCtxRef.current.close(); }
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const source = ctx.createMediaStreamSource(new MediaStream([track]))
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.3
        source.connect(analyser)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        const data = new Uint8Array(analyser.frequencyBinCount)
        if (botLevelTimerRef.current) clearInterval(botLevelTimerRef.current)
        botLevelTimerRef.current = setInterval(() => {
          analyser.getByteFrequencyData(data)
          const avg = data.reduce((a, b) => a + b, 0) / data.length
          setBotSpeaking(avg > 8)
        }, 120)
      } catch (e) { console.warn('[Audio] Level monitor error:', e) }
    }

    function handleRemoteTrack(track: any) {
      const kind = track.kind ?? track.source
      console.log('[LiveKit] Handling remote track:', kind)

      if (kind === 'audio' || kind === 'microphone') {
        if (track.mediaStreamTrack && simliClientRef.current) {
          // ── Simli ready: PCM pipeline handles lip sync + playback + level monitor ──
          pipeBotAudioToSimli(track.mediaStreamTrack)
          console.log('[Audio] Routed bot audio to Simli via 16kHz PCM sendAudioData')
        } else {
          // ── Fallback: Simli not ready — play audio directly via botAudioRef ──
          try {
            if (typeof track.attach === 'function') {
              if (botAudioRef.current) {
                track.attach(botAudioRef.current)
              } else {
                const el = document.createElement('audio')
                el.autoplay = true
                el.style.display = 'none'
                document.body.appendChild(el)
                track.attach(el)
              }
            } else if (track.mediaStreamTrack) {
              const el = botAudioRef.current || document.createElement('audio')
              el.autoplay = true
              el.srcObject = new MediaStream([track.mediaStreamTrack])
              el.play().catch(() => {})
              if (!botAudioRef.current) document.body.appendChild(el)
            }
            console.log('[Audio] Bot audio attached directly (Simli not ready)')
          } catch (err) {
            console.warn('[Audio] Failed to attach bot audio:', err)
          }
          if (track.mediaStreamTrack) setupBotAudioMonitor(track.mediaStreamTrack)
        }

        setBotSpeaking(true)
        setStatus('active')
      } else if (kind === 'video' || kind === 'camera') {
        setStatus('active')
      }
    }

    join()

    return () => {
      room?.disconnect().catch(() => {})
      simliClientRef.current?.stop?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, lkUrl, token, consentGiven])

  // ── Controls ───────────────────────────────────────────────────────────────
  function toggleMic() {
    if (!roomRef.current) return
    const newMuted = !micMuted
    roomRef.current.localParticipant?.setMicrophoneEnabled(!newMuted).catch(() => {})
    setMicMuted(newMuted)
    if (!newMuted && status === 'active') { silenceCountRef.current = 0; setSilenceSeconds(0) }
  }

  function leaveCall() {
    roomRef.current?.disconnect().catch(() => {})
    setStatus('ended')
  }

  const totalViolations = violations.reduce((sum, v) => sum + v.count, 0)
  const riskColors = {
    low:    { bg: 'bg-green-500/20',  text: 'text-green-400',  label: 'Low Risk'    },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Medium Risk' },
    high:   { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'High Risk'   },
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Intro / Consent screen
  // ══════════════════════════════════════════════════════════════════════════
  if (showIntroConsent && status === 'init') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white p-6">
      <div className="max-w-lg w-full bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <div className="w-14 h-14 bg-purple-600/20 rounded-2xl flex items-center justify-center mb-6">
          <ShieldAlert className="w-7 h-7 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Interview Integrity Notice</h1>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          Before joining, please read the rules carefully. This interview is monitored for integrity.
        </p>
        <div className="space-y-3 mb-8">
          {[
            { icon: '🖥️', rule: 'Stay in fullscreen mode throughout the interview' },
            { icon: '👁️', rule: 'Do not switch tabs, windows, or applications' },
            { icon: '📷', rule: 'Keep your camera on at all times' },
            { icon: '🚫', rule: 'Do not use AI tools, search engines, or outside help' },
            { icon: '📋', rule: 'Copy-paste activity is monitored and flagged' },
            { icon: '⏱️', rule: 'Long silences after questions will be logged' },
            { icon: '📊', rule: 'All violations are reported to HR alongside your score' },
          ].map(({ icon, rule }) => (
            <div key={rule} className="flex items-start gap-3 bg-gray-800/60 rounded-xl px-4 py-3 text-sm">
              <span className="text-lg leading-none mt-0.5">{icon}</span>
              <span className="text-gray-300">{rule}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => { setShowIntroConsent(false); setConsentGiven(true); enterFullscreen() }}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
        >
          <Maximize2 className="w-4 h-4" />
          I Understand — Start Interview in Fullscreen
        </button>
        <p className="text-center text-xs text-gray-600 mt-3">
          By proceeding, you agree to the interview integrity terms above.
        </p>
      </div>
    </div>
  )

  if (!roomName && status === 'init') return (
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
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">Try Again</button>
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
        <p className="text-gray-400 leading-relaxed mb-6">
          Thank you, <strong className="text-white">{candidateName}</strong>. Your responses have been recorded and our HR team will be in touch with next steps via email.
        </p>
        {totalViolations > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-left text-sm text-yellow-300">
            <p className="font-semibold mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Integrity Notice</p>
            <p className="text-yellow-400/80 text-xs">{totalViolations} integrity event{totalViolations !== 1 ? 's' : ''} were recorded during your interview.</p>
          </div>
        )}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // Main Interview UI — Simli humanoid avatar
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">

      {/* Violation Warning Overlay */}
      {activeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-red-900/95 border-2 border-red-500 rounded-2xl px-8 py-6 max-w-sm mx-4 text-center shadow-2xl">
            <div className="text-4xl mb-3">{VIOLATION_META[activeWarning].icon}</div>
            <h3 className="font-bold text-lg mb-2 text-red-200">{VIOLATION_META[activeWarning].title}</h3>
            <p className="text-red-300 text-sm leading-relaxed">{VIOLATION_META[activeWarning].desc}</p>
            <p className="text-red-400/70 text-xs mt-3 font-medium">This has been logged for HR review</p>
          </div>
        </div>
      )}

      {/* Fullscreen nudge */}
      {!isFullscreen && status === 'active' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-yellow-900/90 border border-yellow-600 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm shadow-xl">
          <Maximize2 className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="text-yellow-200">Please return to fullscreen</span>
          <button onClick={enterFullscreen} className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition">
            Go Fullscreen
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm font-bold">H</div>
          <div>
            <p className="text-sm font-semibold leading-none">AI Interview · Howell HR</p>
            <p className="text-xs text-gray-400 mt-0.5">{candidateName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${networkQuality === 'good' ? 'bg-green-500/20 text-green-400' : networkQuality === 'poor' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
            {networkQuality === 'poor' ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {networkQuality === 'good' ? 'Good' : networkQuality === 'poor' ? 'Poor' : 'Connecting…'}
          </div>
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'active' ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {status === 'joining' ? 'Connecting…' : status === 'waiting_for_bot' ? 'AI Interviewer joining…' : 'Interview in Progress'}
          </div>
          {status === 'active' && (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${riskColors[riskLevel].bg} ${riskColors[riskLevel].text}`}>
              <Eye className="w-3 h-3" />
              {riskColors[riskLevel].label}
              {totalViolations > 0 && <span className="font-bold">· {totalViolations}</span>}
            </div>
          )}
          {status === 'active' && silenceSeconds >= 10 && (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${silenceSeconds >= SILENCE_THRESHOLD ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
              <Clock className="w-3 h-3" />
              {silenceSeconds}s silence
            </div>
          )}
        </div>
      </div>

      {/* Video area — 50/50 split */}
      <div className="flex-1 flex items-stretch p-4 gap-4 min-h-0 overflow-hidden">

        {/* ── Simli Humanoid Avatar Panel ────────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl bg-black flex-1 min-w-0"
        >
          {/* Simli video output */}
          <video
            ref={simliVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-500 ${simliReady ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* Hidden audio elements */}
          <audio ref={simliAudioRef} autoPlay style={{ display: 'none' }} />
          <audio ref={botAudioRef} autoPlay style={{ display: 'none' }} />

          {/* Loading state */}
          {!simliReady && !simliFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-purple-600/40 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-purple-600 animate-pulse" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-white font-semibold text-lg">Meera is joining…</p>
              <p className="text-gray-400 text-sm mt-1">Setting up avatar, please wait</p>
            </div>
          )}

          {/* Fallback avatar — shown when Simli is unavailable */}
          {!simliReady && simliFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
              <div className="relative mb-6">
                <div className={`w-28 h-28 rounded-full bg-purple-700 flex items-center justify-center text-5xl font-bold text-white shadow-lg ${botSpeaking ? 'ring-4 ring-purple-400 ring-offset-2 ring-offset-gray-900' : ''}`}>
                  M
                </div>
                {botSpeaking && (
                  <div className="absolute inset-0 rounded-full border-2 border-purple-400/60 animate-ping" style={{ animationDuration: '1s' }} />
                )}
              </div>
              <p className="text-white font-semibold text-lg">Meera · AI Interviewer</p>
              <p className="text-gray-500 text-xs mt-1">{botSpeaking ? '🔊 Speaking…' : '👂 Listening…'}</p>
            </div>
          )}

          {/* Speaking rings — only when bot is actively speaking */}
          {simliReady && botSpeaking && (
            <>
              <div className="absolute inset-0 rounded-2xl border-2 border-purple-500/60 animate-ping pointer-events-none" style={{ animationDuration: '1s' }} />
              <div className="absolute inset-[-4px] rounded-2xl border border-purple-400/30 animate-ping pointer-events-none" style={{ animationDuration: '1.5s' }} />
            </>
          )}

          {/* Listening mode overlay — shown when Alex is listening */}
          {simliReady && !botSpeaking && status === 'active' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-green-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Listening…
            </div>
          )}

          {/* Name label */}
          <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${botSpeaking ? 'bg-purple-400 animate-pulse' : 'bg-green-500'}`} />
            Meera · AI Interviewer
            {botSpeaking && <span className="text-xs text-purple-300 font-normal">Speaking</span>}
            {!botSpeaking && status === 'active' && <span className="text-xs text-green-300 font-normal">Listening</span>}
          </div>

          {/* Powered by badge */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Powered by Simli
          </div>
        </div>

        {/* ── Candidate local video ───────────────────────────────────────── */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-xl flex-1 min-w-0">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />

          {/* Candidate speaking indicator */}
          {candidateSpeaking && (
            <div className="absolute inset-0 rounded-2xl border-2 border-green-500/50 animate-pulse pointer-events-none" />
          )}

          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-sm font-medium flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${candidateSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {candidateName} · You
          </div>
          {micMuted && (
            <div className="absolute top-3 right-3 bg-red-500/90 p-1.5 rounded-lg">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* Live transcription bar */}
      {status === 'active' && (
        <div className="px-4 pb-2">
          <div className="bg-gray-900/90 border border-gray-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${candidateSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                Your Response
              </span>
              <button
                onClick={() => setLiveTranscript('')}
                className="text-xs text-gray-500 hover:text-gray-300 transition px-2 py-0.5 rounded-lg hover:bg-gray-800"
              >
                Clear
              </button>
            </div>
            <textarea
              value={liveTranscript}
              onChange={e => setLiveTranscript(e.target.value)}
              onCopy={e => e.preventDefault()}
              onCut={e => e.preventDefault()}
              onPaste={e => e.preventDefault()}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && ['c','v','x'].includes(e.key.toLowerCase())) {
                  e.preventDefault()
                }
              }}
              onContextMenu={e => e.preventDefault()}
              placeholder="Your answer will appear here as you speak. You can edit if needed."
              rows={2}
              className="w-full bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none leading-relaxed"
              style={{ WebkitUserSelect: 'text', userSelect: 'text' } as any}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pb-6">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          title={micMuted ? 'Unmute' : 'Mute'}
        >
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={enterFullscreen}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-gray-700 hover:bg-gray-600"
          title="Fullscreen"
        >
          <Maximize2 className="w-5 h-5" />
        </button>

        <button
          onClick={leaveCall}
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all"
          title="Leave interview"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Integrity footer */}
      <div className="text-center pb-4 px-4 text-xs text-gray-600 flex items-center justify-center gap-2">
        <ShieldAlert className="w-3 h-3" />
        This interview is monitored for integrity. All activity is logged for HR review.
      </div>
    </div>
  )
}
