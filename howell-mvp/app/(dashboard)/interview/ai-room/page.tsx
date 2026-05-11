'use client'
/**
 * AI Interview Room — 100% Free Stack
 *
 * Avatar  : Animated CSS/SVG face (zero cost, zero API)
 * STT     : window.SpeechRecognition (browser built-in, Chrome/Edge)
 * TTS     : window.speechSynthesis   (browser built-in, all browsers)
 * AI      : Claude Haiku via /api/interviews/ai-interview
 *
 * Custom mode : ?applicationId=X&roundId=Y&mode=custom
 * Legacy mode : ?sessionId=X  (existing Tavus sessions, unchanged)
 */

import {
  useEffect, useState, useRef, useCallback, Suspense
} from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Mic, MicOff, CheckCircle, AlertCircle, ArrowLeft,
  Bot, User, ChevronDown, ChevronUp, ThumbsUp,
  ThumbsDown, Minus, Video, RefreshCw, ExternalLink,
  Circle
} from 'lucide-react'
import Link from 'next/link'

/* ─────────────────────────────────────────────────────────────────────────────
   Animated Avatar Component
───────────────────────────────────────────────────────────────────────────── */
type AvatarState = 'idle' | 'speaking' | 'listening' | 'thinking'

function AnimatedAvatar({ state, name = 'Alex' }: { state: AvatarState; name?: string }) {
  const [mouthOpen,   setMouthOpen]   = useState(false)
  const [eyesClosed,  setEyesClosed]  = useState(false)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout>>()

  /* Mouth toggle while speaking */
  useEffect(() => {
    if (state !== 'speaking') { setMouthOpen(false); return }
    const iv = setInterval(() => setMouthOpen(p => !p), 190)
    return () => clearInterval(iv)
  }, [state])

  /* Natural eye blink */
  useEffect(() => {
    function scheduleBlink() {
      blinkTimerRef.current = setTimeout(() => {
        setEyesClosed(true)
        setTimeout(() => { setEyesClosed(false); scheduleBlink() }, 140)
      }, 2200 + Math.random() * 3500)
    }
    scheduleBlink()
    return () => clearTimeout(blinkTimerRef.current)
  }, [])

  /* Subtle pupil drift */
  useEffect(() => {
    const iv = setInterval(() => {
      setPupilOffset({
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 3,
      })
    }, 2500)
    return () => clearInterval(iv)
  }, [])

  const isListening = state === 'listening'
  const isSpeaking  = state === 'speaking'
  const isThinking  = state === 'thinking'

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 overflow-hidden">

      {/* Ambient glow */}
      <div className={`absolute w-72 h-72 rounded-full blur-3xl opacity-20 transition-colors duration-700 ${
        isListening ? 'bg-blue-400' : isSpeaking ? 'bg-violet-400' : isThinking ? 'bg-amber-300' : 'bg-indigo-400'
      }`} />

      {/* Listening pulse rings */}
      {isListening && (
        <>
          <div className="absolute w-52 h-52 rounded-full border border-blue-400/40 animate-ping" style={{ animationDuration: '1.8s' }} />
          <div className="absolute w-64 h-64 rounded-full border border-blue-300/20 animate-ping" style={{ animationDuration: '2.4s', animationDelay: '0.4s' }} />
        </>
      )}

      {/* Speaking waveform bars */}
      {isSpeaking && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-end gap-1">
          {[0.6, 1, 0.8, 1.2, 0.7, 1, 0.9, 0.6].map((h, i) => (
            <div
              key={i}
              className="w-1.5 bg-violet-400/60 rounded-full"
              style={{
                height: `${h * 18}px`,
                animation: `waveBar 0.6s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Avatar face */}
      <div className="relative z-10 flex flex-col items-center">
        <svg width="150" height="175" viewBox="0 0 150 175" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Hair */}
          <ellipse cx="75" cy="52" rx="52" ry="30" fill="#1a1a2e" />
          <ellipse cx="75" cy="48" rx="46" ry="26" fill="#2d2250" />

          {/* Face */}
          <ellipse cx="75" cy="90" rx="48" ry="52" fill="#FDBCB4" />
          <ellipse cx="75" cy="88" rx="46" ry="50" fill="#F5A89D" />

          {/* Hair front */}
          <path d="M 28 68 Q 30 48 75 44 Q 120 48 122 68" fill="#2d2250" />
          <ellipse cx="30" cy="78" rx="8" ry="20" fill="#2d2250" />
          <ellipse cx="120" cy="78" rx="8" ry="20" fill="#2d2250" />

          {/* Eyebrows */}
          <path d="M 48 72 Q 58 68 66 72" stroke="#5c3d1e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M 84 72 Q 92 68 102 72" stroke="#5c3d1e" strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* Eyes — white */}
          <ellipse cx="57" cy="82" rx="11" ry={eyesClosed ? 1.5 : 8} fill="white" style={{ transition: 'ry 0.08s' }} />
          <ellipse cx="93" cy="82" rx="11" ry={eyesClosed ? 1.5 : 8} fill="white" style={{ transition: 'ry 0.08s' }} />

          {/* Pupils */}
          {!eyesClosed && (
            <>
              <circle cx={57 + pupilOffset.x} cy={82 + pupilOffset.y} r="5.5" fill="#3b2314" style={{ transition: 'cx 0.6s, cy 0.6s' }} />
              <circle cx={93 + pupilOffset.x} cy={82 + pupilOffset.y} r="5.5" fill="#3b2314" style={{ transition: 'cx 0.6s, cy 0.6s' }} />
              {/* Eye shine */}
              <circle cx={59 + pupilOffset.x} cy={80 + pupilOffset.y} r="1.8" fill="white" />
              <circle cx={95 + pupilOffset.x} cy={80 + pupilOffset.y} r="1.8" fill="white" />
            </>
          )}

          {/* Nose */}
          <path d="M 73 95 Q 70 105 68 108 Q 75 112 82 108 Q 80 105 77 95" fill="#E8917F" opacity="0.6" />

          {/* Mouth */}
          {mouthOpen ? (
            <>
              {/* Open mouth */}
              <path d="M 58 122 Q 75 134 92 122" fill="#7c3838" />
              <path d="M 58 122 Q 75 130 92 122 Q 75 127 58 122" fill="#c45c5c" />
              {/* Teeth */}
              <path d="M 62 122 Q 75 126 88 122" fill="white" />
            </>
          ) : (
            /* Closed smile */
            <path d="M 58 120 Q 75 132 92 120" stroke="#c45c5c" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}

          {/* Cheeks */}
          <ellipse cx="44" cy="104" rx="9" ry="6" fill="#f0a0a0" opacity="0.35" />
          <ellipse cx="106" cy="104" rx="9" ry="6" fill="#f0a0a0" opacity="0.35" />

          {/* Neck */}
          <rect x="65" y="138" width="20" height="18" fill="#F5A89D" />

          {/* Collar / shirt */}
          <path d="M 30 170 Q 45 148 75 155 Q 105 148 120 170 L 150 175 L 0 175 Z" fill="#4c1d95" />
          <path d="M 65 155 L 75 165 L 85 155" fill="#6d28d9" />

          {/* Shirt lapels */}
          <path d="M 65 155 Q 50 158 30 170" stroke="#6d28d9" strokeWidth="1.5" fill="none" />
          <path d="M 85 155 Q 100 158 120 170" stroke="#6d28d9" strokeWidth="1.5" fill="none" />
        </svg>

        {/* Name / status label */}
        <div className="mt-3 flex flex-col items-center gap-1">
          <span className="text-sm font-semibold text-white">{name}</span>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
            isListening ? 'bg-blue-500/30 text-blue-200'
            : isSpeaking ? 'bg-violet-500/30 text-violet-200'
            : isThinking ? 'bg-amber-500/30 text-amber-200'
            : 'bg-white/10 text-gray-300'
          }`}>
            {isListening ? '● Listening' : isSpeaking ? '▶ Speaking' : isThinking ? '⟳ Thinking' : 'AI Interviewer'}
          </span>
        </div>
      </div>

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Browser capability check
───────────────────────────────────────────────────────────────────────────── */
function checkBrowserSupport() {
  if (typeof window === 'undefined') return { supported: false, reason: '' }
  const hasSR = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)
  const hasSS = 'speechSynthesis' in window
  if (!hasSR) return { supported: false, reason: 'Your browser does not support the Speech Recognition API. Please use Google Chrome or Microsoft Edge.' }
  if (!hasSS) return { supported: false, reason: 'Your browser does not support Speech Synthesis. Please use a modern browser.' }
  return { supported: true, reason: '' }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TTS helper (speechSynthesis)
───────────────────────────────────────────────────────────────────────────── */
function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices()
  return (
    voices.find(v => v.name.includes('Google UK English Female')) ||
    voices.find(v => v.name.includes('Microsoft Zira'))           ||
    voices.find(v => v.name.includes('Google US English'))        ||
    voices.find(v => v.lang === 'en-GB' && !v.localService)       ||
    voices.find(v => v.lang === 'en-US' && !v.localService)       ||
    voices.find(v => v.lang.startsWith('en'))                     ||
    voices[0]                                                      ||
    null
  )
}

async function speak(text: string, onStart?: () => void, onEnd?: () => void): Promise<void> {
  return new Promise(resolve => {
    speechSynthesis.cancel()
    const utt   = new SpeechSynthesisUtterance(text)
    const voice = getBestVoice()
    if (voice) utt.voice = voice
    utt.rate  = 0.92
    utt.pitch = 1.05
    utt.volume = 1.0
    utt.onstart  = () => onStart?.()
    utt.onend    = () => { onEnd?.(); resolve() }
    utt.onerror  = () => { onEnd?.(); resolve() }
    speechSynthesis.speak(utt)
  })
}

/* ─────────────────────────────────────────────────────────────────────────────
   Phase & transcript types
───────────────────────────────────────────────────────────────────────────── */
type Phase = 'setup' | 'ready' | 'opening' | 'listening' | 'processing' | 'speaking' | 'completed' | 'error'

interface TranscriptEntry {
  role:      'interviewer' | 'candidate'
  text:      string
  timestamp: string
  score?:    number
}

/* ─────────────────────────────────────────────────────────────────────────────
   Custom Bot Interview Room
───────────────────────────────────────────────────────────────────────────── */
function CustomBotRoom({ applicationId, roundId }: { applicationId: string; roundId: string | null }) {

  /* ── Per-question time limit (seconds) ── */
  const TIME_PER_QUESTION = 120  // 2 minutes per question

  /* ── State ── */
  const [phase,          setPhase]          = useState<Phase>('setup')
  const [log,            setLog]            = useState<string[]>([])
  const [questions,      setQuestions]      = useState<string[]>([])
  const [candidateName,  setCandidateName]  = useState('')
  const [jobTitle,       setJobTitle]       = useState('')
  const [sessionDbId,    setSessionDbId]    = useState<string | null>(null)
  const [questionIndex,  setQuestionIndex]  = useState(0)
  const [scores,         setScores]         = useState<number[]>([])
  const [avgScore,       setAvgScore]       = useState<number | null>(null)
  const [lastSignal,     setLastSignal]     = useState<string | null>(null)
  const [transcript,     setTranscript]     = useState<TranscriptEntry[]>([])
  const [liveText,       setLiveText]       = useState('')
  const [currentAnswer,  setCurrentAnswer]  = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [evaluation,     setEvaluation]     = useState<any>(null)
  const [micEnabled,     setMicEnabled]     = useState(true)
  const [browserOk,      setBrowserOk]      = useState(true)
  const [browserMsg,     setBrowserMsg]     = useState('')
  const [avatarState,    setAvatarState]    = useState<AvatarState>('idle')
  const [timeLeft,       setTimeLeft]       = useState<number>(TIME_PER_QUESTION)

  /* ── Refs ── */
  const webcamVideoRef      = useRef<HTMLVideoElement>(null)
  const recognitionRef      = useRef<SpeechRecognition | null>(null)
  const micStreamRef        = useRef<MediaStream | null>(null)
  const silenceTimerRef     = useRef<ReturnType<typeof setTimeout>>()
  const questionTimerRef    = useRef<ReturnType<typeof setInterval>>()
  const answerBufferRef     = useRef('')
  const questionIndexRef    = useRef(0)
  const scoresRef           = useRef<number[]>([])
  const transcriptRef       = useRef<TranscriptEntry[]>([])
  const isSpeakingRef       = useRef(false)
  const isListeningRef      = useRef(false)
  const sessionDbIdRef      = useRef<string | null>(null)
  const candidateNameRef    = useRef('')
  const jobTitleRef         = useRef('')
  const questionsRef        = useRef<string[]>([])
  const phaseRef            = useRef<Phase>('setup')
  const shouldListenRef     = useRef(false)

  const addLog = (msg: string) => setLog(p => [...p, msg])

  function setPhaseSync(p: Phase) {
    phaseRef.current = p
    setPhase(p)
  }

  /* ── Load data + request webcam ── */
  useEffect(() => {
    const { supported, reason } = checkBrowserSupport()
    if (!supported) { setBrowserOk(false); setBrowserMsg(reason); setPhaseSync('error'); return }

    async function load() {
      addLog('Loading interview data…')
      const url  = `/api/interviews/ai-interview?applicationId=${applicationId}${roundId ? `&roundId=${roundId}` : ''}`
      const res  = await fetch(url)
      const data = await res.json()
      if (data.error) { addLog(`✗ ${data.error}`); setPhaseSync('error'); return }

      setCandidateName(data.candidateName)
      setJobTitle(data.jobTitle)
      setQuestions(data.questions)
      setSessionDbId(data.sessionId)
      candidateNameRef.current = data.candidateName
      jobTitleRef.current      = data.jobTitle
      questionsRef.current     = data.questions
      sessionDbIdRef.current   = data.sessionId
      addLog(`✓ ${data.questions.length} questions ready for ${data.candidateName}`)

      // Webcam
      addLog('Requesting camera access…')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        micStreamRef.current = stream
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream
          webcamVideoRef.current.muted     = true
        }
        addLog('✓ Camera ready')
      } catch {
        addLog('⚠ Camera not available — audio only')
      }

      // Pre-load TTS voices
      speechSynthesis.getVoices()
      speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices()
      addLog('✓ Ready to start')
      setPhaseSync('ready')
    }
    load()
  }, [applicationId, roundId])

  /* ── Build SpeechRecognition ── */
  function buildRecognition(): SpeechRecognition {
    const SR = (window.SpeechRecognition || (window as any).webkitSpeechRecognition) as typeof SpeechRecognition
    const r  = new SR()
    r.continuous      = true
    r.interimResults  = true
    r.lang            = 'en-US'
    r.maxAlternatives = 1

    r.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final   = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t + ' '
        else interim += t
      }
      if (interim) setLiveText(interim)
      if (final.trim()) {
        setLiveText('')
        handleCandidateSpeech(final.trim())
      }
    }

    r.onend = () => {
      isListeningRef.current = false
      // Auto-restart if we should still be listening
      if (shouldListenRef.current && !isSpeakingRef.current) {
        try { r.start(); isListeningRef.current = true } catch { /* ignore */ }
      }
    }

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed') {
        addLog('✗ Microphone permission denied')
        setPhaseSync('error')
      }
      isListeningRef.current = false
    }

    return r
  }

  /* ── Per-question countdown timer ── */
  function startQuestionTimer() {
    clearInterval(questionTimerRef.current)
    setTimeLeft(TIME_PER_QUESTION)
    let remaining = TIME_PER_QUESTION
    questionTimerRef.current = setInterval(() => {
      remaining -= 1
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(questionTimerRef.current)
        // Auto-submit whatever the candidate has said so far
        if (phaseRef.current === 'listening') {
          const answer = answerBufferRef.current.trim()
          answerBufferRef.current = ''
          setCurrentAnswer('')
          clearTimeout(silenceTimerRef.current)
          submitAnswer(answer || '(No response given)')
        }
      }
    }, 1000)
  }

  function stopQuestionTimer() {
    clearInterval(questionTimerRef.current)
  }

  function startListening() {
    if (isSpeakingRef.current) return
    shouldListenRef.current = true
    setAvatarState('listening')
    if (!recognitionRef.current) recognitionRef.current = buildRecognition()
    if (!isListeningRef.current) {
      try { recognitionRef.current.start(); isListeningRef.current = true } catch { /* already started */ }
    }
    setPhaseSync('listening')
    startQuestionTimer()
  }

  function stopListening() {
    shouldListenRef.current = false
    isListeningRef.current  = false
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    setLiveText('')
    stopQuestionTimer()
  }

  /* ── Candidate speech → buffer with silence detection ── */
  function handleCandidateSpeech(text: string) {
    if (phaseRef.current !== 'listening') return
    answerBufferRef.current += ' ' + text
    setCurrentAnswer(answerBufferRef.current.trim())

    clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      const answer = answerBufferRef.current.trim()
      answerBufferRef.current = ''
      setCurrentAnswer('')
      if (answer.split(' ').length >= 3) submitAnswer(answer)
    }, 2800)
  }

  /* ── Avatar speaks ── */
  async function avatarSpeak(text: string) {
    isSpeakingRef.current = true
    stopListening()
    setAvatarState('speaking')
    setMicEnabled(false)

    const entry: TranscriptEntry = { role: 'interviewer', text, timestamp: new Date().toISOString() }
    transcriptRef.current = [...transcriptRef.current, entry]
    setTranscript([...transcriptRef.current])

    await speak(
      text,
      () => { setAvatarState('speaking') },
      () => { setAvatarState('idle') }
    )

    isSpeakingRef.current = false
    setMicEnabled(true)
  }

  /* ── Submit candidate answer to Claude ── */
  async function submitAnswer(answer: string) {
    if (phaseRef.current !== 'listening') return
    stopListening()
    setPhaseSync('processing')
    setAvatarState('thinking')

    const entry: TranscriptEntry = { role: 'candidate', text: answer, timestamp: new Date().toISOString() }
    transcriptRef.current = [...transcriptRef.current, entry]
    setTranscript([...transcriptRef.current])

    try {
      const res = await fetch('/api/interviews/ai-interview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          candidateName:   candidateNameRef.current,
          jobTitle:        jobTitleRef.current,
          questions:       questionsRef.current,
          questionIndex:   questionIndexRef.current,
          candidateAnswer: answer,
          scores:          scoresRef.current,
        }),
      })
      const data = await res.json()
      if (data.error) { addLog(`Claude error: ${data.error}`); startListening(); return }

      // Update scores
      if (data.score !== null && data.score !== undefined) {
        const newScores = [...scoresRef.current, data.score]
        scoresRef.current = newScores
        setScores(newScores)
        setAvgScore(data.avgScore)
        setLastSignal(data.signal)
        transcriptRef.current = transcriptRef.current.map((t, i) =>
          i === transcriptRef.current.length - 1 ? { ...t, score: data.score } : t
        )
        setTranscript([...transcriptRef.current])
      }

      if (data.isComplete) {
        await avatarSpeak(data.speech)
        setPhaseSync('completed')
        setAvatarState('idle')
        await saveInterview()
      } else {
        questionIndexRef.current = data.nextQuestionIndex
        setQuestionIndex(data.nextQuestionIndex)
        await avatarSpeak(data.speech)
        startListening()
      }
    } catch (err: any) {
      addLog(`Error: ${err.message}`)
      startListening()
    }
  }

  /* ── Save to DB on completion ── */
  async function saveInterview() {
    if (!sessionDbIdRef.current) return
    try {
      const res = await fetch('/api/interviews/ai-interview', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sessionId:     sessionDbIdRef.current,
          transcript:    transcriptRef.current,
          avgScore:      avgScore ?? Math.round((scoresRef.current.reduce((a, b) => a + b, 0) || 0) / Math.max(1, scoresRef.current.length)),
          candidateName: candidateNameRef.current,
          jobTitle:      jobTitleRef.current,
        }),
      })
      const data = await res.json()
      if (data.evaluation) setEvaluation(data.evaluation)
    } catch { /* non-fatal */ }
    micStreamRef.current?.getTracks().forEach(t => t.stop())
  }

  /* ── Start interview ── */
  async function startInterview() {
    setPhaseSync('opening')
    addLog('Starting interview…')

    // Opening speech
    const res = await fetch('/api/interviews/ai-interview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        candidateName:   candidateNameRef.current,
        jobTitle:        jobTitleRef.current,
        questions:       questionsRef.current,
        questionIndex:   0,
        candidateAnswer: null,
        scores:          [],
      }),
    })
    const data = await res.json()

    if (data.speech) await avatarSpeak(data.speech)
    startListening()
  }

  /* ── End interview manually ── */
  async function endInterview() {
    clearTimeout(silenceTimerRef.current)
    stopListening()
    const farewell = `Thank you so much for your time today, ${candidateNameRef.current}. We really appreciate your participation and will be in touch soon with the next steps.`
    await avatarSpeak(farewell)
    setPhaseSync('completed')
    setAvatarState('idle')
    await saveInterview()
  }

  function toggleMic() {
    if (!recognitionRef.current) return
    if (micEnabled) {
      stopListening()
      shouldListenRef.current = false
    } else {
      startListening()
    }
    setMicEnabled(p => !p)
  }

  /* ── Cleanup ── */
  useEffect(() => {
    return () => {
      clearTimeout(silenceTimerRef.current)
      clearInterval(questionTimerRef.current)
      shouldListenRef.current = false
      try { recognitionRef.current?.stop() } catch { /* ignore */ }
      speechSynthesis.cancel()
      micStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  /* ── Derived ── */
  const isLive       = ['opening','listening','processing','speaking'].includes(phase)
  const totalQ       = questions.length || 1
  const progressPct  = Math.round(((questionIndex) / totalQ) * 100)
  const scoreColor   = avgScore === null ? 'text-gray-400' : avgScore >= 75 ? 'text-green-500' : avgScore >= 55 ? 'text-amber-500' : 'text-red-500'

  const signalColors: Record<string, string> = {
    Strong:  'bg-green-100 text-green-700',
    Good:    'bg-blue-100 text-blue-700',
    Neutral: 'bg-gray-100 text-gray-600',
    Weak:    'bg-amber-100 text-amber-700',
    Poor:    'bg-red-100 text-red-600',
  }

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 max-w-6xl mx-auto">

      {/* Back + header */}
      <Link href="/interviews" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        Back to Interviews
      </Link>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot size={20} className="text-violet-600" /> AI Interview Room
          </h1>
          {candidateName && (
            <p className="text-sm text-gray-500 mt-0.5">{candidateName} · {jobTitle}</p>
          )}
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          phase === 'completed'  ? 'bg-green-100 text-green-700'
          : phase === 'listening'  ? 'bg-blue-100 text-blue-700'
          : phase === 'speaking'   ? 'bg-violet-100 text-violet-700'
          : phase === 'processing' ? 'bg-amber-100 text-amber-700'
          : phase === 'error'      ? 'bg-red-100 text-red-600'
          : 'bg-gray-100 text-gray-600'
        }`}>
          {phase === 'setup'       ? 'Loading'
          : phase === 'ready'      ? 'Ready'
          : phase === 'opening'    ? 'Starting…'
          : phase === 'listening'  ? '● Listening'
          : phase === 'processing' ? 'Thinking…'
          : phase === 'speaking'   ? '▶ Speaking'
          : phase === 'completed'  ? '✓ Complete'
          : 'Error'}
        </span>
      </div>

      {/* Browser not supported */}
      {!browserOk && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 flex gap-3">
          <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Browser not supported</p>
            <p className="text-sm text-amber-700 mt-1">{browserMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Video panels ── */}
        <div className="lg:col-span-2 space-y-4">

          <div className="grid grid-cols-2 gap-3">

            {/* AI avatar panel */}
            <div className="rounded-2xl overflow-hidden aspect-video shadow-lg">
              <AnimatedAvatar state={avatarState} name="Alex" />
            </div>

            {/* Candidate webcam */}
            <div className="relative bg-gray-800 rounded-2xl overflow-hidden aspect-video shadow-lg">
              <video
                ref={webcamVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* No-camera fallback */}
              <div className="absolute inset-0 flex items-center justify-center" id="cam-fallback">
                <div className="text-center text-gray-500">
                  <User size={32} className="mx-auto mb-1 opacity-40" />
                  <p className="text-xs opacity-40">No camera</p>
                </div>
              </div>
              {isLive && (
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                  <Circle size={6} className="fill-red-500 text-red-500 animate-pulse" /> REC
                </div>
              )}
              {phase === 'listening' && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-600/80 text-white text-xs px-2 py-0.5 rounded-full">
                  <Mic size={9} /> Listening
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">
                {candidateName || 'Candidate'}
              </div>
            </div>
          </div>

          {/* Setup log + start button */}
          {(phase === 'setup' || phase === 'ready') && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="space-y-1 mb-4 max-h-28 overflow-y-auto">
                {log.map((l, i) => (
                  <p key={i} className={`text-xs font-mono ${
                    l.startsWith('✗') ? 'text-red-500'
                    : l.startsWith('✓') ? 'text-green-600'
                    : l.startsWith('⚠') ? 'text-amber-500'
                    : 'text-gray-500'
                  }`}>{l}</p>
                ))}
                {phase === 'setup' && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin" />
                    Loading…
                  </div>
                )}
              </div>
              {phase === 'ready' && (
                <button
                  onClick={startInterview}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
                >
                  <Mic size={15} /> Start AI Interview
                </button>
              )}
            </div>
          )}

          {/* Live Q + candidate speech display */}
          {isLive && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              {/* Current question + countdown timer */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={12} className="text-violet-600" />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed font-medium flex-1">
                  Q{questionIndex + 1}: {questions[questionIndex] ?? '…'}
                </p>
                {/* Countdown timer — only show while candidate is answering */}
                {phase === 'listening' && (
                  <div className={`flex-shrink-0 flex flex-col items-center ml-3 ${
                    timeLeft <= 30 ? 'text-red-500' : timeLeft <= 60 ? 'text-amber-500' : 'text-gray-400'
                  }`}>
                    <span className={`text-lg font-black tabular-nums leading-none ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                      {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] font-medium uppercase tracking-wide">left</span>
                    {/* Circular progress */}
                    <svg width="32" height="32" viewBox="0 0 36 36" className="mt-1 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3"/>
                      <circle
                        cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 14}`}
                        strokeDashoffset={`${2 * Math.PI * 14 * (1 - timeLeft / TIME_PER_QUESTION)}`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Live transcription */}
              {phase === 'listening' && (
                <div className="flex items-start gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${micEnabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <Mic size={11} className={micEnabled ? 'text-blue-600' : 'text-gray-400'} />
                  </div>
                  <div className="flex-1">
                    {liveText && <p className="text-sm text-gray-400 italic">{liveText}</p>}
                    {currentAnswer && <p className="text-sm text-gray-800 mt-0.5">{currentAnswer}</p>}
                    {!liveText && !currentAnswer && (
                      <p className="text-xs text-gray-400 italic">Speak your answer — pause 3 seconds when done…</p>
                    )}
                  </div>
                </div>
              )}

              {phase === 'processing' && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <div className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
                  Evaluating response…
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          {isLive && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMic}
                disabled={phase === 'speaking' || phase === 'processing'}
                className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition disabled:opacity-40 ${
                  micEnabled ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-red-200 bg-red-50 text-red-600'
                }`}
              >
                {micEnabled ? <Mic size={13} /> : <MicOff size={13} />}
                {micEnabled ? 'Mute' : 'Unmute'}
              </button>

              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                Web Speech API · Free
              </span>

              <button
                onClick={endInterview}
                disabled={phase === 'processing' || phase === 'speaking'}
                className="ml-auto flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-900 disabled:opacity-40 transition"
              >
                End Interview
              </button>
            </div>
          )}

          {/* Transcript */}
          {transcript.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTranscript(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <span>Transcript ({transcript.length} entries)</span>
                {showTranscript ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showTranscript && (
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {[...transcript].reverse().map((line, i) => (
                    <div key={i} className={`px-4 py-3 flex gap-3 ${line.role === 'interviewer' ? 'bg-violet-50' : 'bg-white'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${line.role === 'interviewer' ? 'bg-violet-200' : 'bg-gray-200'}`}>
                        {line.role === 'interviewer' ? <Bot size={11} className="text-violet-700" /> : <User size={11} className="text-gray-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-500 capitalize">{line.role}</span>
                          {line.score !== undefined && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              line.score >= 75 ? 'bg-green-100 text-green-700' : line.score >= 55 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                            }`}>{line.score}/100</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800">{line.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: score + info ── */}
        <div className="space-y-4">

          {/* Progress */}
          {(isLive || phase === 'completed') && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Progress</span>
                <span className="text-xs text-gray-600">Q{Math.min(questionIndex + 1, totalQ)} / {totalQ}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                <span>⏱ {Math.floor(TIME_PER_QUESTION / 60)} min per question</span>
                <span>{totalQ * Math.floor(TIME_PER_QUESTION / 60)} min total</span>
              </div>
            </div>
          )}

          {/* Score hidden from candidate — HR reviews scores on Video Recordings page */}

          {/* Completed */}
          {phase === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle size={28} className="text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-700">Interview Complete</p>
              <p className="text-xs text-gray-500 mt-1">Results saved. HR can review the score & evaluation in Video Recordings.</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/pre-screen/recordings" className="inline-block text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg font-medium transition">View Score & Evaluation →</Link>
                <Link href="/interviews" className="inline-block text-xs text-violet-600 hover:underline">← Back to Interviews</Link>
              </div>
            </div>
          )}

          {/* Free stack badge */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Powered by (Free)</p>
            {[
              { label: 'Animated Avatar',    sub: 'CSS/SVG · zero cost' },
              { label: 'Web Speech API',     sub: 'Browser STT · zero cost' },
              { label: 'Speech Synthesis',   sub: 'Browser TTS · zero cost' },
              { label: 'Gemini AI',           sub: 'Interview logic · free' },
            ].map(({ label, sub }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                <div>
                  <span className="text-[10px] font-medium text-gray-700">{label}</span>
                  <span className="text-[10px] text-gray-400 ml-1">· {sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Legacy Tavus session viewer (unchanged)
───────────────────────────────────────────────────────────────────────────── */
function LegacySessionViewer({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showTx,  setShowTx]  = useState(false)
  const [retrying, setRetrying] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  const load = useCallback(async () => {
    const res  = await fetch(`/api/interviews/ai-session?sessionId=${sessionId}`)
    const data = await res.json()
    if (data.session) setSession(data.session)
    setLoading(false)
  }, [sessionId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (session?.status === 'in_progress') pollRef.current = setInterval(load, 10_000)
    else clearInterval(pollRef.current)
    return () => clearInterval(pollRef.current)
  }, [session?.status, load])

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading session…</p>
      </div>
    </div>
  )
  if (!session) return (
    <div className="p-8 text-center text-gray-400">
      <AlertCircle size={28} className="mx-auto mb-2 text-red-400" />
      <p className="text-sm">Session not found.</p>
      <Link href="/interviews" className="text-xs text-violet-600 hover:underline mt-2 inline-block">← Back</Link>
    </div>
  )

  const isDone = session.status === 'completed'

  async function retryWithTavus() {
    setRetrying(true)
    // Redirect to the free browser-based AI bot (Gemini + Web Speech API)
    if (session.application_id) {
      window.location.href = `/interview/ai-room?mode=custom&applicationId=${session.application_id}`
    } else {
      alert('No application linked to this session. Please start the interview from a candidate profile.')
      setRetrying(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/interviews" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={13} /> Back to Interviews
      </Link>
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Bot size={20} className="text-violet-600" /> AI Interview Session
      </h1>
      <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video relative">
        {session.tavus_conversation_url && !isDone ? (
          <iframe src={session.tavus_conversation_url} allow="camera; microphone; autoplay; fullscreen" className="w-full h-full" title="AI Interview" />
        ) : isDone ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <CheckCircle size={48} className="text-green-400 mb-3" />
            <p className="text-lg font-semibold">Interview Completed</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <Bot size={40} className="text-violet-300 mb-3" />
            <p className="font-semibold">Demo Mode</p>
            <button onClick={retryWithTavus} disabled={retrying} className="mt-4 flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
              {retrying ? <><RefreshCw size={14} className="animate-spin" /> Launching…</> : <><Video size={14} /> Start Live AI Interview</>}
            </button>
          </div>
        )}
      </div>
      {session.transcript?.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setShowTx(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <span>Transcript</span>
            {showTx ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showTx && (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {session.transcript.map((line: any, i: number) => (
                <div key={i} className={`px-4 py-3 flex gap-3 ${line.role === 'interviewer' ? 'bg-violet-50' : ''}`}>
                  <p className="text-sm text-gray-800">{line.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Router
───────────────────────────────────────────────────────────────────────────── */
function AIRoomContent() {
  const sp            = useSearchParams()
  const sessionId     = sp.get('sessionId')
  const applicationId = sp.get('applicationId')
  const roundId       = sp.get('roundId')
  const mode          = sp.get('mode')

  if (mode === 'custom' && applicationId) return <CustomBotRoom applicationId={applicationId} roundId={roundId} />
  if (sessionId)                          return <LegacySessionViewer sessionId={sessionId} />

  return (
    <div className="p-8 max-w-2xl mx-auto text-center py-20">
      <Bot size={40} className="mx-auto mb-3 text-gray-300" />
      <p className="text-sm text-gray-500">No session selected.</p>
      <p className="text-xs mt-1 text-gray-400">Navigate here from a candidate's interview card.</p>
      <Link href="/interviews" className="mt-4 inline-block text-xs text-violet-600 hover:underline">← Back to Interviews</Link>
    </div>
  )
}

export default function AIRoomPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    }>
      <AIRoomContent />
    </Suspense>
  )
}
