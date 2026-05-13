'use client'
/**
 * Public Candidate AI Interview Page
 * Route: /candidate-interview?sessionId=<uuid>
 *
 * No login required — accessible directly by the candidate via a link
 * sent by HR. The sessionId is a UUID (non-guessable) that links to
 * a specific application + interview round.
 *
 * Stack (all free):
 *  Avatar  : Animated CSS/SVG face
 *  STT     : window.SpeechRecognition (Chrome/Edge built-in)
 *  TTS     : window.speechSynthesis   (all browsers)
 *  AI      : Gemini 1.5 Flash via /api/interviews/ai-interview
 */

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Mic, MicOff, CheckCircle, AlertCircle, Bot, User,
  ChevronDown, ChevronUp, Circle, Square
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────────
   Animated Avatar
───────────────────────────────────────────────────────────────────────────── */
type AvatarState = 'idle' | 'speaking' | 'listening' | 'thinking'

function AnimatedAvatar({ state, name = 'Alex' }: { state: AvatarState; name?: string }) {
  const [mouthOpen,   setMouthOpen]   = useState(false)
  const [eyesClosed,  setEyesClosed]  = useState(false)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })
  const blinkRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (state !== 'speaking') { setMouthOpen(false); return }
    const iv = setInterval(() => setMouthOpen(p => !p), 190)
    return () => clearInterval(iv)
  }, [state])

  useEffect(() => {
    function blink() {
      blinkRef.current = setTimeout(() => {
        setEyesClosed(true)
        setTimeout(() => { setEyesClosed(false); blink() }, 140)
      }, 2200 + Math.random() * 3500)
    }
    blink()
    return () => clearTimeout(blinkRef.current)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => setPupilOffset({ x: (Math.random()-.5)*4, y: (Math.random()-.5)*3 }), 2800)
    return () => clearInterval(iv)
  }, [])

  const stateColors: Record<AvatarState, string> = {
    idle: 'from-violet-900 via-indigo-900 to-slate-900',
    speaking: 'from-violet-700 via-indigo-800 to-slate-900',
    listening: 'from-indigo-800 via-violet-800 to-slate-900',
    thinking: 'from-slate-800 via-violet-900 to-slate-900',
  }

  return (
    <div className={`relative w-full h-full bg-gradient-to-b ${stateColors[state]} flex flex-col items-center justify-center overflow-hidden transition-all duration-700`}>
      {/* Background ambient blobs */}
      <div className="absolute inset-0 opacity-30">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: `${80+i*60}px`, height: `${80+i*60}px`,
              top: `${5+i*10}%`, left: `${3+i*11}%`,
              background: i % 2 === 0 ? 'rgba(139,92,246,0.3)' : 'rgba(99,102,241,0.2)',
              filter: 'blur(40px)'
            }} />
        ))}
      </div>
      {/* Avatar SVG */}
      <svg width="240" height="260" viewBox="0 0 200 220" className="relative z-10 drop-shadow-2xl">
        {/* Head */}
        <ellipse cx="100" cy="100" rx="72" ry="80" fill="#FDBCB4"/>
        {/* Hair */}
        <ellipse cx="100" cy="35" rx="72" ry="38" fill="#2C1810"/>
        <rect x="28" y="35" width="144" height="30" fill="#2C1810"/>
        {/* Ears */}
        <ellipse cx="28" cy="108" rx="12" ry="16" fill="#FDBCB4"/>
        <ellipse cx="172" cy="108" rx="12" ry="16" fill="#FDBCB4"/>
        <ellipse cx="28" cy="108" rx="7" ry="10" fill="#F4A090"/>
        <ellipse cx="172" cy="108" rx="7" ry="10" fill="#F4A090"/>
        {/* Eyes */}
        <ellipse cx="72" cy="95" rx="16" ry={eyesClosed ? 3 : 18} fill="white" className="transition-all duration-100"/>
        <ellipse cx="128" cy="95" rx="16" ry={eyesClosed ? 3 : 18} fill="white" className="transition-all duration-100"/>
        {!eyesClosed && <>
          <circle cx={72+pupilOffset.x} cy={95+pupilOffset.y} r="10" fill="#2C1810"/>
          <circle cx={128+pupilOffset.x} cy={95+pupilOffset.y} r="10" fill="#2C1810"/>
          <circle cx={74+pupilOffset.x} cy={91+pupilOffset.y} r="3" fill="white"/>
          <circle cx={130+pupilOffset.x} cy={91+pupilOffset.y} r="3" fill="white"/>
        </>}
        {/* Eyebrows */}
        <path d={state==='thinking' ? 'M56 72 Q72 65 88 70' : 'M56 73 Q72 67 88 72'} stroke="#2C1810" strokeWidth="4" fill="none" strokeLinecap="round"/>
        <path d={state==='thinking' ? 'M112 70 Q128 65 144 72' : 'M112 72 Q128 67 144 73'} stroke="#2C1810" strokeWidth="4" fill="none" strokeLinecap="round"/>
        {/* Nose */}
        <ellipse cx="100" cy="125" rx="8" ry="6" fill="#F4A090"/>
        {/* Mouth */}
        {mouthOpen
          ? <ellipse cx="100" cy="150" rx="22" ry="14" fill="#C0392B"/>
          : <path d="M78 148 Q100 162 122 148" stroke="#C0392B" strokeWidth="4" fill="none" strokeLinecap="round"/>}
        {/* Collar */}
        <path d="M40 185 Q100 210 160 185 L170 220 H30 Z" fill="#6C3CE1"/>
        <path d="M100 185 L85 210 H115 Z" fill="#5A30C0"/>
      </svg>
      {/* Name + state label */}
      <div className="relative z-10 mt-2 text-center">
        <p className="text-white font-bold text-xl tracking-wide">{name}</p>
        <p className="text-violet-300 text-sm capitalize mt-0.5">
          {state === 'speaking' ? '🔊 Speaking…' : state === 'listening' ? '🎙 Listening…' : state === 'thinking' ? '💭 Thinking…' : '⏳ Waiting'}
        </p>
      </div>
      {/* Speaking wave animation */}
      {state === 'speaking' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1">
          {[4,7,10,14,10,7,4].map((h, i) => (
            <div key={i} className="w-1.5 bg-violet-400/70 rounded-full animate-pulse"
              style={{ height: `${h}px`, animationDelay: `${i*0.1}s` }}/>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Browser support check
───────────────────────────────────────────────────────────────────────────── */
function checkBrowserSupport() {
  if (typeof window === 'undefined') return { supported: false, reason: '' }
  const hasSR = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition)
  const hasSS = 'speechSynthesis' in window
  if (!hasSR) return { supported: false, reason: 'Please use Google Chrome or Microsoft Edge for this interview.' }
  if (!hasSS) return { supported: false, reason: 'Your browser does not support Speech Synthesis. Please use Chrome or Edge.' }
  return { supported: true, reason: '' }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TTS
───────────────────────────────────────────────────────────────────────────── */
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
    utt.rate = 0.92; utt.pitch = 1.05; utt.volume = 1.0
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
   Main candidate interview room
───────────────────────────────────────────────────────────────────────────── */
function CandidateInterviewRoom({ sessionId }: { sessionId: string }) {
  const TIME_PER_QUESTION = 120

  const [phase,          setPhase]         = useState<Phase>('loading')
  const [questions,      setQuestions]     = useState<string[]>([])
  const [candidateName,  setCandidateName] = useState('')
  const [jobTitle,       setJobTitle]      = useState('')
  const [applicationId,  setApplicationId] = useState('')
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

  const recognitionRef    = useRef<SpeechRecognition | null>(null)
  const webcamVideoRef    = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const recordingChunks   = useRef<BlobPart[]>([])
  const mediaStreamRef    = useRef<MediaStream | null>(null)
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout>>()
  const questionTimerRef  = useRef<ReturnType<typeof setInterval>>()
  const elapsedTimerRef   = useRef<ReturnType<typeof setInterval>>()
  const transcriptEndRef  = useRef<HTMLDivElement>(null)
  const answerBufferRef   = useRef('')
  const questionIndexRef  = useRef(0)
  const scoresRef         = useRef<number[]>([])
  const transcriptRef     = useRef<TranscriptEntry[]>([])
  const isSpeakingRef     = useRef(false)
  const isListeningRef    = useRef(false)
  const shouldListenRef   = useRef(false)
  const phaseRef          = useRef<Phase>('loading')
  const sessionDbIdRef    = useRef<string | null>(null)
  const appIdRef          = useRef('')
  const questionsRef      = useRef<string[]>([])

  function setPhaseSync(p: Phase) { phaseRef.current = p; setPhase(p) }

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, liveText])

  /* ── Load session data on mount ── */
  useEffect(() => {
    const { supported, reason } = checkBrowserSupport()
    if (!supported) { setBrowserOk(false); setBrowserMsg(reason); setPhaseSync('error'); return }

    async function load() {
      const res  = await fetch(`/api/interviews/candidate-session?sessionId=${sessionId}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Invalid or expired interview link.')
        setPhaseSync('invalid')
        return
      }

      setCandidateName(data.candidateName)
      setJobTitle(data.jobTitle)
      setApplicationId(data.applicationId)
      appIdRef.current = data.applicationId
      sessionDbIdRef.current = data.aiSessionId || null

      const qRes  = await fetch(`/api/interviews/ai-interview?applicationId=${data.applicationId}${data.roundId ? `&roundId=${data.roundId}` : ''}`)
      const qData = await qRes.json()
      if (qData.error) { setErrorMsg(qData.error); setPhaseSync('error'); return }

      setQuestions(qData.questions)
      questionsRef.current = qData.questions
      if (qData.sessionId) sessionDbIdRef.current = qData.sessionId

      // Webcam + Microphone — fix: set muted via DOM attribute + call play()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        mediaStreamRef.current = stream
        if (webcamVideoRef.current) {
          const video = webcamVideoRef.current
          video.setAttribute('muted', '')   // ensure muted attr is set for autoplay policy
          video.muted = true
          video.srcObject = stream
          video.onloadedmetadata = async () => {
            try { await video.play() } catch { /* ignore */ }
            setWebcamActive(true)
          }
        }
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          mediaStreamRef.current = stream
          if (webcamVideoRef.current) {
            const video = webcamVideoRef.current
            video.setAttribute('muted', '')
            video.muted = true
            video.srcObject = stream
            video.onloadedmetadata = async () => {
              try { await video.play() } catch { /* ignore */ }
              setWebcamActive(true)
            }
          }
        } catch { /* camera optional */ }
      }

      speechSynthesis.getVoices()
      speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices()
      setPhaseSync('ready')
    }
    load()
  }, [sessionId])

  /* ── Build recognition ── */
  function buildRecognition(): SpeechRecognition {
    const SR = (window.SpeechRecognition || (window as any).webkitSpeechRecognition) as typeof SpeechRecognition
    const r  = new SR()
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
        try { r.start(); isListeningRef.current = true } catch { /* ignore */ }
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

  /* ── Question timer ── */
  function startQuestionTimer() {
    clearInterval(questionTimerRef.current)
    setTimeLeft(TIME_PER_QUESTION)
    let remaining = TIME_PER_QUESTION
    questionTimerRef.current = setInterval(() => {
      remaining -= 1
      setTimeLeft(remaining)
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

  /* ── Elapsed interview timer ── */
  function startElapsedTimer() {
    clearInterval(elapsedTimerRef.current)
    let secs = 0
    elapsedTimerRef.current = setInterval(() => {
      secs += 1
      setElapsedTime(secs)
    }, 1000)
  }

  /* ── Listening control ── */
  function startListening() {
    if (isSpeakingRef.current) return
    shouldListenRef.current = true
    setAvatarState('listening')
    if (!recognitionRef.current) recognitionRef.current = buildRecognition()
    if (!isListeningRef.current) {
      try { recognitionRef.current.start(); isListeningRef.current = true } catch { /* ignore */ }
    }
    setPhaseSync('listening')
  }

  function stopListening() {
    shouldListenRef.current = false; isListeningRef.current = false
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    setLiveText(''); clearInterval(questionTimerRef.current)
  }

  function startNewQuestion() {
    answerBufferRef.current = ''; setCurrentAnswer(''); setLiveText('')
    startListening(); startQuestionTimer()
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

    await speak(text,
      () => { isSpeakingRef.current = true },
      () => { isSpeakingRef.current = false; setMicEnabled(true) }
    )
  }

  /* ── Submit answer & advance ── */
  async function submitAnswer(answer: string) {
    stopListening()
    setPhaseSync('processing')
    setAvatarState('thinking')

    const entry: TranscriptEntry = { role: 'candidate', text: answer, timestamp: new Date().toISOString() }
    transcriptRef.current = [...transcriptRef.current, entry]
    setTranscript([...transcriptRef.current])

    const currentQ   = questionsRef.current[questionIndexRef.current]
    const nextIndex  = questionIndexRef.current + 1

    try {
      const res  = await fetch('/api/interviews/ai-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score_answer', question: currentQ, answer, applicationId: appIdRef.current }),
      })
      const data = await res.json()
      const score = data.score ?? 50
      scoresRef.current = [...scoresRef.current, score]
      setScores([...scoresRef.current])
    } catch { scoresRef.current = [...scoresRef.current, 50]; setScores([...scoresRef.current]) }

    if (nextIndex < questionsRef.current.length) {
      questionIndexRef.current = nextIndex
      setQuestionIndex(nextIndex)
      setPhaseSync('speaking')
      await avatarSpeak(`Thank you. Next question: ${questionsRef.current[nextIndex]}`)
      startNewQuestion()
    } else {
      await finishInterview()
    }
  }

  async function finishInterview() {
    clearInterval(elapsedTimerRef.current)
    stopListening()
    setPhaseSync('speaking')
    await avatarSpeak('That concludes your interview. Thank you for your time. Your responses have been recorded and our HR team will be in touch shortly. Best of luck!')
    setAvatarState('idle')
    setIsRecording(false)

    const uploadPromise = stopAndUploadRecording()

    if (sessionDbIdRef.current && scoresRef.current.length > 0) {
      const avg = Math.round(scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length)
      try {
        await fetch('/api/interviews/ai-interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete_session',
            sessionId: sessionDbIdRef.current,
            transcript: transcriptRef.current,
            scores: scoresRef.current,
            avgScore: avg,
            applicationId: appIdRef.current,
          }),
        })
      } catch { /* log silently */ }
    }

    await uploadPromise
    setPhaseSync('completed')
  }

  async function startInterview() {
    setPhaseSync('opening')
    questionIndexRef.current = 0
    setQuestionIndex(0)
    startRecording()
    startElapsedTimer()
    await avatarSpeak(`Hello ${candidateName ? candidateName.split(' ')[0] : 'there'}! Welcome to your AI interview for the ${jobTitle} position. I'll be asking you ${questionsRef.current.length} questions. Please speak clearly and click "Submit Answer" when you've finished each response. Let's begin. ${questionsRef.current[0]}`)
    startNewQuestion()
  }

  /* ── Video recording ── */
  function startRecording() {
    if (!mediaStreamRef.current) return
    recordingChunks.current = []
    const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    let mr: MediaRecorder | null = null
    for (const mt of mimeTypes) {
      try {
        if (MediaRecorder.isTypeSupported(mt)) {
          mr = new MediaRecorder(mediaStreamRef.current, { mimeType: mt })
          break
        }
      } catch { /* try next */ }
    }
    if (!mr) {
      try { mr = new MediaRecorder(mediaStreamRef.current) } catch { return }
    }
    mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunks.current.push(e.data) }
    mr.start(1000)
    mediaRecorderRef.current = mr
    setIsRecording(true)
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
        } catch { /* upload failure is silent */ }
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

  const progress = questionsRef.current.length > 0 ? ((questionIndex) / questionsRef.current.length) * 100 : 0
  const timerPct = (timeLeft / TIME_PER_QUESTION) * 100
  const elapsedStr = `${Math.floor(elapsedTime / 60).toString().padStart(2,'0')}:${(elapsedTime % 60).toString().padStart(2,'0')}`

  /* ──────────────────────────────────────────────────────────
     ERROR / LOADING / INVALID screens
  ────────────────────────────────────────────────────────── */
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
        <p className="text-sm text-gray-400">{errorMsg || 'This interview link is invalid or has already been used.'}</p>
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
        <p className="text-gray-400 text-sm mb-6">Thank you for completing your AI interview for the <strong className="text-white">{jobTitle}</strong> position. The HR team will review your responses shortly.</p>
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

  /* ──────────────────────────────────────────────────────────
     MAIN INTERVIEW UI — matches reference design
  ────────────────────────────────────────────────────────── */
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800 flex-shrink-0 z-30">
        {/* Left: Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <Bot size={16} className="text-white"/>
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Interview | {jobTitle || 'Loading…'}</p>
            <p className="text-gray-500 text-[10px]">Powered by Gemini AI · Voice-based</p>
          </div>
        </div>

        {/* Center: elapsed timer */}
        {(phase !== 'ready' && phase !== 'loading') && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-white text-sm font-mono bg-black/60 border border-gray-700 px-4 py-1 rounded-full">
              Interview Time {elapsedStr}
            </span>
          </div>
        )}

        {/* Right: Submit button */}
        <div className="flex items-center gap-3">
          {phase === 'listening' && (
            <button
              onClick={handleManualSubmit}
              disabled={!currentAnswer.trim()}
              className={`text-sm px-5 py-1.5 rounded-lg font-semibold transition ${
                currentAnswer.trim()
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Submit
            </button>
          )}
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: AI Avatar + PIP + overlays ── */}
        <div className="relative flex-1 overflow-hidden">

          {/* Full-screen AI avatar background */}
          <div className="absolute inset-0">
            <AnimatedAvatar state={avatarState} name="Alex"/>
          </div>

          {/* Progress bar overlay at top of avatar */}
          {phase !== 'ready' && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-800 z-10">
              <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }}/>
            </div>
          )}

          {/* Question counter badge */}
          {(phase === 'listening' || phase === 'processing' || phase === 'speaking' || phase === 'opening') && (
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <span className="bg-black/60 border border-gray-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                Q{questionIndex + 1} / {questionsRef.current.length}
              </span>
            </div>
          )}

          {/* Candidate webcam PIP — top left */}
          <div className="absolute top-4 left-4 z-10" style={{ width: '200px', height: '150px' }}>
            <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border-2 border-gray-600 bg-gray-900">
              <video
                ref={webcamVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-500 ${webcamActive ? 'opacity-100' : 'opacity-0'}`}
              />
              {!webcamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                  <User size={28} className="text-gray-600 mb-1"/>
                  <p className="text-gray-500 text-xs">{candidateName || 'You'}</p>
                  <p className="text-gray-600 text-[10px] mt-0.5">Camera loading…</p>
                </div>
              )}
              {/* Name label */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                <p className="text-white text-[10px] font-medium truncate">{candidateName} {jobTitle && `· ${jobTitle}`}</p>
              </div>
            </div>
          </div>

          {/* Recording indicator — bottom center */}
          {isRecording && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/70 border border-gray-700 rounded-full px-5 py-2">
              <Circle size={8} className="fill-red-500 text-red-500 animate-pulse"/>
              <span className="text-white text-xs font-medium tracking-wide">Recording...</span>
              <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center ml-1 cursor-pointer"
                   onClick={() => { /* stop not exposed to user mid-interview */ }}>
                <Square size={8} className="text-white fill-white"/>
              </div>
            </div>
          )}

          {/* Per-question countdown ring — bottom right */}
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

          {/* ── READY SCREEN overlay ── */}
          {phase === 'ready' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
              <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-8 max-w-sm w-full mx-4 text-center border border-gray-700 shadow-2xl">
                <div className="w-14 h-14 bg-violet-900/50 border border-violet-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot size={28} className="text-violet-400"/>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Ready for your Interview?</h2>
                <p className="text-sm text-gray-400 mb-1">
                  <strong className="text-white">{questionsRef.current.length} questions</strong> for the <strong className="text-white">{jobTitle}</strong> role.
                </p>
                <p className="text-sm text-gray-500 mb-6">Speak clearly · 2 min per question · Click Submit when done</p>
                <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
                  <span className="text-xs text-gray-500 flex items-center gap-1">✅ Voice interview</span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">✅ Auto-saved</span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">✅ Video recorded</span>
                </div>
                <button onClick={startInterview}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition shadow-lg">
                  Start Interview →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel: Live Transcript + Answer area ── */}
        <div className="w-72 xl:w-80 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
            <p className="text-white font-semibold text-sm">Live Transcript</p>
            {(phase === 'listening' || phase === 'speaking') && (
              <span className="flex items-center gap-1.5 text-[10px] text-green-400 bg-green-900/30 border border-green-800 px-2 py-0.5 rounded-full">
                <Circle size={6} className="fill-green-400 text-green-400 animate-pulse"/> Live
              </span>
            )}
          </div>

          {/* Transcript messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {transcript.length === 0 && (
              <div className="text-center text-gray-600 text-xs mt-8">
                <Bot size={24} className="mx-auto mb-2 opacity-40"/>
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
            {/* Live interim text bubble */}
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

          {/* Answer / Mic control area */}
          {phase === 'listening' && (
            <div className="border-t border-gray-800 p-3 space-y-2 flex-shrink-0">
              {/* Mic status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  liveText ? 'bg-red-500 animate-pulse' : currentAnswer ? 'bg-green-500' : 'bg-violet-400 animate-pulse'
                }`}/>
                <span className="text-[10px] text-gray-400 flex-1 min-w-0 truncate">
                  {liveText ? 'Listening…' : currentAnswer ? 'Ready to submit' : 'Speak your answer'}
                </span>
                <button
                  onClick={() => {
                    setMicEnabled(p => !p)
                    if (micEnabled) { shouldListenRef.current = false; try { recognitionRef.current?.stop() } catch {} }
                    else startListening()
                  }}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition flex-shrink-0
                    ${micEnabled ? 'border-gray-700 text-gray-400' : 'border-red-800 bg-red-900/30 text-red-400'}`}
                >
                  {micEnabled ? <Mic size={10}/> : <MicOff size={10}/>}
                  {micEnabled ? 'On' : 'Off'}
                </button>
              </div>

              {/* Captured answer preview */}
              {currentAnswer && !liveText && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 max-h-20 overflow-y-auto">
                  <p className="text-[10px] font-medium text-gray-400 mb-1">Your answer:</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{currentAnswer}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                {currentAnswer && (
                  <button
                    onClick={() => { answerBufferRef.current = ''; setCurrentAnswer(''); setLiveText(''); startListening() }}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 transition"
                  >
                    <Mic size={11}/> Again
                  </button>
                )}
                <button
                  onClick={handleManualSubmit}
                  disabled={!currentAnswer.trim()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                    currentAnswer.trim()
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle size={12}/> Submit Answer
                </button>
              </div>
            </div>
          )}

          {/* Processing indicator */}
          {phase === 'processing' && (
            <div className="border-t border-gray-800 p-4 flex items-center gap-2 flex-shrink-0">
              <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
              <span className="text-xs text-gray-400">AI is evaluating your answer…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page wrapper
───────────────────────────────────────────────────────────────────────────── */
function CandidateInterviewPageInner() {
  const params    = useSearchParams()
  const sessionId = params.get('sessionId')

  if (!sessionId) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 max-w-md text-center">
        <AlertCircle size={40} className="text-amber-500 mx-auto mb-4"/>
        <h2 className="text-lg font-bold text-white mb-2">Missing Interview Link</h2>
        <p className="text-sm text-gray-400">Please use the full interview link sent to you by HR. It should look like:<br/>
          <code className="text-xs bg-gray-800 px-2 py-1 rounded mt-2 inline-block text-gray-300">…/candidate-interview?sessionId=…</code>
        </p>
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
