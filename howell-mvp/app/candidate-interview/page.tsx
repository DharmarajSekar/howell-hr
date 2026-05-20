'use client'

/**
 * Candidate Interview Page — LiveKit + Browser STT + Browser TTS
 * ===============================================================
 * Architecture:
 *   Browser SpeechRecognition (STT) → LiveKit data channel (transcript text)
 *   → Railway bot (Gemini) → LiveKit data channel (response text)
 *   → Browser SpeechSynthesis (TTS) → start listening again → repeat
 *
 * Avatar: Animated placeholder now. Simli lip-sync avatar — coming next.
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

type Status    = 'init' | 'joining' | 'waiting_for_bot' | 'active' | 'ended' | 'error'
type ConvState = 'idle' | 'bot_speaking' | 'listening' | 'processing'
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
const SILENCE_THRESHOLD = 45

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
  const [convState,      setConvState]      = useState<ConvState>('idle')
  const [botSpeaking,    setBotSpeaking]    = useState(false)
  const [liveTranscript,    setLiveTranscript]    = useState('')
  const [candidateSpeaking, setCandidateSpeaking] = useState(false)

  const localVideoRef     = useRef<HTMLVideoElement>(null)
  const roomRef           = useRef<any>(null)
  const convStateRef      = useRef<ConvState>('idle')
  const recognitionRef    = useRef<any>(null)
  const speakQueueRef     = useRef<string[]>([])
  const isSpeakingRef     = useRef(false)
  const liveTranscriptRef = useRef('')

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

  // Keep liveTranscriptRef in sync for use inside recognition callbacks
  useEffect(() => { liveTranscriptRef.current = liveTranscript }, [liveTranscript])
  // Keep convStateRef in sync
  useEffect(() => { convStateRef.current = convState }, [convState])

  // ── Log violation ──────────────────────────────────────────────────────────
  const logViolation = useCallback((type: ViolationType, details = '') => {
    const ts = new Date().toISOString()
    setViolations(prev => {
      const existing = prev.find(v => v.type === type)
      const updated  = existing
        ? prev.map(v => v.type === type ? { ...v, count: v.count + 1, timestamp: ts } : v)
        : [...prev, { type, details, timestamp: ts, count: 1 }]
      const tabCount = updated.find(v => v.type === 'tab_switch')?.count || 0
      const fsCount  = updated.find(v => v.type === 'fullscreen_exit')?.count || 0
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
    const h = () => {
      if (document.hidden && activeStatusRef.current === 'active') {
        tabSwitchCount.current += 1
        logViolation('tab_switch', `Tab hidden (${tabSwitchCount.current})`)
      }
    }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [applicationId, logViolation])

  useEffect(() => {
    if (!applicationId) return
    const h = () => { if (activeStatusRef.current === 'active') logViolation('paste_detected') }
    document.addEventListener('paste', h)
    return () => document.removeEventListener('paste', h)
  }, [applicationId, logViolation])

  useEffect(() => {
    const h = () => {
      const inFs = !!document.fullscreenElement
      setIsFullscreen(inFs)
      if (!inFs && activeStatusRef.current === 'active') logViolation('fullscreen_exit')
    }
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
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
      if (silenceCountRef.current === SILENCE_THRESHOLD) logViolation('long_silence')
    }, 1000)
    return () => { if (silenceTimer.current) clearInterval(silenceTimer.current) }
  }, [status, logViolation])

  useEffect(() => {
    if (!micMuted && status === 'active') { silenceCountRef.current = 0; setSilenceSeconds(0) }
  }, [micMuted, status])

  useEffect(() => {
    if (candidateSpeaking && status === 'active') { silenceCountRef.current = 0; setSilenceSeconds(0) }
  }, [candidateSpeaking, status])

  function enterFullscreen() {
    document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
  }

  // ── Send message to bot via LiveKit data channel ─────────────────────────
  const sendToBot = useCallback((type: string, text = '') => {
    try {
      const room = roomRef.current
      if (!room?.localParticipant) return
      const payload = new TextEncoder().encode(JSON.stringify({ type, text }))
      room.localParticipant.publishData(payload, { reliable: true }).catch(() => {})
    } catch (_) {}
  }, [])

  // ── Start listening via browser SpeechRecognition ─────────────────────────
  const startListening = useCallback(() => {
    // Stop any existing recognition session
    try { recognitionRef.current?.abort() } catch (_) {}

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      console.warn('[STT] SpeechRecognition not supported in this browser')
      return
    }

    setConvState('listening')
    convStateRef.current = 'listening'
    setLiveTranscript('')
    liveTranscriptRef.current = ''

    const rec = new SR()
    // continuous=true so brief pauses don't cut off the answer mid-sentence.
    // We use a 2.5s silence timer to detect when the candidate has finished speaking.
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-IN'
    recognitionRef.current = rec

    let finalTranscript = ''
    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    const sendTranscriptNow = () => {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
      try { rec.stop() } catch (_) {}   // fires onend which does the actual send
    }

    rec.onstart = () => console.log('[STT] Listening started')

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + ' '
        } else {
          interim += e.results[i][0].transcript
        }
      }
      const combined = (finalTranscript + interim).trim()
      setLiveTranscript(combined)
      liveTranscriptRef.current = combined
      setCandidateSpeaking(!!interim)
      // Reset anti-cheat silence counter while speaking
      silenceCountRef.current = 0
      setSilenceSeconds(0)

      // Reset the 2.5s silence timer on every speech event.
      // Only trigger after we have at least some final transcript.
      if (finalTranscript.trim().length > 2) {
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          if (convStateRef.current === 'listening') sendTranscriptNow()
        }, 2500)
      }
    }

    rec.onspeechend = () => setCandidateSpeaking(false)

    rec.onend = () => {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
      setCandidateSpeaking(false)
      if (convStateRef.current !== 'listening') return
      const transcript = finalTranscript.trim()
      if (transcript.length > 2) {
        console.log('[STT] Sending transcript:', transcript)
        setConvState('processing')
        convStateRef.current = 'processing'
        sendToBot('transcript', transcript)
        setLiveTranscript('')
      } else {
        // Nothing captured — restart listening after short delay
        setTimeout(() => {
          if (convStateRef.current === 'listening') startListening()
        }, 400)
      }
    }

    rec.onerror = (e: any) => {
      console.warn('[STT] Error:', e.error)
      setCandidateSpeaking(false)
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
      // Restart on recoverable errors
      if (['no-speech', 'audio-capture', 'network'].includes(e.error) && convStateRef.current === 'listening') {
        setTimeout(() => {
          if (convStateRef.current === 'listening') startListening()
        }, 500)
      }
    }

    try { rec.start() } catch (e) { console.warn('[STT] Start failed:', e) }
  }, [sendToBot])

  // ── Speak text via browser TTS, then start listening ─────────────────────
  const speak = useCallback((text: string) => {
    // Queue if already speaking
    if (isSpeakingRef.current) {
      speakQueueRef.current.push(text)
      return
    }

    isSpeakingRef.current = true
    setConvState('bot_speaking')
    convStateRef.current = 'bot_speaking'
    setBotSpeaking(true)

    // Stop any active recognition while bot speaks
    try { recognitionRef.current?.stop() } catch (_) {}

    const doSpeak = () => {
      if (!window.speechSynthesis) {
        isSpeakingRef.current = false
        setBotSpeaking(false)
        startListening()
        return
      }
      window.speechSynthesis.cancel()
      const utt = new SpeechSynthesisUtterance(text)
      utt.rate  = 1.0
      utt.pitch = 1.05
      utt.volume = 1.0
      // Prefer Indian-English female voice
      const voices = window.speechSynthesis.getVoices()
      const voice = voices.find(v => v.lang.startsWith('en') && /female|woman|zira|susan|karen|samantha|heera/i.test(v.name))
                 || voices.find(v => v.lang.startsWith('en-IN'))
                 || voices.find(v => v.lang.startsWith('en'))
      if (voice) utt.voice = voice

      utt.onend = () => {
        isSpeakingRef.current = false
        setBotSpeaking(false)
        silenceCountRef.current = 0
        setSilenceSeconds(0)
        // Process queue or start listening
        if (speakQueueRef.current.length > 0) {
          speak(speakQueueRef.current.shift()!)
        } else {
          startListening()
        }
      }
      utt.onerror = () => {
        isSpeakingRef.current = false
        setBotSpeaking(false)
        startListening()
      }
      window.speechSynthesis.speak(utt)
    }

    const voices = window.speechSynthesis?.getVoices() || []
    if (voices.length > 0) {
      doSpeak()
    } else {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = doSpeak
      setTimeout(doSpeak, 800)
    }
  }, [startListening])

  // ── Join LiveKit room ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomName || !lkUrl || !token || !consentGiven) return

    let room: any

    const join = async () => {
      setStatus('joining')

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
          } catch (e) {
            console.warn('[LiveKit] Media error:', e)
          }
          if (room.remoteParticipants.size > 0) setStatus('active')
        })

        room.on(RoomEvent.Disconnected, () => {
          if (activeStatusRef.current === 'active') setStatus('ended')
          else { setErrorMsg('Connection lost. Please generate a new interview link.'); setStatus('error') }
        })

        room.on(RoomEvent.ConnectionStateChanged, (state: any) => {
          if (state === ConnectionState.Reconnecting) setNetworkQuality('poor')
          else if (state === ConnectionState.Connected) setNetworkQuality('good')
        })

        // Bot joined → mark active + send ready signal so bot sends greeting
        room.on(RoomEvent.ParticipantConnected, (participant: any) => {
          console.log('[LiveKit] Bot joined:', participant.identity)
          setStatus('active')
          // Signal bot we're ready to receive the greeting
          setTimeout(() => {
            try {
              const payload = new TextEncoder().encode(JSON.stringify({ type: 'ready' }))
              room.localParticipant.publishData(payload, { reliable: true }).catch(() => {})
            } catch (_) {}
          }, 500)
        })

        // ── Receive messages from bot ─────────────────────────────────────
        room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload))
            console.log('[Bot→Frontend]', msg.type, msg.text?.slice(0, 60) || '')

            if (msg.type === 'bot_speech' && msg.text) {
              speak(msg.text)
            } else if (msg.type === 'bot_thinking') {
              setConvState('processing')
              convStateRef.current = 'processing'
            }
          } catch (_) {}
        })

        room.on(RoomEvent.LocalTrackPublished, (pub: any) => {
          if (pub.source === Track.Source.Camera && pub.track && localVideoRef.current) {
            pub.track.attach(localVideoRef.current)
          }
        })

        await room.connect(lkUrl, token)

      } catch (err: any) {
        console.error('[LiveKit]', err)
        setErrorMsg(err?.message || 'Failed to join room')
        setStatus('error')
      }
    }

    join()

    return () => {
      try { recognitionRef.current?.stop() } catch (_) {}
      window.speechSynthesis?.cancel()
      room?.disconnect().catch(() => {})
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
    try { recognitionRef.current?.stop() } catch (_) {}
    window.speechSynthesis?.cancel()
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
  // Main Interview UI
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">

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

      {!isFullscreen && status === 'active' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-yellow-900/90 border border-yellow-600 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm shadow-xl">
          <Maximize2 className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="text-yellow-200">Please return to fullscreen</span>
          <button onClick={enterFullscreen} className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition">Go Fullscreen</button>
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

      {/* Video area */}
      <div className="flex-1 flex items-stretch p-4 gap-4 min-h-0 overflow-hidden">

        {/* Meera Avatar Panel */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl flex-1 min-w-0 bg-gradient-to-b from-gray-900 to-gray-950 flex flex-col items-center justify-center">

          {/* Animated avatar */}
          <div className="relative mb-6">
            {/* Outer pulse rings when speaking */}
            {botSpeaking && <>
              <div className="absolute inset-[-16px] rounded-full border-2 border-purple-500/30 animate-ping" style={{ animationDuration: '1s' }} />
              <div className="absolute inset-[-8px] rounded-full border-2 border-purple-400/40 animate-ping" style={{ animationDuration: '1.4s' }} />
            </>}
            {/* Listening pulse ring */}
            {convState === 'listening' && (
              <div className="absolute inset-[-6px] rounded-full border-2 border-green-400/50 animate-pulse" />
            )}
            {/* Avatar circle */}
            <div className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl font-bold text-white shadow-2xl transition-all duration-300
              ${botSpeaking ? 'bg-gradient-to-br from-purple-600 to-purple-800 ring-4 ring-purple-400/50 ring-offset-2 ring-offset-gray-950 scale-105' : ''}
              ${convState === 'listening' ? 'bg-gradient-to-br from-green-700 to-green-900 ring-2 ring-green-400/40 ring-offset-2 ring-offset-gray-950' : ''}
              ${convState === 'processing' ? 'bg-gradient-to-br from-blue-700 to-blue-900' : ''}
              ${convState === 'idle' || status !== 'active' ? 'bg-gradient-to-br from-purple-800 to-gray-800' : ''}
            `}>
              M
            </div>
            {/* Sound wave bars when speaking */}
            {botSpeaking && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1">
                {[3,5,8,5,3,6,4,7,4].map((h, i) => (
                  <div key={i} className="w-1 bg-purple-400 rounded-full animate-pulse" style={{ height: `${h * 3}px`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
          </div>

          <p className="text-white font-semibold text-xl mt-4">Meera</p>
          <p className="text-gray-400 text-sm mt-1">AI Interviewer · Howell HR</p>

          {/* State pill */}
          <div className={`mt-4 px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all
            ${status !== 'active' ? 'bg-yellow-500/20 text-yellow-300' : ''}
            ${convState === 'bot_speaking' ? 'bg-purple-500/20 text-purple-300' : ''}
            ${convState === 'listening' ? 'bg-green-500/20 text-green-300' : ''}
            ${convState === 'processing' ? 'bg-blue-500/20 text-blue-300' : ''}
            ${convState === 'idle' && status === 'active' ? 'bg-gray-700 text-gray-400' : ''}
          `}>
            <span className={`w-1.5 h-1.5 rounded-full
              ${status !== 'active' ? 'bg-yellow-400 animate-pulse' : ''}
              ${convState === 'bot_speaking' ? 'bg-purple-400 animate-pulse' : ''}
              ${convState === 'listening' ? 'bg-green-400 animate-pulse' : ''}
              ${convState === 'processing' ? 'bg-blue-400 animate-pulse' : ''}
              ${convState === 'idle' && status === 'active' ? 'bg-gray-500' : ''}
            `} />
            {status !== 'active' && '⏳ Joining…'}
            {status === 'active' && convState === 'bot_speaking' && '🔊 Speaking…'}
            {status === 'active' && convState === 'listening' && '👂 Listening…'}
            {status === 'active' && convState === 'processing' && '🤔 Thinking…'}
            {status === 'active' && convState === 'idle' && 'Ready'}
          </div>

          {/* Simli avatar coming soon badge */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-gray-400">
            Avatar upgrade coming soon
          </div>
        </div>

        {/* Candidate video */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-xl flex-1 min-w-0">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {candidateSpeaking && <div className="absolute inset-0 rounded-2xl border-2 border-green-500/50 animate-pulse pointer-events-none" />}
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

      {/* Transcript bar */}
      {status === 'active' && (
        <div className="px-4 pb-2">
          <div className="bg-gray-900/90 border border-gray-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${candidateSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                Your Response
              </span>
              <button onClick={() => setLiveTranscript('')} className="text-xs text-gray-500 hover:text-gray-300 transition px-2 py-0.5 rounded-lg hover:bg-gray-800">Clear</button>
            </div>
            <textarea
              value={liveTranscript}
              onChange={e => setLiveTranscript(e.target.value)}
              onCopy={e => e.preventDefault()}
              onCut={e => e.preventDefault()}
              onPaste={e => e.preventDefault()}
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
        <button onClick={toggleMic} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={micMuted ? 'Unmute' : 'Mute'}>
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button onClick={enterFullscreen} className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-gray-700 hover:bg-gray-600" title="Fullscreen">
          <Maximize2 className="w-5 h-5" />
        </button>
        <button onClick={leaveCall} className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all" title="Leave interview">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center pb-4 px-4 text-xs text-gray-600 flex items-center justify-center gap-2">
        <ShieldAlert className="w-3 h-3" />
        This interview is monitored for integrity. All activity is logged for HR review.
      </div>
    </div>
  )
}
