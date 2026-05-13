'use client'
/**
 * Public Candidate AI Interview Page
 * Route: /candidate-interview?sessionId=<uuid>
 */

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mic, MicOff, CheckCircle, AlertCircle, Bot, User, Circle, Square } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────────
   Realistic Human Avatar
───────────────────────────────────────────────────────────────────────────── */
type AvatarState = 'idle' | 'speaking' | 'listening' | 'thinking'

function HumanAvatar({ state }: { state: AvatarState }) {
  const [mouthOpen,   setMouthOpen]   = useState(false)
  const [eyesClosed,  setEyesClosed]  = useState(false)
  const [pupilX,      setPupilX]      = useState(0)
  const blinkRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (state !== 'speaking') { setMouthOpen(false); return }
    const iv = setInterval(() => setMouthOpen(p => !p), 200)
    return () => clearInterval(iv)
  }, [state])

  useEffect(() => {
    function blink() {
      blinkRef.current = setTimeout(() => {
        setEyesClosed(true)
        setTimeout(() => { setEyesClosed(false); blink() }, 130)
      }, 2500 + Math.random() * 4000)
    }
    blink()
    return () => clearTimeout(blinkRef.current)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => setPupilX((Math.random() - 0.5) * 4), 3000)
    return () => clearInterval(iv)
  }, [])

  const gradients: Record<AvatarState, [string, string]> = {
    idle:      ['#0f0c29', '#302b63'],
    speaking:  ['#1a0533', '#3d1a6e'],
    listening: ['#0a1628', '#1e3a5f'],
    thinking:  ['#0d1117', '#21262d'],
  }
  const [g1, g2] = gradients[state]

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden"
         style={{ background: `linear-gradient(160deg, ${g1} 0%, ${g2} 100%)` }}>

      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full opacity-20"
          style={{ width: 400, height: 400, top: '10%', left: '50%', transform: 'translateX(-50%)',
            background: state === 'speaking' ? 'radial-gradient(circle, #7c3aed, transparent)' : 'radial-gradient(circle, #4f46e5, transparent)',
            filter: 'blur(60px)', transition: 'background 0.8s' }}/>
      </div>

      {/* Speaking wave bars at bottom */}
      {state === 'speaking' && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-end gap-1.5 z-10">
          {[6, 12, 18, 24, 30, 24, 18, 12, 6].map((h, i) => (
            <div key={i} className="w-1.5 rounded-full bg-violet-400/60 animate-pulse"
              style={{ height: h, animationDelay: `${i * 0.08}s`, animationDuration: '0.6s' }}/>
          ))}
        </div>
      )}

      {/* Human Avatar SVG */}
      <svg
        viewBox="0 0 320 460"
        className="relative z-10 w-full h-full"
        style={{ maxHeight: '90%', maxWidth: '70%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="skinGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#F5C5A3"/>
            <stop offset="100%" stopColor="#E8A87C"/>
          </radialGradient>
          <radialGradient id="hairGrad" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#3D2008"/>
            <stop offset="100%" stopColor="#1C0D03"/>
          </radialGradient>
          <linearGradient id="blazerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e2d4a"/>
            <stop offset="100%" stopColor="#111827"/>
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#00000060"/>
          </filter>
        </defs>

        {/* ── BODY / BLAZER ── */}
        {/* Torso */}
        <path d="M60 320 Q90 300 160 295 Q230 300 260 320 L280 460 H40 Z" fill="url(#blazerGrad)"/>
        {/* Blazer left lapel */}
        <path d="M130 295 L105 330 L100 380 L120 340 L145 310 Z" fill="#162236"/>
        {/* Blazer right lapel */}
        <path d="M190 295 L215 330 L220 380 L200 340 L175 310 Z" fill="#162236"/>
        {/* White shirt / inner collar */}
        <path d="M145 295 L130 310 L160 330 L190 310 L175 295 L160 305 Z" fill="#e8e8e8"/>
        {/* Collar crease */}
        <path d="M145 295 L160 315 L175 295" stroke="#ccc" strokeWidth="1" fill="none"/>

        {/* ── NECK ── */}
        <rect x="138" y="248" width="44" height="55" rx="8" fill="url(#skinGrad)"/>
        {/* Neck shadow */}
        <ellipse cx="160" cy="268" rx="18" ry="6" fill="#D4956A" opacity="0.3"/>

        {/* ── HAIR — back layer (behind head) ── */}
        {/* Left side hair */}
        <path d="M68 140 Q48 180 44 240 Q42 290 55 330 Q60 345 68 330 Q58 290 60 240 Q62 190 78 150 Z"
          fill="url(#hairGrad)"/>
        {/* Right side hair */}
        <path d="M252 140 Q272 180 276 240 Q278 290 265 330 Q260 345 252 330 Q262 290 260 240 Q258 190 242 150 Z"
          fill="url(#hairGrad)"/>

        {/* ── HEAD ── */}
        <ellipse cx="160" cy="178" rx="82" ry="92" fill="url(#skinGrad)" filter="url(#softShadow)"/>

        {/* ── HAIR — front/top layer ── */}
        {/* Top hair mass */}
        <ellipse cx="160" cy="100" rx="85" ry="52" fill="url(#hairGrad)"/>
        <rect x="75" y="100" width="170" height="45" fill="url(#hairGrad)"/>
        {/* Hair parting highlight */}
        <path d="M160 58 Q165 75 162 100" stroke="#5C3010" strokeWidth="2" fill="none" opacity="0.5"/>
        {/* Side hair framing - left */}
        <path d="M78 125 Q62 150 66 195 Q68 210 75 210 Q72 190 76 160 Q80 140 88 130 Z"
          fill="url(#hairGrad)"/>
        {/* Side hair framing - right */}
        <path d="M242 125 Q258 150 254 195 Q252 210 245 210 Q248 190 244 160 Q240 140 232 130 Z"
          fill="url(#hairGrad)"/>

        {/* ── EARS ── */}
        <ellipse cx="79" cy="183" rx="13" ry="17" fill="#E8A87C"/>
        <ellipse cx="79" cy="183" rx="7" ry="10" fill="#D4956A"/>
        <ellipse cx="241" cy="183" rx="13" ry="17" fill="#E8A87C"/>
        <ellipse cx="241" cy="183" rx="7" ry="10" fill="#D4956A"/>
        {/* Ear rings */}
        <circle cx="79" cy="197" r="4" fill="#d4a843" stroke="#b8922e" strokeWidth="1"/>
        <circle cx="241" cy="197" r="4" fill="#d4a843" stroke="#b8922e" strokeWidth="1"/>

        {/* ── EYEBROWS ── */}
        <path
          d={state === 'thinking'
            ? "M112 138 Q130 130 150 136"
            : "M112 140 Q130 132 150 138"}
          stroke="#2C1A0E" strokeWidth="4.5" fill="none" strokeLinecap="round"
          className="transition-all duration-300"/>
        <path
          d={state === 'thinking'
            ? "M170 136 Q190 130 208 138"
            : "M170 138 Q190 132 208 140"}
          stroke="#2C1A0E" strokeWidth="4.5" fill="none" strokeLinecap="round"
          className="transition-all duration-300"/>

        {/* ── EYES ── */}
        {/* Left eye white */}
        <ellipse cx="131" cy="168" rx="20" ry={eyesClosed ? 2.5 : 15} fill="white"
          className="transition-all duration-100"/>
        {/* Left iris + pupil */}
        {!eyesClosed && <>
          <circle cx={131 + pupilX} cy="169" r="11" fill="#5C3010"/>
          <circle cx={131 + pupilX} cy="169" r="7" fill="#1A0800"/>
          <circle cx={134 + pupilX} cy="165" r="3.5" fill="white"/>
          <circle cx={129 + pupilX} cy="172" r="1.5" fill="white" opacity="0.6"/>
        </>}
        {/* Left upper lash line */}
        <path d="M111 160 Q131 152 151 160" stroke="#1C0D03" strokeWidth="3" fill="none" strokeLinecap="round"/>
        {/* Left lower lash */}
        <path d="M114 178 Q131 183 148 178" stroke="#3D2008" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6"/>

        {/* Right eye white */}
        <ellipse cx="189" cy="168" rx="20" ry={eyesClosed ? 2.5 : 15} fill="white"
          className="transition-all duration-100"/>
        {/* Right iris + pupil */}
        {!eyesClosed && <>
          <circle cx={189 + pupilX} cy="169" r="11" fill="#5C3010"/>
          <circle cx={189 + pupilX} cy="169" r="7" fill="#1A0800"/>
          <circle cx={192 + pupilX} cy="165" r="3.5" fill="white"/>
          <circle cx={187 + pupilX} cy="172" r="1.5" fill="white" opacity="0.6"/>
        </>}
        {/* Right upper lash line */}
        <path d="M169 160 Q189 152 209 160" stroke="#1C0D03" strokeWidth="3" fill="none" strokeLinecap="round"/>
        {/* Right lower lash */}
        <path d="M172 178 Q189 183 206 178" stroke="#3D2008" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6"/>

        {/* ── NOSE ── */}
        <path d="M155 190 Q148 212 152 218 Q160 222 168 218 Q172 212 165 190"
          stroke="#D4956A" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <ellipse cx="154" cy="218" rx="5" ry="3.5" fill="#D4956A" opacity="0.4"/>
        <ellipse cx="166" cy="218" rx="5" ry="3.5" fill="#D4956A" opacity="0.4"/>

        {/* ── MOUTH / LIPS ── */}
        {mouthOpen ? (
          <>
            {/* Open mouth - speaking */}
            <path d="M133 238 Q160 232 187 238 Q175 258 160 262 Q145 258 133 238 Z" fill="#8B2635"/>
            {/* Upper lip */}
            <path d="M133 238 Q147 230 160 234 Q173 230 187 238" fill="#C0534A" stroke="#A03A35" strokeWidth="1"/>
            {/* Lower lip */}
            <path d="M133 238 Q160 255 187 238" fill="#D4635A" stroke="#A03A35" strokeWidth="0.5"/>
            {/* Teeth hint */}
            <path d="M140 240 Q160 237 180 240 Q175 248 160 249 Q145 248 140 240 Z" fill="white" opacity="0.85"/>
          </>
        ) : (
          <>
            {/* Closed natural smile */}
            <path d="M133 238 Q147 230 160 234 Q173 230 187 238" fill="#C0534A" stroke="#A03A35" strokeWidth="1"/>
            <path d="M133 238 Q160 253 187 238" fill="#D4635A" stroke="#A03A35" strokeWidth="0.5"/>
            <path d="M133 238 Q160 244 187 238" fill="none" stroke="#B04040" strokeWidth="1" opacity="0.4"/>
          </>
        )}
        {/* Lip gloss highlight */}
        <ellipse cx="156" cy="240" rx="10" ry="3" fill="white" opacity="0.15"/>

        {/* ── CHEEK blush ── */}
        <ellipse cx="107" cy="205" rx="16" ry="10" fill="#E87878" opacity="0.18"/>
        <ellipse cx="213" cy="205" rx="16" ry="10" fill="#E87878" opacity="0.18"/>
      </svg>

      {/* Name + state label */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <p className="text-white font-bold text-lg tracking-wide drop-shadow-lg">Alex</p>
        <p className="text-violet-300 text-xs capitalize mt-0.5 drop-shadow">
          {state === 'speaking' ? '🔊 Speaking…'
            : state === 'listening' ? '🎙 Listening…'
            : state === 'thinking'  ? '💭 Thinking…'
            : '⏳ Waiting'}
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Browser support
───────────────────────────────────────────────────────────────────────────── */
function checkBrowserSupport() {
  if (typeof window === 'undefined') return { supported: false, reason: '' }
  const hasSR = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)
  const hasSS = 'speechSynthesis' in window
  if (!hasSR) return { supported: false, reason: 'Please use Google Chrome or Microsoft Edge.' }
  if (!hasSS) return { supported: false, reason: 'Your browser does not support Speech Synthesis. Use Chrome or Edge.' }
  return { supported: true, reason: '' }
}

function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices()
  return (
    voices.find(v => v.name.includes('Google UK English Female')) ||
    voices.find(v => v.name.includes('Microsoft Zira'))           ||
    voices.find(v => v.name.includes('Google US English'))        ||
    voices.find(v => v.lang.startsWith('en'))                     ||
    voices[0] || null
  )
}

async function speak(text: string, onStart?: () => void, onEnd?: () => void) {
  return new Promise<void>(resolve => {
    speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    const voice = getBestVoice()
    if (voice) utt.voice = voice
    utt.rate = 0.92; utt.pitch = 1.1; utt.volume = 1.0
    utt.onstart = () => onStart?.()
    utt.onend   = () => { onEnd?.(); resolve() }
    utt.onerror = () => { onEnd?.(); resolve() }
    speechSynthesis.speak(utt)
  })
}

type Phase = 'loading' | 'invalid' | 'ready' | 'opening' | 'listening' | 'processing' | 'speaking' | 'completed' | 'error'

interface TranscriptEntry {
  role: 'interviewer' | 'candidate'
  text: string
  timestamp: string
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main interview room
───────────────────────────────────────────────────────────────────────────── */
function CandidateInterviewRoom({ sessionId }: { sessionId: string }) {
  const TIME_PER_QUESTION = 120

  const [phase,          setPhase]         = useState<Phase>('loading')
  const [candidateName,  setCandidateName] = useState('')
  const [jobTitle,       setJobTitle]      = useState('')
  const [questionIndex,  setQuestionIndex] = useState(0)
  const [scores,         setScores]        = useState<number[]>([])
  const [transcript,     setTranscript]    = useState<TranscriptEntry[]>([])
  const [liveText,       setLiveText]      = useState('')
  const [currentAnswer,  setCurrentAnswer] = useState('')
  const [avatarState,    setAvatarState]   = useState<AvatarState>('idle')
  const [timeLeft,       setTimeLeft]      = useState(TIME_PER_QUESTION)
  const [browserOk,      setBrowserOk]     = useState(true)
  const [browserMsg,     setBrowserMsg]    = useState('')
  const [errorMsg,       setErrorMsg]      = useState('')
  const [micEnabled,     setMicEnabled]    = useState(true)
  const [webcamActive,   setWebcamActive]  = useState(false)
  const [isRecording,    setIsRecording]   = useState(false)
  const [elapsedTime,    setElapsedTime]   = useState(0)
  // KEY FIX: store acquired stream here so the useEffect can attach it after render
  const [pendingStream,  setPendingStream] = useState<MediaStream | null>(null)

  const recognitionRef   = useRef<SpeechRecognition | null>(null)
  const webcamVideoRef   = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunks  = useRef<BlobPart[]>([])
  const mediaStreamRef   = useRef<MediaStream | null>(null)
  const questionTimerRef = useRef<ReturnType<typeof setInterval>>()
  const elapsedTimerRef  = useRef<ReturnType<typeof setInterval>>()
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const answerBufferRef  = useRef('')
  const questionIndexRef = useRef(0)
  const scoresRef        = useRef<number[]>([])
  const transcriptRef    = useRef<TranscriptEntry[]>([])
  const isSpeakingRef    = useRef(false)
  const isListeningRef   = useRef(false)
  const shouldListenRef  = useRef(false)
  const phaseRef         = useRef<Phase>('loading')
  const sessionDbIdRef   = useRef<string | null>(null)
  const appIdRef         = useRef('')
  const questionsRef     = useRef<string[]>([])

  function setPhaseSync(p: Phase) { phaseRef.current = p; setPhase(p) }

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, liveText])

  /* ── KEY FIX: attach stream to video element once it's mounted ── */
  useEffect(() => {
    if (!pendingStream) return
    const video = webcamVideoRef.current
    if (!video) return
    video.setAttribute('muted', '')
    video.muted = true
    video.srcObject = pendingStream
    mediaStreamRef.current = pendingStream
    const tryPlay = async () => {
      try { await video.play() } catch { /* ignore autoplay policy */ }
      setWebcamActive(true)
    }
    if (video.readyState >= 1) {
      tryPlay()
    } else {
      video.onloadedmetadata = tryPlay
    }
    setPendingStream(null)
  }, [pendingStream])

  /* ── Load session on mount ── */
  useEffect(() => {
    const { supported, reason } = checkBrowserSupport()
    if (!supported) { setBrowserOk(false); setBrowserMsg(reason); setPhaseSync('error'); return }

    async function load() {
      const res  = await fetch(`/api/interviews/candidate-session?sessionId=${sessionId}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Invalid or expired interview link.')
        setPhaseSync('invalid'); return
      }

      setCandidateName(data.candidateName)
      setJobTitle(data.jobTitle)
      appIdRef.current = data.applicationId
      sessionDbIdRef.current = data.aiSessionId || null

      const qRes  = await fetch(`/api/interviews/ai-interview?applicationId=${data.applicationId}${data.roundId ? `&roundId=${data.roundId}` : ''}`)
      const qData = await qRes.json()
      if (qData.error) { setErrorMsg(qData.error); setPhaseSync('error'); return }

      questionsRef.current = qData.questions
      if (qData.sessionId) sessionDbIdRef.current = qData.sessionId

      // ── RENDER FIRST, THEN ATTACH CAMERA ──
      // Set 'ready' so the video element mounts in the DOM
      setPhaseSync('ready')

      // Now request camera — video element will be in DOM after this state update
      speechSynthesis.getVoices()
      speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices()

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        // setPendingStream triggers the useEffect above which attaches the stream
        // to the now-mounted video element
        setPendingStream(stream)
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          setPendingStream(stream)
        } catch { /* camera optional */ }
      }
    }
    load()
  }, [sessionId])

  /* ── Speech recognition ── */
  function buildRecognition(): SpeechRecognition {
    const SR = (window.SpeechRecognition || (window as any).webkitSpeechRecognition) as typeof SpeechRecognition
    const r = new SR()
    r.continuous = true; r.interimResults = true; r.lang = 'en-IN'; r.maxAlternatives = 3
    r.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        let best = event.results[i][0]
        for (let j = 1; j < event.results[i].length; j++) {
          if (event.results[i][j].confidence > best.confidence) best = event.results[i][j]
        }
        if (event.results[i].isFinal) final += best.transcript + ' '
        else interim += best.transcript
      }
      if (interim) setLiveText(interim)
      if (final.trim()) { setLiveText(''); handleSpeech(final.trim()) }
    }
    r.onend = () => {
      isListeningRef.current = false
      if (shouldListenRef.current && !isSpeakingRef.current) {
        try { r.start(); isListeningRef.current = true } catch {}
      }
    }
    r.onerror = () => { isListeningRef.current = false }
    return r
  }

  function handleSpeech(text: string) {
    if (phaseRef.current !== 'listening') return
    answerBufferRef.current += ' ' + text
    setCurrentAnswer(answerBufferRef.current.trim())
  }

  function startQuestionTimer() {
    clearInterval(questionTimerRef.current)
    setTimeLeft(TIME_PER_QUESTION)
    let remaining = TIME_PER_QUESTION
    questionTimerRef.current = setInterval(() => {
      remaining -= 1; setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(questionTimerRef.current)
        if (phaseRef.current === 'listening') {
          const answer = answerBufferRef.current.trim()
          answerBufferRef.current = ''; setCurrentAnswer('')
          submitAnswer(answer.split(' ').length >= 3 ? answer : '(No response — time expired)')
        }
      }
    }, 1000)
  }

  function startElapsedTimer() {
    clearInterval(elapsedTimerRef.current)
    let secs = 0
    elapsedTimerRef.current = setInterval(() => { secs++; setElapsedTime(secs) }, 1000)
  }

  function startListening() {
    if (isSpeakingRef.current) return
    shouldListenRef.current = true
    setAvatarState('listening')
    if (!recognitionRef.current) recognitionRef.current = buildRecognition()
    if (!isListeningRef.current) {
      try { recognitionRef.current.start(); isListeningRef.current = true } catch {}
    }
    setPhaseSync('listening')
  }

  function stopListening() {
    shouldListenRef.current = false; isListeningRef.current = false
    try { recognitionRef.current?.stop() } catch {}
    setLiveText(''); clearInterval(questionTimerRef.current)
  }

  function startNewQuestion() {
    answerBufferRef.current = ''; setCurrentAnswer(''); setLiveText('')
    startListening(); startQuestionTimer()
  }

  async function avatarSpeak(text: string) {
    isSpeakingRef.current = true
    stopListening(); setAvatarState('speaking'); setMicEnabled(false)
    const entry: TranscriptEntry = { role: 'interviewer', text, timestamp: new Date().toISOString() }
    transcriptRef.current = [...transcriptRef.current, entry]
    setTranscript([...transcriptRef.current])
    await speak(text,
      () => { isSpeakingRef.current = true },
      () => { isSpeakingRef.current = false; setMicEnabled(true) }
    )
  }

  async function submitAnswer(answer: string) {
    stopListening(); setPhaseSync('processing'); setAvatarState('thinking')
    const entry: TranscriptEntry = { role: 'candidate', text: answer, timestamp: new Date().toISOString() }
    transcriptRef.current = [...transcriptRef.current, entry]
    setTranscript([...transcriptRef.current])

    const currentQ  = questionsRef.current[questionIndexRef.current]
    const nextIndex = questionIndexRef.current + 1
    try {
      const res  = await fetch('/api/interviews/ai-interview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score_answer', question: currentQ, answer, applicationId: appIdRef.current }),
      })
      const data = await res.json()
      scoresRef.current = [...scoresRef.current, data.score ?? 50]
      setScores([...scoresRef.current])
    } catch { scoresRef.current = [...scoresRef.current, 50]; setScores([...scoresRef.current]) }

    if (nextIndex < questionsRef.current.length) {
      questionIndexRef.current = nextIndex; setQuestionIndex(nextIndex)
      setPhaseSync('speaking')
      await avatarSpeak(`Thank you. Next question: ${questionsRef.current[nextIndex]}`)
      startNewQuestion()
    } else {
      await finishInterview()
    }
  }

  async function finishInterview() {
    clearInterval(elapsedTimerRef.current); stopListening()
    setPhaseSync('speaking')
    await avatarSpeak('That concludes your interview. Thank you for your time. Your responses have been recorded and our HR team will be in touch shortly. Best of luck!')
    setAvatarState('idle'); setIsRecording(false)
    const uploadPromise = stopAndUploadRecording()
    if (sessionDbIdRef.current && scoresRef.current.length > 0) {
      const avg = Math.round(scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length)
      try {
        await fetch('/api/interviews/ai-interview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'complete_session', sessionId: sessionDbIdRef.current,
            transcript: transcriptRef.current, scores: scoresRef.current, avgScore: avg, applicationId: appIdRef.current }),
        })
      } catch {}
    }
    await uploadPromise; setPhaseSync('completed')
  }

  async function startInterview() {
    setPhaseSync('opening'); questionIndexRef.current = 0; setQuestionIndex(0)
    startRecording(); startElapsedTimer()
    await avatarSpeak(`Hello ${candidateName ? candidateName.split(' ')[0] : 'there'}! Welcome to your AI interview for the ${jobTitle} position. I'll be asking you ${questionsRef.current.length} questions. Please speak clearly and click Submit Answer when you've finished each response. Let's begin. ${questionsRef.current[0]}`)
    startNewQuestion()
  }

  function startRecording() {
    if (!mediaStreamRef.current) return
    recordingChunks.current = []
    const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    let mr: MediaRecorder | null = null
    for (const mt of mimeTypes) {
      try { if (MediaRecorder.isTypeSupported(mt)) { mr = new MediaRecorder(mediaStreamRef.current, { mimeType: mt }); break } } catch {}
    }
    if (!mr) { try { mr = new MediaRecorder(mediaStreamRef.current) } catch { return } }
    mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunks.current.push(e.data) }
    mr.start(1000); mediaRecorderRef.current = mr; setIsRecording(true)
  }

  async function stopAndUploadRecording(): Promise<void> {
    return new Promise<void>((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === 'inactive') { resolve(); return }
      mr.onstop = async () => {
        if (recordingChunks.current.length === 0) { resolve(); return }
        const blob = new Blob(recordingChunks.current, { type: mr.mimeType || 'video/webm' })
        try {
          const fd = new FormData()
          fd.append('video', blob, `interview-${sessionDbIdRef.current ?? 'unknown'}.webm`)
          if (sessionDbIdRef.current) fd.append('sessionId', sessionDbIdRef.current)
          await fetch('/api/interviews/upload-recording', { method: 'POST', body: fd })
        } catch {}
        resolve()
      }
      try { mr.stop() } catch { resolve() }
    })
  }

  function handleManualSubmit() {
    const answer = (answerBufferRef.current || currentAnswer).trim()
    if (!answer || phaseRef.current !== 'listening') return
    answerBufferRef.current = ''; setCurrentAnswer('')
    submitAnswer(answer)
  }

  const progress = questionsRef.current.length > 0 ? (questionIndex / questionsRef.current.length) * 100 : 0
  const timerPct = (timeLeft / TIME_PER_QUESTION) * 100
  const elapsedStr = `${Math.floor(elapsedTime / 60).toString().padStart(2,'0')}:${(elapsedTime % 60).toString().padStart(2,'0')}`

  /* ── Error / Loading screens ── */
  if (!browserOk) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 max-w-md text-center">
        <AlertCircle size={40} className="text-red-500 mx-auto mb-4"/>
        <h2 className="text-lg font-bold text-white mb-2">Browser Not Supported</h2>
        <p className="text-sm text-gray-400">{browserMsg}</p>
      </div>
    </div>
  )
  if (phase === 'invalid') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 max-w-md text-center">
        <AlertCircle size={40} className="text-amber-500 mx-auto mb-4"/>
        <h2 className="text-lg font-bold text-white mb-2">Invalid Interview Link</h2>
        <p className="text-sm text-gray-400">{errorMsg || 'This link is invalid or has expired.'}</p>
      </div>
    </div>
  )
  if (phase === 'loading') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-sm text-gray-400">Loading your interview…</p>
      </div>
    </div>
  )
  if (phase === 'completed') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-10 max-w-md text-center">
        <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-700">
          <CheckCircle size={32} className="text-green-400"/>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Interview Complete!</h2>
        <p className="text-gray-400 text-sm mb-6">Thank you for completing your AI interview for the <strong className="text-white">{jobTitle}</strong> position.</p>
        <div className="bg-violet-900/30 border border-violet-700 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-violet-300">What happens next?</p>
          <p className="text-xs text-violet-400">✓ Your answers have been saved</p>
          <p className="text-xs text-violet-400">✓ HR will review your interview results</p>
          <p className="text-xs text-violet-400">✓ You'll be contacted within 2–3 business days</p>
        </div>
        <p className="text-xs text-gray-600 mt-6">You may now close this tab.</p>
      </div>
    </div>
  )

  /* ── MAIN INTERVIEW UI ── */
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">

      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-gray-950 border-b border-gray-800 flex-shrink-0 z-30 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <Bot size={16} className="text-white"/>
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Interview | {jobTitle || 'Loading…'}</p>
            <p className="text-gray-500 text-[10px]">Powered by Gemini AI · Voice-based</p>
          </div>
        </div>

        {/* Elapsed timer — center */}
        {phase !== 'ready' && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-white text-sm font-mono bg-black/60 border border-gray-700 px-4 py-1 rounded-full">
              Interview Time {elapsedStr}
            </span>
          </div>
        )}

        {/* Submit — right */}
        <button
          onClick={handleManualSubmit}
          disabled={phase !== 'listening' || !currentAnswer.trim()}
          className={`text-sm px-5 py-1.5 rounded-lg font-semibold transition ${
            phase === 'listening' && currentAnswer.trim()
              ? 'bg-violet-600 hover:bg-violet-700 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          Submit
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Avatar + PIP */}
        <div className="relative flex-1 overflow-hidden bg-gray-950">

          {/* Progress bar */}
          {phase !== 'ready' && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-800 z-10">
              <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }}/>
            </div>
          )}

          {/* Full-screen human avatar */}
          <div className="absolute inset-0">
            <HumanAvatar state={avatarState}/>
          </div>

          {/* Q counter badge */}
          {(phase === 'listening' || phase === 'processing' || phase === 'speaking' || phase === 'opening') && (
            <div className="absolute top-4 right-4 z-10">
              <span className="bg-black/60 border border-gray-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                Q{questionIndex + 1} / {questionsRef.current.length}
              </span>
            </div>
          )}

          {/* Candidate PIP — top left */}
          <div className="absolute top-4 left-4 z-10" style={{ width: 200, height: 150 }}>
            <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border-2 border-gray-600 bg-gray-900">
              <video
                ref={webcamVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-700 ${webcamActive ? 'opacity-100' : 'opacity-0'}`}
              />
              {!webcamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                  <User size={28} className="text-gray-600 mb-1"/>
                  <p className="text-gray-500 text-xs">{candidateName || 'You'}</p>
                  <p className="text-gray-600 text-[10px] mt-0.5">Camera loading…</p>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                <p className="text-white text-[10px] font-medium truncate">{candidateName}</p>
              </div>
            </div>
          </div>

          {/* Recording badge */}
          {isRecording && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/70 border border-gray-700 rounded-full px-5 py-2">
              <Circle size={8} className="fill-red-500 text-red-500 animate-pulse"/>
              <span className="text-white text-xs font-medium tracking-wide">Recording...</span>
              <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center ml-1">
                <Square size={7} className="text-white fill-white"/>
              </div>
            </div>
          )}

          {/* Countdown ring */}
          {phase === 'listening' && (
            <div className="absolute bottom-5 right-5 z-10 flex flex-col items-center gap-1">
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="22" fill="rgba(0,0,0,0.5)" stroke="#374151" strokeWidth="4"/>
                <circle cx="26" cy="26" r="22" fill="none"
                  stroke={timeLeft < 30 ? '#ef4444' : '#7c3aed'}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2*Math.PI*22}`}
                  strokeDashoffset={`${2*Math.PI*22*(1-timerPct/100)}`}
                  transform="rotate(-90 26 26)" className="transition-all duration-1000"/>
                <text x="26" y="31" textAnchor="middle" fontSize="12" fontWeight="bold"
                  fill={timeLeft < 30 ? '#ef4444' : '#a78bfa'}>{timeLeft}</text>
              </svg>
              <span className="text-[9px] text-gray-500 font-medium">SEC LEFT</span>
            </div>
          )}

          {/* Ready overlay */}
          {phase === 'ready' && (
            <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-20">
              <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-8 max-w-sm w-full mx-4 text-center border border-gray-700 shadow-2xl">
                <div className="w-14 h-14 bg-violet-900/50 border border-violet-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot size={28} className="text-violet-400"/>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Ready for your Interview?</h2>
                <p className="text-sm text-gray-400 mb-6">
                  <strong className="text-white">{questionsRef.current.length} questions</strong> for the{' '}
                  <strong className="text-white">{jobTitle}</strong> role · 2 min per question
                </p>
                <div className="flex justify-center gap-4 mb-6 flex-wrap">
                  <span className="text-xs text-gray-500">✅ Voice interview</span>
                  <span className="text-xs text-gray-500">✅ Auto-saved</span>
                  <span className="text-xs text-gray-500">✅ Video recorded</span>
                </div>
                <button onClick={startInterview}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition shadow-lg">
                  Start Interview →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Transcript */}
        <div className="w-72 xl:w-80 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
            <p className="text-white font-semibold text-sm">Live Transcript</p>
            {(phase === 'listening' || phase === 'speaking') && (
              <span className="flex items-center gap-1.5 text-[10px] text-green-400 bg-green-900/30 border border-green-800 px-2 py-0.5 rounded-full">
                <Circle size={6} className="fill-green-400 text-green-400 animate-pulse"/> Live
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {transcript.length === 0 && (
              <div className="text-center text-gray-600 text-xs mt-8">
                <Bot size={24} className="mx-auto mb-2 opacity-30"/>
                Transcript will appear here once the interview starts
              </div>
            )}
            {transcript.map((t, i) => (
              <div key={i} className={`flex gap-2 ${t.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                {t.role === 'interviewer' && (
                  <div className="w-5 h-5 rounded-full flex-shrink-0 bg-violet-800 flex items-center justify-center mt-0.5">
                    <Bot size={10} className="text-violet-300"/>
                  </div>
                )}
                <div className={`max-w-[85%] text-xs rounded-xl px-3 py-2 leading-relaxed ${
                  t.role === 'interviewer'
                    ? 'bg-gray-800 text-gray-200 rounded-tl-none'
                    : 'bg-violet-700/50 text-violet-100 rounded-tr-none'
                }`}>
                  {t.text}
                </div>
                {t.role === 'candidate' && (
                  <div className="w-5 h-5 rounded-full flex-shrink-0 bg-gray-700 flex items-center justify-center mt-0.5">
                    <User size={10} className="text-gray-300"/>
                  </div>
                )}
              </div>
            ))}
            {liveText && (
              <div className="flex gap-2 justify-end">
                <div className="max-w-[85%] text-xs rounded-xl px-3 py-2 bg-violet-900/30 text-violet-300 italic border border-dashed border-violet-700/50 rounded-tr-none">
                  {liveText}
                </div>
                <div className="w-5 h-5 rounded-full flex-shrink-0 bg-gray-700 flex items-center justify-center mt-0.5">
                  <User size={10} className="text-gray-300"/>
                </div>
              </div>
            )}
            <div ref={transcriptEndRef}/>
          </div>

          {/* Answer controls */}
          {phase === 'listening' && (
            <div className="border-t border-gray-800 p-3 space-y-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  liveText ? 'bg-red-500 animate-pulse' : currentAnswer ? 'bg-green-500' : 'bg-violet-400 animate-pulse'
                }`}/>
                <span className="text-[10px] text-gray-400 flex-1 truncate">
                  {liveText ? 'Listening…' : currentAnswer ? 'Ready to submit' : 'Speak your answer'}
                </span>
                <button onClick={() => {
                  setMicEnabled(p => !p)
                  if (micEnabled) { shouldListenRef.current = false; try { recognitionRef.current?.stop() } catch {} }
                  else startListening()
                }} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition flex-shrink-0
                  ${micEnabled ? 'border-gray-700 text-gray-400' : 'border-red-800 bg-red-900/30 text-red-400'}`}>
                  {micEnabled ? <Mic size={10}/> : <MicOff size={10}/>}
                  {micEnabled ? 'On' : 'Off'}
                </button>
              </div>
              {currentAnswer && !liveText && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 max-h-20 overflow-y-auto">
                  <p className="text-[10px] font-medium text-gray-400 mb-1">Your answer:</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{currentAnswer}</p>
                </div>
              )}
              <div className="flex gap-2">
                {currentAnswer && (
                  <button onClick={() => { answerBufferRef.current = ''; setCurrentAnswer(''); setLiveText(''); startListening() }}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 transition">
                    <Mic size={11}/> Again
                  </button>
                )}
                <button onClick={handleManualSubmit} disabled={!currentAnswer.trim()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                    currentAnswer.trim() ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }`}>
                  <CheckCircle size={12}/> Submit Answer
                </button>
              </div>
            </div>
          )}
          {phase === 'processing' && (
            <div className="border-t border-gray-800 p-4 flex items-center gap-2 flex-shrink-0">
              <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
              <span className="text-xs text-gray-400">AI evaluating your answer…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CandidateInterviewPageInner() {
  const params    = useSearchParams()
  const sessionId = params.get('sessionId')
  if (!sessionId) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 max-w-md text-center">
        <AlertCircle size={40} className="text-amber-500 mx-auto mb-4"/>
        <h2 className="text-lg font-bold text-white mb-2">Missing Interview Link</h2>
        <p className="text-sm text-gray-400">Please use the full interview link sent to you by HR.</p>
      </div>
    </div>
  )
  return <CandidateInterviewRoom sessionId={sessionId}/>
}

export default function CandidateInterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <CandidateInterviewPageInner/>
    </Suspense>
  )
}
