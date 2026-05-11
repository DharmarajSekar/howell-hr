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
  ChevronDown, ChevronUp, Circle
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
    idle: 'from-violet-900 to-indigo-950',
    speaking: 'from-violet-700 to-indigo-900',
    listening: 'from-indigo-800 to-violet-900',
    thinking: 'from-slate-800 to-violet-950',
  }

  return (
    <div className={`relative w-full h-full rounded-2xl bg-gradient-to-b ${stateColors[state]} flex flex-col items-center justify-center overflow-hidden transition-all duration-700`}>
      <div className="absolute inset-0 opacity-20">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white/10"
            style={{ width: `${40+i*30}px`, height: `${40+i*30}px`, top: `${10+i*8}%`, left: `${5+i*12}%`, filter: 'blur(20px)' }} />
        ))}
      </div>
      <svg width="200" height="220" viewBox="0 0 200 220" className="relative z-10 drop-shadow-2xl">
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
      <div className="relative z-10 mt-1">
        <p className="text-white font-bold text-lg tracking-wide">{name}</p>
        <p className="text-violet-300 text-xs text-center capitalize">
          {state === 'speaking' ? '🔊 Speaking…' : state === 'listening' ? '🎙 Listening…' : state === 'thinking' ? '💭 Thinking…' : '⏳ Waiting'}
        </p>
      </div>
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
  const [showTranscript, setShowTranscript]= useState(false)
  const [avatarState,    setAvatarState]   = useState<AvatarState>('idle')
  const [timeLeft,       setTimeLeft]      = useState(TIME_PER_QUESTION)
  const [browserOk,      setBrowserOk]     = useState(true)
  const [browserMsg,     setBrowserMsg]    = useState('')
  const [errorMsg,       setErrorMsg]      = useState('')
  const [micEnabled,     setMicEnabled]    = useState(true)

  const recognitionRef    = useRef<SpeechRecognition | null>(null)
  const webcamVideoRef    = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const recordingChunks   = useRef<BlobPart[]>([])
  const mediaStreamRef    = useRef<MediaStream | null>(null)
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout>>()
  const questionTimerRef  = useRef<ReturnType<typeof setInterval>>()
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

  /* ── Load session data on mount ── */
  useEffect(() => {
    const { supported, reason } = checkBrowserSupport()
    if (!supported) { setBrowserOk(false); setBrowserMsg(reason); setPhaseSync('error'); return }

    async function load() {
      // Resolve sessionId → applicationId via public API
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

      // Load questions
      const qRes  = await fetch(`/api/interviews/ai-interview?applicationId=${data.applicationId}${data.roundId ? `&roundId=${data.roundId}` : ''}`)
      const qData = await qRes.json()
      if (qData.error) { setErrorMsg(qData.error); setPhaseSync('error'); return }

      setQuestions(qData.questions)
      questionsRef.current = qData.questions
      if (qData.sessionId) sessionDbIdRef.current = qData.sessionId

      // Webcam + Microphone (audio needed for recording)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (webcamVideoRef.current) { webcamVideoRef.current.srcObject = stream; webcamVideoRef.current.muted = true }
        mediaStreamRef.current = stream
      } catch {
        // Try video-only if mic permission denied
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          if (webcamVideoRef.current) { webcamVideoRef.current.srcObject = stream; webcamVideoRef.current.muted = true }
          mediaStreamRef.current = stream
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
    r.continuous = true; r.interimResults = true; r.lang = 'en-US'; r.maxAlternatives = 1

    r.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t + ' '
        else interim += t
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
    // No auto-submit on silence — candidate clicks "Done Answering"
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

    // Score this answer via AI
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

    // Advance to next question or finish
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
    stopListening()
    setPhaseSync('speaking')
    await avatarSpeak('That concludes your interview. Thank you for your time. Your responses have been recorded and our HR team will be in touch shortly. Best of luck!')
    setAvatarState('idle')

    // Stop recording and upload (runs in parallel with DB save)
    const uploadPromise = stopAndUploadRecording()

    // Save results
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

    // Wait for upload to finish before showing completion screen
    await uploadPromise
    setPhaseSync('completed')
  }

  async function startInterview() {
    setPhaseSync('opening')
    questionIndexRef.current = 0
    setQuestionIndex(0)
    startRecording() // begin capturing video+audio
    await avatarSpeak(`Hello ${candidateName ? candidateName.split(' ')[0] : 'there'}! Welcome to your AI interview for the ${jobTitle} position. I'll be asking you ${questionsRef.current.length} questions. Please speak clearly and click "Done Answering" when you've finished each response. Let's begin. ${questionsRef.current[0]}`)
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
        } catch { /* upload failure is silent — session already saved */ }
        resolve()
      }
      try { mr.stop() } catch { resolve() }
    })
  }

  function handleManualSubmit() {
    const answer = answerBufferRef.current.trim()
    if (!answer || phaseRef.current !== 'listening') return
    answerBufferRef.current = ''; setCurrentAnswer('')
    submitAnswer(answer)
  }

  const progress = questionsRef.current.length > 0 ? ((questionIndex) / questionsRef.current.length) * 100 : 0
  const timerPct = (timeLeft / TIME_PER_QUESTION) * 100

  /* ── Render ── */
  if (!browserOk) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <AlertCircle size={40} className="text-red-500 mx-auto mb-4"/>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Browser Not Supported</h2>
        <p className="text-sm text-gray-600">{browserMsg}</p>
      </div>
    </div>
  )

  if (phase === 'invalid') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <AlertCircle size={40} className="text-amber-500 mx-auto mb-4"/>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid Interview Link</h2>
        <p className="text-sm text-gray-600">{errorMsg || 'This interview link is invalid or has already been used. Please contact the HR team.'}</p>
      </div>
    </div>
  )

  if (phase === 'loading') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-sm text-gray-500">Loading your interview…</p>
      </div>
    </div>
  )

  if (phase === 'completed') return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600"/>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Complete!</h2>
        <p className="text-gray-500 text-sm mb-6">Thank you for completing your AI interview for the <strong>{jobTitle}</strong> position. Your responses have been recorded and the HR team will review them shortly.</p>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-left space-y-1.5">
          <p className="text-xs font-semibold text-violet-800">What happens next?</p>
          <p className="text-xs text-violet-700">✓ Your answers have been saved</p>
          <p className="text-xs text-violet-700">✓ HR will review your interview results</p>
          <p className="text-xs text-violet-700">✓ You'll be contacted within 2–3 business days</p>
        </div>
        <p className="text-xs text-gray-400 mt-6">You may now close this tab.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <Bot size={16} className="text-white"/>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">AI Interview — {jobTitle}</p>
            <p className="text-xs text-gray-500">Powered by Gemini AI · Voice-based interview</p>
          </div>
        </div>
        {phase === 'listening' || phase === 'processing' || phase === 'speaking' ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
            <Circle size={8} className="fill-green-500 text-green-500 animate-pulse"/> In Progress
          </span>
        ) : null}
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Progress */}
        {(phase !== 'ready') && (
          <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-600">Progress</span>
                <span className="text-xs font-bold text-violet-700">Q{questionIndex + 1} / {questionsRef.current.length}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}/>
              </div>
              <p className="text-xs text-gray-400 mt-1">{TIME_PER_QUESTION / 60} min per question</p>
            </div>
            {(phase === 'listening') && (
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <svg width="44" height="44" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4"/>
                  <circle cx="22" cy="22" r="18" fill="none" stroke={timeLeft < 30 ? '#ef4444' : '#7c3aed'}
                    strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2*Math.PI*18}`}
                    strokeDashoffset={`${2*Math.PI*18*(1-timerPct/100)}`}
                    transform="rotate(-90 22 22)" className="transition-all duration-1000"/>
                  <text x="22" y="27" textAnchor="middle" fontSize="11" fontWeight="bold"
                    fill={timeLeft < 30 ? '#ef4444' : '#7c3aed'}>{timeLeft}</text>
                </svg>
                <span className="text-[10px] text-gray-400">LEFT</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Avatar panel */}
          <div className="h-72 md:h-96">
            <AnimatedAvatar state={avatarState} name="Alex"/>
          </div>

          {/* Candidate webcam */}
          <div className="h-72 md:h-96 bg-gray-900 rounded-2xl overflow-hidden relative flex items-center justify-center">
            <video ref={webcamVideoRef} autoPlay muted playsInline className="w-full h-full object-cover"/>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <User size={40} className="text-gray-600 mb-2"/>
              <p className="text-gray-500 text-sm">{candidateName || 'You'}</p>
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              <Circle size={6} className="fill-red-500 text-red-500"/> REC
            </div>
          </div>
        </div>

        {/* Ready to start */}
        {phase === 'ready' && (
          <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
            <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot size={28} className="text-violet-600"/>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ready for your AI Interview?</h2>
            <p className="text-sm text-gray-500 mb-1">You'll be asked <strong>{questionsRef.current.length} questions</strong> for the <strong>{jobTitle}</strong> role.</p>
            <p className="text-sm text-gray-500 mb-6">Speak your answers clearly. Click <strong>"Done Answering"</strong> after each response.</p>
            <div className="flex items-center justify-center gap-4 mb-6 flex-wrap text-xs text-gray-500">
              <span className="flex items-center gap-1">✅ Voice-based interview</span>
              <span className="flex items-center gap-1">✅ 2 minutes per question</span>
              <span className="flex items-center gap-1">✅ Answers auto-saved</span>
            </div>
            <button onClick={startInterview}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition shadow-lg shadow-violet-200">
              Start Interview →
            </button>
          </div>
        )}

        {/* Current question + answer area */}
        {(phase === 'listening' || phase === 'processing') && (
          <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-violet-600"/>
              </div>
              <p className="text-sm font-semibold text-gray-800">
                Q{questionIndex + 1}: {questionsRef.current[questionIndex]}
              </p>
            </div>

            <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4 min-h-16">
              <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={14} className="text-gray-600"/>
              </div>
              <div className="flex-1">
                {liveText && <p className="text-sm text-gray-400 italic">{liveText}</p>}
                {currentAnswer && <p className="text-sm text-gray-800">{currentAnswer}</p>}
                {!liveText && !currentAnswer && (
                  <p className="text-xs text-gray-400 italic">Speak your answer, then click <strong>Done Answering</strong> when finished…</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        {(phase === 'listening' || phase === 'processing' || phase === 'speaking' || phase === 'opening') && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {/* Mute toggle */}
            <button
              onClick={() => {
                setMicEnabled(p => !p)
                if (micEnabled) { shouldListenRef.current = false; try { recognitionRef.current?.stop() } catch {} }
                else startListening()
              }}
              className={`flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-lg border transition font-medium
                ${micEnabled ? 'border-gray-300 text-gray-700 hover:bg-gray-50' : 'border-red-300 bg-red-50 text-red-600'}`}
            >
              {micEnabled ? <Mic size={15}/> : <MicOff size={15}/>}
              {micEnabled ? 'Mute' : 'Unmuted'}
            </button>

            {/* Done Answering */}
            {phase === 'listening' && (
              <button
                onClick={handleManualSubmit}
                disabled={!currentAnswer}
                className={`flex items-center gap-1.5 text-sm px-6 py-2.5 rounded-lg font-bold transition
                  ${currentAnswer
                    ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 animate-pulse'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                <CheckCircle size={15}/> Done Answering
              </button>
            )}

            <span className="text-xs text-gray-400 ml-auto">AI Interview · Gemini Powered · Free</span>
          </div>
        )}

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setShowTranscript(p => !p)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              <span>Transcript ({transcript.length} entries)</span>
              {showTranscript ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
            </button>
            {showTranscript && (
              <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-3 max-h-64 overflow-y-auto">
                {transcript.map((t, i) => (
                  <div key={i} className={`flex gap-2 ${t.role === 'interviewer' ? '' : 'flex-row-reverse'}`}>
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold
                      ${t.role === 'interviewer' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                      {t.role === 'interviewer' ? 'AI' : 'You'}
                    </div>
                    <div className={`max-w-xs text-xs rounded-lg px-3 py-2
                      ${t.role === 'interviewer' ? 'bg-violet-50 text-violet-800' : 'bg-gray-100 text-gray-700'}`}>
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page wrapper — reads sessionId from URL
───────────────────────────────────────────────────────────────────────────── */
function CandidateInterviewPageInner() {
  const params    = useSearchParams()
  const sessionId = params.get('sessionId')

  if (!sessionId) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <AlertCircle size={40} className="text-amber-500 mx-auto mb-4"/>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Missing Interview Link</h2>
        <p className="text-sm text-gray-600">Please use the full interview link sent to you by HR. It should look like:<br/>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block">…/candidate-interview?sessionId=…</code>
        </p>
      </div>
    </div>
  )

  return <CandidateInterviewRoom sessionId={sessionId}/>
}

export default function CandidateInterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <CandidateInterviewPageInner/>
    </Suspense>
  )
}
