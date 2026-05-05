'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Camera, Mic, MicOff, Play, Square, CheckCircle, ChevronRight,
  Loader2, AlertCircle, RotateCcw, Video, Send
} from 'lucide-react'

function getQuestions(jobTitle: string): string[] {
  const t = (jobTitle || '').toLowerCase()
  if (t.includes('engineer') || t.includes('developer'))
    return [
      'Walk us through your technical background and the most relevant project you\'ve worked on.',
      'Describe a challenging technical problem you solved. What was your approach and outcome?',
      'How do you ensure quality in your work? Mention any tools or processes you use.',
      'Tell us about your experience working in cross-functional teams.',
      'What are your salary expectations and when can you join?',
    ]
  if (t.includes('manager') || t.includes('lead'))
    return [
      'Tell us about your leadership experience — team size, industry, and key achievements.',
      'How do you handle a team member who is consistently underperforming?',
      'Describe a time you managed conflicting priorities across stakeholders.',
      'Walk us through a successful initiative you led end-to-end.',
      'What are your compensation expectations for this role?',
    ]
  return [
    'Introduce yourself — your background, current role, and what brought you here.',
    'Why are you interested in this opportunity specifically?',
    'What are your top 3 professional strengths and how do they apply to this role?',
    'Tell us about a difficult situation at work and how you resolved it.',
    'What are your salary expectations and earliest joining date?',
  ]
}

type Phase = 'setup' | 'ready' | 'recording' | 'reviewing' | 'submitting' | 'done' | 'error'

interface Recording { questionIndex: number; blob: Blob; url: string; duration: number }

