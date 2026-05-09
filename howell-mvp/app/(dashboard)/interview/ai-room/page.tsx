'use client'
/**
 * AI Interview Room
 *
 * Custom-mode  (?applicationId=X&roundId=Y&mode=custom)
 *   → Full custom bot: HeyGen avatar + Deepgram STT + ElevenLabs TTS + Claude AI
 *
 * Legacy-mode  (?sessionId=X)
 *   → Existing Tavus-based session viewer (unchanged)
 */
import {
  useEffect, useState, useRef, useCallback, Suspense
} from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Video, Mic, MicOff, CheckCircle, AlertCircle,
  ArrowLeft, Bot, User, RefreshCw, ExternalLink,
  Circle, ChevronDown, ChevronUp, Star,
  ThumbsUp, ThumbsDown, Minus, Activity, Zap
} from 'lucide-react'
import Link from 'next/link'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
type Phase =
  | 'setup'          // loading data / requesting permissions
  | 'connecting'     // setting up HeyGen + Deepgram
  | 'ready'          // everything connected, waiting to start
  | 'opening'        // avatar giving opening greeting
  | 'listening'      // waiting for candidate to speak
  | 'processing'     // sending answer to Claude
  | 'speaking'       // avatar speaking next question/response
  | 'completed'      // interview done
  | 'error'

interface TranscriptEntry {
  role:      'interviewer' | 'candidate'
  text:      string
  timestamp: string
  score?:    number
}

interface SignalColors {
  [key: string]: string
}

const SIGNAL_COLORS: SignalColors = {
  Strong:  'bg-green-100 text-green-700',
  Good:    'bg-blue-100 text-blue-700',
  Neutral: 'bg-gray-100 text-gray-600',
  Weak:    'bg-amber-100 text-amber-700',
  Poor:    'bg-red-100 text-red-600',
}

