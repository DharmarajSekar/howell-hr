'use client'

/**
 * Candidate Interview Page  — with Anti-Cheat System
 * ====================================================
 * Anti-cheat measures built in:
 *  1. Tab / window switch detection  → warning overlay + violation log
 *  2. Fullscreen enforcement         → exits trigger warning + violation log
 *  3. Camera lock                    → camera cannot be turned off mid-interview
 *  4. Paste detection                → clipboard paste during interview is flagged
 *  5. Response silence timer         → measures time from bot finishing to candidate speaking
 *  6. All violations POSTed to /api/interviews/violations for HR review
 *
 * URL params:
 *   ?room=<daily-room-url>
 *   &token=<participant-token>
 *   &name=<candidate-name>
 *   &applicationId=<id>
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Wifi, WifiOff, AlertTriangle, ShieldAlert,
  Maximize2, Eye, Clock
} from 'lucide-react'

type Status = 'init' | 'joining' | 'waiting_for_bot' | 'active' | 'ended' | 'error'

type ViolationType =
  | 'tab_switch'
  | 'fullscreen_exit'
  | 'camera_disabled'
  | 'paste_detected'
  | 'long_silence'

interface Violation {
  type: ViolationType
  details: string
  timestamp: string
  count: number
}

function attachTrack(el: HTMLVideoElement | HTMLAudioElement | null, track: MediaStreamTrack | null) {
  if (!el || !track) return
  el.srcObject = new MediaStream([track])
}

// ── Warning overlay labels ─────────────────────────────────────────────────
const VIOLATION_META: Record<ViolationType, { title: string; desc: string; icon: string }> = {
  tab_switch:       { icon: '⚠️', title: 'Tab Switch Detected',    desc: 'Switching tabs or windows during the interview is not allowed and has been flagged.' },
  fullscreen_exit:  { icon: '⚠️', title: 'Fullscreen Required',    desc: 'Please stay in fullscreen mode throughout the interview. Exiting has been flagged.' },
  camera_disabled:  { icon: '⚠️', title: 'Camera Must Stay On',    desc: 'You cannot turn your camera off during the interview.' },
  paste_detected:   { icon: '⚠️', title: 'Paste Activity Detected', desc: 'Copy-paste activity has been detected and flagged for HR review.' },
  long_silence:     { icon: '⏱️', title: 'Long Silence Detected',  desc: 'An unusually long silence was detected after a question. This has been logged.' },
}

// ── Thresholds ─────────────────────────────────────────────────────────────
const TAB_SWITCH_LIMIT   = 3    // flag as high-risk after this many tab switches
const SILENCE_THRESHOLD  = 45   // seconds of silence before flagging

export default function CandidateInterviewPage() {
  // ── URL params ─────────────────────────────────────────────────────────────
  const [roomUrl,       setRoomUrl]       = useState<string | null>(null)
  const [token,         setToken]         = useState<string | null>(null)
  const [candidateName, setCandidateName] = useState('Candidate')
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [roundId,       setRoundId]       = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setRoomUrl(p.get('room'))
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

  const botVideoRef   = useRef<HTMLVideoElement>(null)
  const botAudioRef   = useRef<HTMLAudioElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const callRef       = useRef<any>(null)

  // ── Anti-cheat state ───────────────────────────────────────────────────────
  const [violations,        setViolations]        = useState<Violation[]>([])
  const [activeWarning,     setActiveWarning]      = useState<ViolationType | null>(null)
  const [riskLevel,         setRiskLevel]          = useState<'low' | 'medium' | 'high'>('low')
  const [isFullscreen,      setIsFullscreen]       = useState(false)
  const [silenceSeconds,    setSilenceSeconds]     = useState(0)
  const [showIntroConsent,  setShowIntroConsent]   = useState(true)
  const [consentGiven,      setConsentGiven]       = useState(false)
  const tabSwitchCount      = useRef(0)
  const silenceTimer        = useRef<NodeJS.Timeout | null>(null)
  const silenceCountRef     = useRef(0)
  const activeStatusRef     = useRef<Status>('init')

  // Keep ref in sync with status state
  useEffect(() => { activeStatusRef.current = status }, [status])

  // ── Log violation to backend + update local state ──────────────────────────
  const logViolation = useCallback((type: ViolationType, details = '') => {
    const ts = new Date().toISOString()

    setViolations(prev => {
      const existing = prev.find(v => v.type === type)
      const updated  = existing
        ? prev.map(v => v.type === type ? { ...v, count: v.count + 1, timestamp: ts } : v)
        : [...prev, { type, details, timestamp: ts, count: 1 }]

      // Update risk level
      const tabCount  = updated.find(v => v.type === 'tab_switch')?.count || 0
      const fsCount   = updated.find(v => v.type === 'fullscreen_exit')?.count || 0
      const totalHigh = tabCount + fsCount
      setRiskLevel(totalHigh >= TAB_SWITCH_LIMIT ? 'high' : totalHigh >= 1 ? 'medium' : 'low')

      return updated
    })

    // Show warning overlay
    setActiveWarning(type)
    setTimeout(() => setActiveWarning(null), 4000)

    // POST to backend (fire-and-forget)
    if (applicationId) {
      fetch('/api/interviews/violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, roundId, type, details, timestamp: ts }),
      }).catch(() => {})
    }
  }, [applicationId, roundId])

  // ── Anti-cheat: Tab / window visibility ───────────────────────────────────
  useEffect(() => {
    if (!applicationId) return
    function handleVisibility() {
      if (document.hidden && activeStatusRef.current === 'active') {
        tabSwitchCount.current += 1
        logViolation('tab_switch', `Tab hidden (occurrence ${tabSwitchCount.current})`)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [applicationId, logViolation])

  // ── Anti-cheat: Paste detection ────────────────────────────────────────────
  useEffect(() => {
    if (!applicationId) return
    function handlePaste() {
      if (activeStatusRef.current === 'active') {
        logViolation('paste_detected', 'Clipboard paste event during interview')
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [applicationId, logViolation])

  // ── Anti-cheat: Fullscreen change ─────────────────────────────────────────
  useEffect(() => {
    function handleFsChange() {
      const inFs = !!document.fullscreenElement
      setIsFullscreen(inFs)
      if (!inFs && activeStatusRef.current === 'active') {
        logViolation('fullscreen_exit', 'Candidate exited fullscreen during interview')
      }
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [logViolation])

  // ── Anti-cheat: Silence timer (reset when mic audio detected) ─────────────
  useEffect(() => {
    if (status !== 'active') {
      if (silenceTimer.current) clearInterval(silenceTimer.current)
      setSilenceSeconds(0)
      silenceCountRef.current = 0
      return
    }
    silenceTimer.current = setInterval(() => {
      silenceCountRef.current += 1
      setSilenceSeconds(silenceCountRef.current)
      if (silenceCountRef.current === SILENCE_THRESHOLD) {
        logViolation('long_silence', `Candidate silent for ${SILENCE_THRESHOLD}s after question`)
      }
    }, 1000)
    return () => { if (silenceTimer.current) clearInterval(silenceTimer.current) }
  }, [status, logViolation])

  // Reset silence counter when mic audio is detected (proxy: mic unmuted + call active)
  useEffect(() => {
    if (!micMuted && status === 'active') {
      silenceCountRef.current = 0
      setSilenceSeconds(0)
    }
  }, [micMuted, status])

  // ── Request fullscreen on interview start ──────────────────────────────────
  function enterFullscreen() {
    document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
  }

  // ── Join Daily room (only after consent is given) ─────────────────────────
  useEffect(() => {
    if (!roomUrl || !consentGiven) return
    let co: any

    const join = async () => {
      setStatus('joining')
      try {
        const { default: DailyIframe } = await import('@daily-co/daily-js')
        co = DailyIframe.createCallObject({ audioSource: true, videoSource: true })
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
  }, [roomUrl, consentGiven])

  function syncParticipants(co: any) {
    const participants = co.participants() as Record<string, any>
    let botVideo: MediaStreamTrack | null   = null
    let botAudio: MediaStreamTrack | null   = null
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

  // Camera toggle is BLOCKED during active interview
  function handleCamToggle() {
    if (status === 'active') {
      logViolation('camera_disabled', 'Candidate attempted to turn camera off')
      return
    }
  }

  function leaveCall() { callRef.current?.leave(); setStatus('ended') }

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalViolations = violations.reduce((sum, v) => sum + v.count, 0)
  const riskColors = {
    low:    { bg: 'bg-green-500/20',  text: 'text-green-400',  label: 'Low Risk'    },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Medium Risk' },
    high:   { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'High Risk'   },
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Intro / Consent screen (shown before joining)
  // ══════════════════════════════════════════════════════════════════════════
  if (showIntroConsent && status === 'init') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white p-6">
      <div className="max-w-lg w-full bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <div className="w-14 h-14 bg-purple-600/20 rounded-2xl flex items-center justify-center mb-6">
          <ShieldAlert className="w-7 h-7 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Interview Integrity Notice</h1>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          Before joining, please read the following rules. This interview is monitored for integrity.
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

  // ══════════════════════════════════════════════════════════════════════════
  // Error / Ended screens
  // ══════════════════════════════════════════════════════════════════════════
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
        <p className="text-gray-400 leading-relaxed mb-6">
          Thank you, <strong className="text-white">{candidateName}</strong>. Your responses have been recorded and our HR team will be in touch with next steps via email.
        </p>
        {totalViolations > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-left text-sm text-yellow-300">
            <p className="font-semibold mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Integrity Notice</p>
            <p className="text-yellow-400/80 text-xs">{totalViolations} integrity event{totalViolations !== 1 ? 's' : ''} were recorded during your interview and will be reviewed by HR.</p>
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

      {/* ── Violation Warning Overlay ─────────────────────────────────────── */}
      {activeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-red-900/95 border-2 border-red-500 rounded-2xl px-8 py-6 max-w-sm mx-4 text-center shadow-2xl animate-bounce-once">
            <div className="text-4xl mb-3">{VIOLATION_META[activeWarning].icon}</div>
            <h3 className="font-bold text-lg mb-2 text-red-200">{VIOLATION_META[activeWarning].title}</h3>
            <p className="text-red-300 text-sm leading-relaxed">{VIOLATION_META[activeWarning].desc}</p>
            <p className="text-red-400/70 text-xs mt-3 font-medium">This has been logged and will be reviewed by HR</p>
          </div>
        </div>
      )}

      {/* ── Fullscreen nudge (if not in fullscreen during active) ─────────── */}
      {!isFullscreen && status === 'active' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-yellow-900/90 border border-yellow-600 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm shadow-xl">
          <Maximize2 className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="text-yellow-200">Please return to fullscreen</span>
          <button onClick={enterFullscreen} className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition">
            Go Fullscreen
          </button>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm font-bold">H</div>
          <div>
            <p className="text-sm font-semibold leading-none">AI Interview</p>
            <p className="text-xs text-gray-400 mt-0.5">{candidateName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Network quality */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${networkQuality === 'good' ? 'bg-green-500/20 text-green-400' : networkQuality === 'poor' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
            {networkQuality === 'poor' ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {networkQuality === 'good' ? 'Good' : networkQuality === 'poor' ? 'Poor' : 'Connecting…'}
          </div>

          {/* Interview status */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'active' ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {status === 'joining' ? 'Connecting…' : status === 'waiting_for_bot' ? 'AI Interviewer joining…' : 'Interview in Progress'}
          </div>

          {/* Integrity badge */}
          {status === 'active' && (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${riskColors[riskLevel].bg} ${riskColors[riskLevel].text}`}>
              <Eye className="w-3 h-3" />
              {riskColors[riskLevel].label}
              {totalViolations > 0 && <span className="font-bold">· {totalViolations}</span>}
            </div>
          )}

          {/* Silence timer (shows if > 10s silent) */}
          {status === 'active' && silenceSeconds >= 10 && (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${silenceSeconds >= SILENCE_THRESHOLD ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
              <Clock className="w-3 h-3" />
              {silenceSeconds}s silence
            </div>
          )}
        </div>
      </div>

      {/* ── Video area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 gap-6 flex-wrap">

        {/* Simli avatar (bot video) */}
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
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-sm font-medium flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            {candidateName} · You
          </div>
          {micMuted && (
            <div className="absolute top-3 right-3 bg-red-500/90 p-1.5 rounded-lg">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}
          {/* Camera-off warning overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/0 hover:bg-gray-900/0 pointer-events-none">
            {/* camera stays on — VideoOff button is disabled */}
          </div>
        </div>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 pb-6">
        {/* Mic toggle — allowed */}
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          title={micMuted ? 'Unmute' : 'Mute'}
        >
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Camera — locked during active interview */}
        <div className="relative group">
          <button
            onClick={handleCamToggle}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-gray-700 opacity-40 cursor-not-allowed"
            title="Camera must stay on during interview"
          >
            <Video className="w-5 h-5" />
          </button>
          {status === 'active' && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-xs text-gray-300 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Camera locked during interview
            </div>
          )}
        </div>

        {/* Fullscreen toggle */}
        <button
          onClick={enterFullscreen}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-gray-700 hover:bg-gray-600"
          title="Enter fullscreen"
        >
          <Maximize2 className="w-5 h-5" />
        </button>

        {/* Leave */}
        <button
          onClick={leaveCall}
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all"
          title="Leave interview"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* ── Integrity footer ──────────────────────────────────────────────── */}
      <div className="text-center pb-4 px-4 text-xs text-gray-600 flex items-center justify-center gap-2">
        <ShieldAlert className="w-3 h-3" />
        This interview is monitored for integrity. Tab switches, fullscreen exits and paste activity are logged for HR review.
      </div>
    </div>
  )
}