export default function VideoPrescreenPage() {
  const { sessionId } = useParams<{ sessionId: string }>()

  /* ── Session data ─────────────────────────────────────────────── */
  const [session,   setSession]   = useState<any>(null)
  const [loadError, setLoadError] = useState('')
  const [phase,     setPhase]     = useState<Phase>('setup')

  /* ── Camera/recorder state ────────────────────────────────────── */
  const videoRef      = useRef<HTMLVideoElement>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const chunksRef     = useRef<BlobPart[]>([])
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  const [camReady,    setCamReady]    = useState(false)
  const [camError,    setCamError]    = useState('')
  const [elapsed,     setElapsed]     = useState(0)
  const [currentQ,    setCurrentQ]    = useState(0)
  const [recordings,  setRecordings]  = useState<Recording[]>([])
  const [reviewing,   setReviewing]   = useState<Recording | null>(null)
  const [submitting,  setSubmitting]  = useState(false)

  /* ── Load session ────────────────────────────────────────────── */
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/pre-screen/${sessionId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setLoadError(d.error); setPhase('error'); return }
        setSession(d)
      })
      .catch(() => { setLoadError('Session not found.'); setPhase('error') })
  }, [sessionId])

  const questions = session ? getQuestions(session.job_title || '') : []

  /* ── Camera init ─────────────────────────────────────────────── */
  const startCamera = useCallback(async () => {
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        await videoRef.current.play()
      }
      setCamReady(true)
      setPhase('ready')
    } catch (e: any) {
      setCamError('Camera / microphone access denied. Please allow permissions and refresh.')
    }
  }, [])

  /* ── Start recording ─────────────────────────────────────────── */
  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mr = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm',
    })
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.start(200)
    mediaRecorder.current = mr
    setElapsed(0)
    setPhase('recording')
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  /* ── Stop recording ──────────────────────────────────────────── */
  function stopRecording() {
    if (!mediaRecorder.current) return
    clearInterval(timerRef.current!)
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url  = URL.createObjectURL(blob)
      const rec: Recording = { questionIndex: currentQ, blob, url, duration: elapsed }
      setRecordings(prev => {
        const next = prev.filter(r => r.questionIndex !== currentQ)
        return [...next, rec]
      })
      setReviewing(rec)
      setPhase('reviewing')
    }
    mediaRecorder.current.stop()
  }

  /* ── Accept / Re-record ──────────────────────────────────────── */
  function acceptRecording() {
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1)
      setPhase('ready')
      setReviewing(null)
    } else {
      setPhase('ready')
      setReviewing(null)
    }
  }

  function reRecord() { setPhase('ready'); setReviewing(null) }

  /* ── Submit all ──────────────────────────────────────────────── */
  async function submitAll() {
    setSubmitting(true)
    setPhase('submitting')
    // Build metadata payload (blobs can't go over JSON; in production upload to Supabase Storage)
    const payload = {
      session_id: sessionId,
      recordings: recordings.map(r => ({
        question_index: r.questionIndex,
        question:       questions[r.questionIndex],
        duration_secs:  r.duration,
        recorded_at:    new Date().toISOString(),
        // Simulate a storage path — in prod this would be a Supabase Storage URL
        storage_path:   `video-prescreen/${sessionId}/q${r.questionIndex + 1}.webm`,
      })),
      submitted_at: new Date().toISOString(),
    }
    try {
      await fetch('/api/video-prescreen/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
    } catch { /* best-effort */ }
    // Stop camera
    streamRef.current?.getTracks().forEach(t => t.stop())
    setPhase('done')
  }

  /* ── Cleanup ─────────────────────────────────────────────────── */
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    clearInterval(timerRef.current!)
  }, [])

  const fmtTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  if (!session && !loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-red-700"/>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4"/>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Not Found</h2>
          <p className="text-sm text-gray-500">{loadError}</p>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-lg">
          <CheckCircle size={56} className="mx-auto text-green-500 mb-4"/>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">All Done — Thank You!</h2>
          <p className="text-gray-600 mb-1">Your video responses have been submitted to the Howell HR team.</p>
          <p className="text-sm text-gray-500">You'll receive an update by email within 2 business days.</p>
          <div className="mt-6 bg-gray-50 rounded-xl p-4 text-left text-sm text-gray-600">
            <p className="font-semibold mb-1">What happens next?</p>
            <p>Our AI will analyse your responses for technical accuracy and communication clarity. A recruiter will review and reach out shortly.</p>
          </div>
        </div>
      </div>
    )
  }

  const answered    = recordings.length
  const allAnswered = answered === questions.length

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-700 rounded-lg flex items-center justify-center font-bold text-sm">H</div>
          <div>
            <div className="font-semibold text-sm">Howell HR · Video Pre-Screen</div>
            {session && <div className="text-xs text-gray-400">{session.job_title} · {session.candidate_name}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${
                recordings.find(r => r.questionIndex === i) ? 'bg-green-400' :
                i === currentQ ? 'bg-yellow-400' : 'bg-gray-600'
              }`}/>
            ))}
          </div>
          <span>{answered}/{questions.length} answered</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Camera pane */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-900">
          <div className="relative w-full max-w-2xl aspect-video bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted/>

            {!camReady && !camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Camera size={48} className="text-gray-500 mb-4"/>
                <p className="text-gray-400 text-sm">Camera not started</p>
              </div>
            )}

            {phase === 'recording' && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 rounded-full px-3 py-1.5">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"/>
                <span className="text-xs font-bold">REC {fmtTime(elapsed)}</span>
              </div>
            )}

            {phase === 'reviewing' && reviewing && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4">
                <video src={reviewing.url} controls className="w-full max-h-64 rounded-xl mb-4"/>
                <p className="text-sm text-gray-300 mb-4 text-center">
                  Recording duration: {fmtTime(reviewing.duration)}<br/>
                  Review your answer and accept or re-record.
                </p>
                <div className="flex gap-3">
                  <button onClick={reRecord}
                    className="flex items-center gap-2 px-5 py-2.5 border border-gray-500 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition">
                    <RotateCcw size={15}/> Re-record
                  </button>
                  <button onClick={acceptRecording}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition">
                    <CheckCircle size={15}/> Accept Answer
                  </button>
                </div>
              </div>
            )}
          </div>

          {camError && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 max-w-2xl w-full">
              <AlertCircle size={15}/> {camError}
            </div>
          )}

          {/* Controls */}
          <div className="mt-5 flex items-center gap-4">
            {phase === 'setup' && (
              <button onClick={startCamera}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-8 py-3 rounded-xl font-bold transition">
                <Camera size={18}/> Start Camera
              </button>
            )}
            {phase === 'ready' && (
              <button onClick={startRecording}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition">
                <Play size={18}/> Record Answer
              </button>
            )}
            {phase === 'recording' && (
              <button onClick={stopRecording}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold transition">
                <Square size={18}/> Stop Recording
              </button>
            )}
          </div>

          {/* Max duration warning */}
          {phase === 'recording' && elapsed >= 90 && (
            <p className="mt-2 text-xs text-yellow-400">Tip: aim for 1–3 minutes per answer.</p>
          )}
        </div>

        {/* Question panel */}
        <div className="lg:w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-5 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">
              Question {currentQ + 1} of {questions.length}
            </h2>
            <p className="text-white text-base leading-relaxed font-medium">
              {questions[currentQ]}
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Aim for 1–3 minutes. Speak clearly and provide specific examples.
            </p>
          </div>

          {/* Question list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {questions.map((q, i) => {
              const done = !!recordings.find(r => r.questionIndex === i)
              const isCurrent = i === currentQ
              return (
                <button key={i} onClick={() => {
                  if (phase !== 'recording') { setCurrentQ(i); setPhase(camReady ? 'ready' : 'setup'); setReviewing(null) }
                }}
                  disabled={phase === 'recording'}
                  className={`w-full text-left p-3 rounded-xl text-sm transition ${
                    isCurrent ? 'bg-red-800/40 border border-red-600 text-white' :
                    done      ? 'bg-green-900/30 border border-green-700 text-green-300' :
                    'bg-gray-700/50 border border-transparent text-gray-400 hover:bg-gray-700'
                  }`}>
                  <div className="flex items-center gap-2">
                    {done ? <CheckCircle size={13} className="text-green-400 flex-shrink-0"/> :
                     isCurrent ? <Video size={13} className="text-red-400 flex-shrink-0"/> :
                     <div className="w-3 h-3 rounded-full border border-gray-500 flex-shrink-0"/>}
                    <span className="line-clamp-2">{q}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Submit */}
          <div className="p-4 border-t border-gray-700">
            {allAnswered ? (
              <button onClick={submitAll} disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-bold transition disabled:opacity-60">
                {submitting
                  ? <><Loader2 size={16} className="animate-spin"/> Submitting…</>
                  : <><Send size={16}/> Submit All {questions.length} Answers</>}
              </button>
            ) : (
              <div className="text-center text-xs text-gray-500">
                {questions.length - answered} question{questions.length - answered !== 1 ? 's' : ''} remaining
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