/* ─────────────────────────────────────────────────────────────────────────────
   Utility: Convert MP3 ArrayBuffer → PCM base64 (16kHz, 16-bit, mono)
   Used to send ElevenLabs audio to HeyGen for lip-sync
───────────────────────────────────────────────────────────────────────────── */
async function mp3ToPcmBase64(audioBuffer: ArrayBuffer): Promise<string> {
  const ctx     = new AudioContext()
  const decoded = await ctx.decodeAudioData(audioBuffer.slice(0))
  await ctx.close()

  // Resample to 16kHz (HeyGen input_audio requirement)
  const targetRate  = 16000
  const offCtx      = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate)
  const src         = offCtx.createBufferSource()
  src.buffer        = decoded
  src.connect(offCtx.destination)
  src.start()
  const rendered = await offCtx.startRendering()
  const f32      = rendered.getChannelData(0)

  // Float32 → Int16
  const int16 = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)))
  }

  // Int16 → base64
  const bytes  = new Uint8Array(int16.buffer)
  let   binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/* ─────────────────────────────────────────────────────────────────────────────
   Custom Bot Interview Room
───────────────────────────────────────────────────────────────────────────── */
function CustomBotRoom({
  applicationId,
  roundId,
}: {
  applicationId: string
  roundId:       string | null
}) {
  /* ── State ── */
  const [phase,          setPhase]          = useState<Phase>('setup')
  const [log,            setLog]            = useState<string[]>([])
  const [questions,      setQuestions]      = useState<string[]>([])
  const [candidateName,  setCandidateName]  = useState('')
  const [jobTitle,       setJobTitle]       = useState('')
  const [sessionDbId,    setSessionDbId]    = useState<string | null>(null)
  const [heygenSessId,   setHeygenSessId]   = useState<string | null>(null)
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

  /* ── Refs (readable inside callbacks) ── */
  const avatarVideoRef       = useRef<HTMLVideoElement>(null)
  const webcamVideoRef       = useRef<HTMLVideoElement>(null)
  const pcRef                = useRef<RTCPeerConnection | null>(null)
  const deepgramWsRef        = useRef<WebSocket | null>(null)
  const micStreamRef         = useRef<MediaStream | null>(null)
  const audioCtxRef          = useRef<AudioContext | null>(null)
  const processorRef         = useRef<ScriptProcessorNode | null>(null)
  const silenceTimerRef      = useRef<ReturnType<typeof setTimeout>>()
  const answerBufferRef      = useRef('')
  const questionIndexRef     = useRef(0)
  const scoresRef            = useRef<number[]>([])
  const transcriptRef        = useRef<TranscriptEntry[]>([])
  const isSpeakingRef        = useRef(false)
  const heygenSessIdRef      = useRef<string | null>(null)
  const sessionDbIdRef       = useRef<string | null>(null)
  const candidateNameRef     = useRef('')
  const jobTitleRef          = useRef('')
  const questionsRef         = useRef<string[]>([])
  const phaseRef             = useRef<Phase>('setup')

  const addLog  = (msg: string) => setLog(p => [...p, msg])

  const setPhaseSync = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  /* ── Step 1: Load interview data ── */
  useEffect(() => {
    async function load() {
      addLog('Loading interview data…')
      const url = `/api/interviews/ai-interview?applicationId=${applicationId}${roundId ? `&roundId=${roundId}` : ''}`
      const res  = await fetch(url)
      const data = await res.json()

      if (data.error) { setPhaseSync('error'); addLog(`✗ ${data.error}`); return }

      setCandidateName(data.candidateName)
      setJobTitle(data.jobTitle)
      setQuestions(data.questions)
      setSessionDbId(data.sessionId)
      candidateNameRef.current = data.candidateName
      jobTitleRef.current      = data.jobTitle
      questionsRef.current     = data.questions
      sessionDbIdRef.current   = data.sessionId
      addLog(`✓ ${data.questions.length} questions loaded for ${data.candidateName}`)

      // Request camera + mic
      addLog('Requesting camera & microphone…')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        micStreamRef.current = stream
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream
          webcamVideoRef.current.muted     = true  // don't echo candidate's own mic
        }
        addLog('✓ Camera & microphone ready')
      } catch {
        addLog('✗ Camera/mic denied — proceeding with audio only')
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true })
          micStreamRef.current = audioOnly
          addLog('✓ Microphone ready (no camera)')
        } catch {
          setPhaseSync('error')
          addLog('✗ Microphone access required')
          return
        }
      }

      setPhaseSync('ready')
      addLog('Ready — press Start Interview')
    }
    load()
  }, [applicationId, roundId])

  /* ── Step 2: Connect HeyGen avatar ── */
  async function connectHeyGen() {
    addLog('Creating HeyGen avatar session…')
    const res  = await fetch('/api/interviews/heygen-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const session = await res.json()

    if (session.error) { throw new Error(`HeyGen: ${session.error}`) }

    setHeygenSessId(session.sessionId)
    heygenSessIdRef.current = session.sessionId

    // Native WebRTC peer connection
    const pc = new RTCPeerConnection({
      iceServers:       session.iceServers2?.length ? session.iceServers2 : session.iceServers,
      iceTransportPolicy: 'relay',
    })
    pcRef.current = pc

    // Show avatar video stream
    pc.ontrack = (event) => {
      if (event.track.kind === 'video' && avatarVideoRef.current) {
        avatarVideoRef.current.srcObject = event.streams[0]
        avatarVideoRef.current.muted     = true  // we'll play ElevenLabs audio instead
      }
    }

    // Set HeyGen's SDP offer
    await pc.setRemoteDescription(new RTCSessionDescription(session.sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    // Submit SDP answer
    await fetch('/api/interviews/heygen-session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', sessionId: session.sessionId, sdp: answer }),
    })

    // Relay ICE candidates to HeyGen
    pc.onicecandidate = async (event) => {
      if (!event.candidate) return
      await fetch('/api/interviews/heygen-session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, candidate: event.candidate }),
      }).catch(() => { /* non-fatal */ })
    }

    addLog('✓ HeyGen avatar connected')
  }

  /* ── Step 3: Connect Deepgram STT ── */
  async function connectDeepgram() {
    addLog('Connecting real-time speech recognition…')
    const tokenRes = await fetch('/api/interviews/deepgram-token')
    const { apiKey } = await tokenRes.json()

    const ws = new WebSocket(
      'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
        encoding:    'linear16',
        sample_rate: '16000',
        language:    'en-US',
        punctuate:   'true',
        interim_results: 'true',
        endpointing: '500',
      }),
      ['token', apiKey]
    )

    ws.onopen = () => {
      addLog('✓ Speech recognition ready')
      startMicCapture(ws)
    }

    ws.onmessage = (event) => {
      try {
        const data  = JSON.parse(event.data)
        const alt   = data.channel?.alternatives?.[0]
        const text  = alt?.transcript?.trim()
        const final = data.is_final

        if (!text) return
        if (isSpeakingRef.current) return  // ignore mic during avatar speech

        if (!final) {
          setLiveText(text)
        } else {
          setLiveText('')
          handleCandidateSpeech(text)
        }
      } catch { /* ignore parse errors */ }
    }

    ws.onerror = () => addLog('⚠ Speech recognition error — continuing')
    deepgramWsRef.current = ws
  }

  /* ── Mic → Deepgram audio pump ── */
  function startMicCapture(ws: WebSocket) {
    if (!micStreamRef.current) return

    const ctx  = new AudioContext({ sampleRate: 16000 })
    const src  = ctx.createMediaStreamSource(micStreamRef.current)
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    audioCtxRef.current  = ctx
    processorRef.current = proc

    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return
      if (isSpeakingRef.current) return

      const f32   = e.inputBuffer.getChannelData(0)
      const int16 = new Int16Array(f32.length)
      for (let i = 0; i < f32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)))
      }
      ws.send(int16.buffer)
    }

    src.connect(proc)
    proc.connect(ctx.destination)
  }

  /* ── Handle final transcript chunk ── */
  function handleCandidateSpeech(text: string) {
    if (phaseRef.current !== 'listening') return
    if (!text) return

    answerBufferRef.current += ' ' + text
    setCurrentAnswer(answerBufferRef.current.trim())

    // Reset silence timer — 3s of silence = answer complete
    clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      const answer = answerBufferRef.current.trim()
      answerBufferRef.current = ''
      setCurrentAnswer('')
      if (answer.split(' ').length >= 3) {
        submitCandidateAnswer(answer)
      }
    }, 3000)
  }

  /* ── Make avatar speak (ElevenLabs voice + HeyGen lip-sync) ── */
  async function speakAvatar(text: string) {
    isSpeakingRef.current = true
    setPhaseSync('speaking')
    setMicEnabled(false)

    // Save to transcript
    const entry: TranscriptEntry = {
      role:      'interviewer',
      text,
      timestamp: new Date().toISOString(),
    }
    transcriptRef.current = [...transcriptRef.current, entry]
    setTranscript([...transcriptRef.current])

    try {
      // 1. Get ElevenLabs audio
      const ttsRes = await fetch('/api/interviews/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      })

      if (ttsRes.ok) {
        const audioData = await ttsRes.arrayBuffer()

        // 2. Convert MP3 → PCM → send to HeyGen for lip-sync
        try {
          const pcmBase64 = await mp3ToPcmBase64(audioData.slice(0))
          await fetch('/api/interviews/heygen-session', {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              action:     'speak_audio',
              sessionId:  heygenSessIdRef.current,
              inputAudio: pcmBase64,
            }),
          })
        } catch {
          // Fallback: use HeyGen's own TTS if PCM conversion fails
          await fetch('/api/interviews/heygen-session', {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              action:    'speak',
              sessionId: heygenSessIdRef.current,
              text,
            }),
          })
        }

        // 3. Play ElevenLabs audio in browser (user hears this)
        await new Promise<void>((resolve) => {
          const blob = new Blob([audioData], { type: 'audio/mpeg' })
          const url  = URL.createObjectURL(blob)
          const aud  = new Audio(url)
          aud.onended = () => { URL.revokeObjectURL(url); resolve() }
          aud.onerror = () => { URL.revokeObjectURL(url); resolve() }
          aud.play().catch(() => resolve())
        })
      } else {
        // ElevenLabs failed — use HeyGen TTS only
        await fetch('/api/interviews/heygen-session', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            action:    'speak',
            sessionId: heygenSessIdRef.current,
            text,
          }),
        })
        await new Promise<void>(r => setTimeout(r, text.split(' ').length * 350))
      }
    } catch {
      await new Promise<void>(r => setTimeout(r, text.split(' ').length * 350))
    } finally {
      isSpeakingRef.current = false
      setMicEnabled(true)
    }
  }

  /* ── Submit candidate answer to Claude ── */
  async function submitCandidateAnswer(answer: string) {
    if (phaseRef.current !== 'listening') return
    setPhaseSync('processing')

    // Save candidate's answer to transcript
    const entry: TranscriptEntry = {
      role:      'candidate',
      text:      answer,
      timestamp: new Date().toISOString(),
    }
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

      if (data.error) { addLog(`Claude error: ${data.error}`); return }

      // Update scores
      if (data.score !== null && data.score !== undefined) {
        const newScores = [...scoresRef.current, data.score]
        scoresRef.current = newScores
        setScores(newScores)
        setAvgScore(data.avgScore)
        setLastSignal(data.signal)

        // Tag the candidate entry with score
        const tagged = transcriptRef.current.map((t, i) =>
          i === transcriptRef.current.length - 1 ? { ...t, score: data.score } : t
        )
        transcriptRef.current = tagged
        setTranscript(tagged)
      }

      if (data.isComplete) {
        // Interview finished
        await speakAvatar(data.speech)
        setPhaseSync('completed')
        await saveInterview()
      } else {
        // Next question
        questionIndexRef.current = data.nextQuestionIndex
        setQuestionIndex(data.nextQuestionIndex)
        await speakAvatar(data.speech)
        setPhaseSync('listening')
      }
    } catch (err: any) {
      addLog(`Error: ${err.message}`)
      setPhaseSync('listening')
    }
  }

  /* ── Save completed interview to DB ── */
  async function saveInterview() {
    if (!sessionDbIdRef.current) return
    try {
      const res = await fetch('/api/interviews/ai-interview', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sessionId:     sessionDbIdRef.current,
          transcript:    transcriptRef.current,
          avgScore:      avgScore ?? Math.round(scoresRef.current.reduce((a, b) => a + b, 0) / (scoresRef.current.length || 1)),
          candidateName: candidateNameRef.current,
          jobTitle:      jobTitleRef.current,
        }),
      })
      const data = await res.json()
      if (data.evaluation) setEvaluation(data.evaluation)
    } catch { /* non-fatal */ }

    // Stop HeyGen session
    if (heygenSessIdRef.current) {
      fetch('/api/interviews/heygen-session', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId: heygenSessIdRef.current }),
      }).catch(() => {})
    }

    // Stop Deepgram
    deepgramWsRef.current?.close()

    // Stop mic
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    processorRef.current?.disconnect()
    audioCtxRef.current?.close()
  }

  /* ── Start interview ── */
  async function startInterview() {
    setPhaseSync('connecting')
    addLog('Connecting services…')

    try {
      await connectHeyGen()
      await connectDeepgram()
    } catch (err: any) {
      addLog(`✗ Connection failed: ${err.message}`)
      setPhaseSync('error')
      return
    }

    // Wait a moment for WebRTC to settle
    await new Promise<void>(r => setTimeout(r, 2000))

    setPhaseSync('opening')
    addLog('Starting interview…')

    // Get opening speech from Claude
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

    if (data.speech) {
      await speakAvatar(data.speech)
    }

    setPhaseSync('listening')
  }

  /* ── End interview manually ── */
  async function endInterview() {
    clearTimeout(silenceTimerRef.current)
    const farewell = `Thank you so much for your time, ${candidateNameRef.current}. We appreciate your participation and will be in touch soon with next steps.`
    await speakAvatar(farewell)
    setPhaseSync('completed')
    await saveInterview()
  }

  /* ── Toggle mic ── */
  function toggleMic() {
    if (!micStreamRef.current) return
    micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setMicEnabled(p => !p)
  }

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      clearTimeout(silenceTimerRef.current)
      deepgramWsRef.current?.close()
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      processorRef.current?.disconnect()
      audioCtxRef.current?.close()
      if (heygenSessIdRef.current) {
        fetch('/api/interviews/heygen-session', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sessionId: heygenSessIdRef.current }),
        }).catch(() => {})
      }
    }
  }, [])

  /* ── Derived ── */
  const totalQuestions = questions.length || 1
  const progressPct    = Math.round((questionIndex / totalQuestions) * 100)
  const isLive         = phase === 'listening' || phase === 'speaking' || phase === 'processing' || phase === 'opening'
  const scoreColor     = avgScore === null ? 'text-gray-400'
    : avgScore >= 75 ? 'text-green-600'
    : avgScore >= 55 ? 'text-amber-600'
    : 'text-red-500'

  /* ═══════════════════════════════════════════════════════════════
     Render
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* ── Back Nav ── */}
      <Link
        href="/interviews"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={13} /> Back to Interviews
      </Link>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot size={20} className="text-violet-600" />
            AI Interview Room
          </h1>
          {candidateName && (
            <p className="text-sm text-gray-500 mt-0.5">
              {candidateName} · {jobTitle}
            </p>
          )}
        </div>

        {/* Phase badge */}
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          phase === 'completed'  ? 'bg-green-100 text-green-700' :
          phase === 'listening'  ? 'bg-blue-100 text-blue-700' :
          phase === 'speaking'   ? 'bg-violet-100 text-violet-700' :
          phase === 'processing' ? 'bg-amber-100 text-amber-700' :
          phase === 'error'      ? 'bg-red-100 text-red-600' :
          'bg-gray-100 text-gray-600'
        }`}>
          {phase === 'setup'       ? 'Loading'       :
           phase === 'connecting'  ? 'Connecting…'   :
           phase === 'ready'       ? 'Ready'          :
           phase === 'opening'     ? 'Starting…'      :
           phase === 'listening'   ? '● Listening'    :
           phase === 'processing'  ? 'Processing…'   :
           phase === 'speaking'    ? '▶ Speaking'     :
           phase === 'completed'   ? 'Completed'      :
           'Error'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ══ Left: Video panels + controls ══════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">

          {/* ── Video row ── */}
          <div className="grid grid-cols-2 gap-3">

            {/* HeyGen avatar */}
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video">
              <video
                ref={avatarVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Fallback when no avatar stream yet */}
              {(phase === 'setup' || phase === 'connecting' || phase === 'ready') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <div className="w-16 h-16 rounded-full bg-violet-700/60 flex items-center justify-center mb-2">
                    <Bot size={28} className="text-violet-200" />
                  </div>
                  <p className="text-sm font-semibold">Alex</p>
                  <p className="text-xs text-gray-400">AI Interviewer</p>
                </div>
              )}
              {/* Speaking animation ring */}
              {phase === 'speaking' && (
                <div className="absolute inset-0 rounded-2xl ring-4 ring-violet-500 ring-opacity-75 animate-pulse pointer-events-none" />
              )}
              <div className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                <Bot size={10} /> Alex (AI)
              </div>
              {phase === 'speaking' && (
                <div className="absolute top-2 right-2 text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Circle size={6} className="fill-white animate-pulse" /> Speaking
                </div>
              )}
            </div>

            {/* Candidate webcam */}
            <div className="relative bg-gray-800 rounded-2xl overflow-hidden aspect-video">
              <video
                ref={webcamVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {isLive && (
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                  <Circle size={6} className="fill-red-500 text-red-500 animate-pulse" />
                  REC
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                <User size={10} /> {candidateName || 'Candidate'}
              </div>
              {phase === 'listening' && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-600/80 text-white text-xs px-2 py-0.5 rounded-full">
                  <Mic size={9} /> Listening
                </div>
              )}
            </div>
          </div>

          {/* ── Setup log / controls ── */}
          {(phase === 'setup' || phase === 'connecting' || phase === 'ready') && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
                {log.map((l, i) => (
                  <p key={i} className={`text-xs font-mono ${l.startsWith('✗') ? 'text-red-500' : l.startsWith('✓') ? 'text-green-600' : 'text-gray-500'}`}>{l}</p>
                ))}
                {(phase === 'setup' || phase === 'connecting') && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin" />
                    {phase === 'connecting' ? 'Connecting…' : 'Loading…'}
                  </div>
                )}
              </div>
              {phase === 'ready' && (
                <button
                  onClick={startInterview}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
                >
                  <Video size={16} /> Start AI Interview
                </button>
              )}
            </div>
          )}

          {/* ── Live transcript + answer display ── */}
          {isLive && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              {/* Current question */}
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Bot size={12} className="text-violet-600" />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {questions[questionIndex] ?? '—'}
                </p>
              </div>

              {/* Live candidate speech */}
              {(phase === 'listening') && (
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mic size={11} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    {liveText && (
                      <p className="text-sm text-gray-500 italic">{liveText}</p>
                    )}
                    {currentAnswer && (
                      <p className="text-sm text-gray-800 mt-1">{currentAnswer}</p>
                    )}
                    {!liveText && !currentAnswer && (
                      <p className="text-xs text-gray-400 italic">Waiting for response…</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Interview controls (while live) ── */}
          {isLive && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMic}
                className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition ${
                  micEnabled
                    ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    : 'border-red-200 bg-red-50 text-red-600'
                }`}
              >
                {micEnabled ? <Mic size={13} /> : <MicOff size={13} />}
                {micEnabled ? 'Mute' : 'Unmute'}
              </button>
              <button
                onClick={endInterview}
                disabled={phase === 'processing' || phase === 'speaking'}
                className="ml-auto flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-900 disabled:opacity-40 transition"
              >
                End Interview
              </button>
            </div>
          )}

          {/* ── Transcript accordion ── */}
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
                    <div
                      key={i}
                      className={`px-4 py-3 flex gap-3 ${line.role === 'interviewer' ? 'bg-violet-50' : 'bg-white'}`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                        line.role === 'interviewer' ? 'bg-violet-200' : 'bg-gray-200'
                      }`}>
                        {line.role === 'interviewer'
                          ? <Bot size={11} className="text-violet-700" />
                          : <User size={11} className="text-gray-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-500 capitalize">{line.role}</span>
                          {line.score !== undefined && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              line.score >= 75 ? 'bg-green-100 text-green-700' :
                              line.score >= 55 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-600'
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

        {/* ══ Right: Score panel + info ══════════════════════════════════ */}
        <div className="space-y-4">

          {/* Progress bar */}
          {(isLive || phase === 'completed') && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Progress</span>
                <span className="text-xs text-gray-600">
                  Q{questionIndex + 1} / {totalQuestions}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Live score */}
          {(isLive || phase === 'completed') && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">AI Score</p>
              <div className={`text-5xl font-black ${scoreColor}`}>
                {avgScore ?? '—'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">/ 100</div>

              {/* Score bar */}
              {avgScore !== null && (
                <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      avgScore >= 75 ? 'bg-green-500' :
                      avgScore >= 55 ? 'bg-amber-400' : 'bg-red-500'
                    }`}
                    style={{ width: `${avgScore}%` }}
                  />
                </div>
              )}

              {/* Last signal badge */}
              {lastSignal && (
                <span className={`mt-3 inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                  SIGNAL_COLORS[lastSignal] ?? 'bg-gray-100 text-gray-600'
                }`}>
                  {lastSignal}
                </span>
              )}

              {/* Score sparkline */}
              {scores.length > 0 && (
                <div className="flex items-end gap-0.5 h-8 mt-3 justify-center">
                  {scores.slice(-12).map((s, i) => (
                    <div
                      key={i}
                      className={`w-3 rounded-sm ${
                        s >= 75 ? 'bg-green-400' :
                        s >= 55 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ height: `${Math.max(10, s)}%` }}
                      title={`Q${i + 1}: ${s}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Final evaluation */}
          {phase === 'completed' && evaluation && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Evaluation</h3>

              {/* Recommendation */}
              <div className={`flex items-center gap-2 text-sm font-semibold p-2 rounded-lg ${
                evaluation.recommendation === 'Strong Hire' ? 'bg-green-50 text-green-700' :
                evaluation.recommendation === 'Hire'        ? 'bg-blue-50 text-blue-700' :
                evaluation.recommendation === 'Consider'    ? 'bg-amber-50 text-amber-700' :
                'bg-red-50 text-red-600'
              }`}>
                {evaluation.recommendation === 'Strong Hire' || evaluation.recommendation === 'Hire'
                  ? <ThumbsUp size={14} />
                  : evaluation.recommendation === 'Reject'
                    ? <ThumbsDown size={14} />
                    : <Minus size={14} />}
                {evaluation.recommendation}
              </div>

              {evaluation.summary && (
                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg">
                  {evaluation.summary}
                </p>
              )}

              {evaluation.strengths?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1">✓ Strengths</p>
                  <ul className="space-y-0.5">
                    {evaluation.strengths.map((s: string, i: number) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                        <span className="text-green-500 flex-shrink-0">•</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.concerns?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-1">⚠ Concerns</p>
                  <ul className="space-y-0.5">
                    {evaluation.concerns.map((c: string, i: number) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                        <span className="text-red-400 flex-shrink-0">•</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Completed — back link */}
          {phase === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle size={28} className="text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-700">Interview Complete</p>
              <p className="text-xs text-gray-500 mt-1">Results saved to candidate profile.</p>
              <Link
                href="/interviews"
                className="mt-3 inline-block text-xs text-violet-600 hover:underline"
              >
                ← Back to Interviews
              </Link>
            </div>
          )}

          {/* Powered-by badges */}
          <div className="flex flex-wrap gap-1.5 text-[10px] text-gray-400">
            <span className="bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Zap size={8} /> HeyGen Avatar</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Mic size={8} /> Deepgram STT</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Activity size={8} /> ElevenLabs TTS</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Bot size={8} /> Claude AI</span>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Legacy Tavus session viewer (unchanged behaviour)
───────────────────────────────────────────────────────────────────────────── */
function LegacySessionViewer({ sessionId }: { sessionId: string }) {
  const [session, setSession]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [showTx,  setShowTx]    = useState(false)
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
    if (session?.status === 'in_progress') {
      pollRef.current = setInterval(load, 10_000)
    } else {
      clearInterval(pollRef.current)
    }
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
  const isMock = !session.tavus_conversation_url

  async function retryWithTavus() {
    setRetrying(true)
    try {
      await fetch('/api/interviews/ai-session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, status: 'cancelled' }),
      })
      const res  = await fetch('/api/interviews/start-ai-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: session.application_id }),
      })
      const data = await res.json()
      if (data.sessionId) window.location.href = `/interview/ai-room?sessionId=${data.sessionId}`
      else alert(`Error: ${data.error ?? 'Unknown'}`)
    } finally { setRetrying(false) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/interviews" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={13} /> Back to Interviews
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot size={20} className="text-violet-600" /> AI Interview Session
          </h1>
          {session.application?.candidate && (
            <p className="text-sm text-gray-500 mt-1">
              {session.application.candidate.full_name} · {session.application.job?.title}
            </p>
          )}
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video relative">
        {session.tavus_conversation_url && !isDone ? (
          <iframe
            src={session.tavus_conversation_url}
            allow="camera; microphone; autoplay; fullscreen"
            className="w-full h-full"
            title="AI Interview"
          />
        ) : isDone ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <CheckCircle size={48} className="text-green-400 mb-3" />
            <p className="text-lg font-semibold">Interview Completed</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <Bot size={40} className="text-violet-300 mb-3" />
            <p className="font-semibold">Demo Mode</p>
            <button
              onClick={retryWithTavus}
              disabled={retrying}
              className="mt-4 flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
            >
              {retrying ? <><RefreshCw size={14} className="animate-spin" /> Launching…</> : <><Video size={14} /> Start Live AI Interview</>}
            </button>
          </div>
        )}
      </div>

      {session.transcript?.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setShowTx(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <span>Transcript ({session.transcript.length} exchanges)</span>
            {showTx ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showTx && (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {session.transcript.map((line: any, i: number) => (
                <div key={i} className={`px-4 py-3 flex gap-3 ${line.role === 'interviewer' ? 'bg-violet-50' : 'bg-white'}`}>
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
   Router: decides which view to show
───────────────────────────────────────────────────────────────────────────── */
function AIRoomContent() {
  const searchParams  = useSearchParams()
  const sessionId     = searchParams.get('sessionId')
  const applicationId = searchParams.get('applicationId')
  const roundId       = searchParams.get('roundId')
  const mode          = searchParams.get('mode')

  // Custom bot mode (new)
  if (mode === 'custom' && applicationId) {
    return <CustomBotRoom applicationId={applicationId} roundId={roundId} />
  }

  // Legacy Tavus mode
  if (sessionId) {
    return <LegacySessionViewer sessionId={sessionId} />
  }

  // No params — show landing
  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <div className="py-16 text-gray-400">
        <Bot size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No session selected.</p>
        <p className="text-xs mt-1">Navigate here from a candidate's interview card.</p>
        <Link href="/interviews" className="mt-4 inline-block text-xs text-red-600 hover:underline">
          ← Back to Interviews
        </Link>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Export
───────────────────────────────────────────────────────────────────────────── */
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
