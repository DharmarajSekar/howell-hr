'use client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Video, Mic, MicOff, CheckCircle, AlertCircle, Clock,
  Star, ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp,
  ArrowLeft, Bot, User, RefreshCw, ExternalLink, Circle
} from 'lucide-react'
import Link from 'next/link'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
interface Session {
  id: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  tavus_conversation_url: string | null
  tavus_conversation_id: string | null
  transcript: TranscriptLine[]
  ai_score: number | null
  ai_evaluation: string | null
  strengths: string[]
  concerns: string[]
  recommendation: 'pass' | 'fail' | 'maybe' | null
  scheduled_at: string | null
  completed_at: string | null
  application: {
    candidate: { full_name: string; email: string; current_title?: string }
    job: { title: string }
  }
}

interface TranscriptLine {
  role: 'interviewer' | 'candidate'
  content: string
  timestamp?: string
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────────────────────────── */
function AIRoomContent() {
  const searchParams = useSearchParams()
  const sessionId    = searchParams.get('sessionId')
  const applicationId = searchParams.get('applicationId')
  const roundId      = searchParams.get('roundId')

  const [session, setSession]   = useState<Session | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [launching, setLaunching] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pollRef   = useRef<NodeJS.Timeout>()

  /* ── Load session ── */
  const loadSession = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/interviews/ai-session?sessionId=${sessionId}`)
      const data = await res.json()
      if (data.session) setSession(data.session)
    } catch {
      setError('Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  /* ── Poll while in_progress ── */
  useEffect(() => {
    loadSession()
  }, [loadSession])

  useEffect(() => {
    if (session?.status === 'in_progress') {
      pollRef.current = setInterval(loadSession, 10_000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [session?.status, loadSession])

  /* ── Launch new AI session (if no sessionId in URL) ── */
  async function launchSession() {
    if (!applicationId || !roundId) {
      setError('Missing applicationId or roundId')
      return
    }
    setLaunching(true)
    try {
      // Get round config to find questions + persona
      const configRes = await fetch(`/api/interviews/config?jobId=_`)
      // We'll fetch directly from round data via auto-queue endpoint
      const res = await fetch('/api/interviews/ai-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          roundId,
          candidateName: 'Candidate',
          jobTitle: 'the role',
          questions: [],
          personaId: null,
        }),
      })
      const data = await res.json()
      if (data.session) {
        // Redirect with sessionId
        window.location.href = `/interview/ai-room?sessionId=${data.session.id}`
      } else {
        setError(data.error || 'Failed to launch session')
      }
    } finally {
      setLaunching(false)
    }
  }

  /* ── Mark session as complete (manual trigger) ── */
  async function completeSession() {
    if (!session) return
    const res = await fetch('/api/interviews/ai-session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        transcript: session.transcript || [],
        aiScore: null,
        evaluation: 'Session completed manually.',
        strengths: [],
        concerns: [],
        recommendation: 'maybe',
      }),
    })
    const data = await res.json()
    if (data.success) loadSession()
  }

  /* ── Render ── */
  if (!sessionId && !applicationId) {
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

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading AI interview session…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/interviews" className="mt-4 inline-block text-xs text-gray-500 hover:underline">← Back</Link>
      </div>
    )
  }

  if (!sessionId && applicationId) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <Bot size={40} className="mx-auto mb-4 text-violet-500" />
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Start AI Interview</h2>
        <p className="text-sm text-gray-500 mb-6">
          Click below to launch the AI video interview session with Tavus.
        </p>
        <button
          onClick={launchSession}
          disabled={launching}
          className="bg-violet-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
        >
          {launching ? 'Launching…' : '🎥 Launch AI Interview'}
        </button>
      </div>
    )
  }

  if (!session) return null

  const candidate = session.application?.candidate
  const job       = session.application?.job
  const isLive    = session.status === 'in_progress' || session.status === 'scheduled'
  const isDone    = session.status === 'completed'
  const isMock    = !session.tavus_conversation_url

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back Nav */}
      <Link href="/interviews" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={13} /> Back to Interviews
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot size={20} className="text-violet-600" />
            AI Interview Session
          </h1>
          {candidate && (
            <p className="text-sm text-gray-500 mt-1">
              {candidate.full_name} · {job?.title}
            </p>
          )}
        </div>

        <StatusBadge status={session.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Panel (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tavus iframe or mock */}
          <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video relative">
            {session.tavus_conversation_url && !isDone ? (
              <iframe
                ref={iframeRef}
                src={session.tavus_conversation_url}
                allow="camera; microphone; autoplay; fullscreen"
                className="w-full h-full"
                title="AI Interview"
              />
            ) : isDone ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white">
                <CheckCircle size={48} className="text-green-400 mb-3" />
                <p className="text-lg font-semibold">Interview Completed</p>
                {session.completed_at && (
                  <p className="text-sm text-gray-400 mt-1">
                    Completed {new Date(session.completed_at).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white">
                <div className="p-4 bg-violet-900/50 rounded-2xl mb-4">
                  <Bot size={48} className="text-violet-300" />
                </div>
                <p className="text-lg font-semibold">Demo Mode</p>
                <p className="text-sm text-gray-400 mt-1 text-center max-w-xs px-4">
                  Add <code className="bg-gray-800 px-1 rounded text-violet-300">TAVUS_API_KEY</code> to Vercel env vars to enable live AI video interviews.
                </p>
                <a
                  href="https://platform.tavus.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300"
                >
                  Get Tavus API Key <ExternalLink size={11} />
                </a>
              </div>
            )}

            {/* Live Recording Indicator */}
            {!isDone && !isMock && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                <Circle size={8} className="text-red-500 fill-red-500 animate-pulse" />
                RECORDING
              </div>
            )}
          </div>

          {/* Controls for active session */}
          {!isDone && session.tavus_conversation_url && (
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">
                Session ID: <code className="font-mono text-gray-700">{session.tavus_conversation_id}</code>
              </p>
              <button
                onClick={completeSession}
                className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 transition"
              >
                End Interview
              </button>
            </div>
          )}

          {/* Transcript */}
          {session.transcript && session.transcript.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTranscript(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <span>Interview Transcript ({session.transcript.length} exchanges)</span>
                {showTranscript ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showTranscript && (
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {session.transcript.map((line, i) => (
                    <div key={i} className={`px-4 py-3 flex gap-3 ${line.role === 'interviewer' ? 'bg-violet-50' : 'bg-white'}`}>
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${line.role === 'interviewer' ? 'bg-violet-200' : 'bg-gray-200'}`}>
                        {line.role === 'interviewer' ? <Bot size={12} className="text-violet-700" /> : <User size={12} className="text-gray-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-500 mb-0.5 capitalize">{line.role}</div>
                        <p className="text-sm text-gray-800">{line.content}</p>
                        {line.timestamp && <p className="text-xs text-gray-400 mt-0.5">{line.timestamp}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info Panel (1/3 width) */}
        <div className="space-y-4">
          {/* Candidate Info */}
          {candidate && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Candidate</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-700 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {candidate.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{candidate.full_name}</div>
                  <div className="text-xs text-gray-400">{candidate.email}</div>
                  {candidate.current_title && <div className="text-xs text-gray-400">{candidate.current_title}</div>}
                </div>
              </div>
              {job && (
                <div className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-600">
                  Applying for: <strong>{job.title}</strong>
                </div>
              )}
            </div>
          )}

          {/* Session Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Session Info</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <StatusBadge status={session.status} small />
              </div>
              {session.scheduled_at && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Scheduled</span>
                  <span>{new Date(session.scheduled_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              )}
              {session.completed_at && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Completed</span>
                  <span>{new Date(session.completed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Mode</span>
                <span className={isMock ? 'text-amber-600' : 'text-green-600'}>
                  {isMock ? '🔶 Demo Mode' : '✅ Live Tavus'}
                </span>
              </div>
            </div>
          </div>

          {/* AI Evaluation Results */}
          {isDone && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Evaluation</h3>

              {/* Score */}
              {session.ai_score !== null && session.ai_score !== undefined && (
                <div className="text-center py-3">
                  <div className={`text-4xl font-black ${
                    session.ai_score >= 75 ? 'text-green-600' :
                    session.ai_score >= 55 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    {session.ai_score}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">AI Score / 100</div>
                  <ScoreBar score={session.ai_score} />
                </div>
              )}

              {/* Recommendation */}
              {session.recommendation && (
                <div className="flex items-center gap-2">
                  <RecommendationIcon rec={session.recommendation} />
                  <span className={`text-sm font-semibold capitalize ${
                    session.recommendation === 'pass' ? 'text-green-700' :
                    session.recommendation === 'fail' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {session.recommendation === 'pass' ? 'Recommend Pass' :
                     session.recommendation === 'fail' ? 'Recommend Reject' : 'Borderline'}
                  </span>
                </div>
              )}

              {/* Evaluation Summary */}
              {session.ai_evaluation && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Summary</p>
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">{session.ai_evaluation}</p>
                </div>
              )}

              {/* Strengths */}
              {session.strengths && session.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-700 mb-1.5">✓ Strengths</p>
                  <ul className="space-y-1">
                    {session.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-green-500 flex-shrink-0 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {session.concerns && session.concerns.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1.5">⚠ Concerns</p>
                  <ul className="space-y-1">
                    {session.concerns.map((c, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-red-400 flex-shrink-0 mt-0.5">•</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadSession}
            className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition"
          >
            <RefreshCw size={12} /> Refresh Status
          </button>
        </div>
      </div>
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

/* ── Helper Components ────────────────────────────────────────────────────── */
function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const map: Record<string, { label: string; cls: string }> = {
    scheduled:   { label: 'Scheduled',   cls: 'bg-amber-100 text-amber-700' },
    in_progress: { label: 'Live',        cls: 'bg-red-100 text-red-700' },
    completed:   { label: 'Completed',   cls: 'bg-green-100 text-green-700' },
    failed:      { label: 'Failed',      cls: 'bg-red-100 text-red-600' },
    cancelled:   { label: 'Cancelled',   cls: 'bg-gray-100 text-gray-500' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`font-medium rounded-full px-2 py-0.5 ${small ? 'text-[10px]' : 'text-xs'} ${s.cls}`}>
      {s.label}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct  = Math.min(100, Math.max(0, score))
  const color = pct >= 75 ? '#16a34a' : pct >= 55 ? '#d97706' : '#dc2626'
  return (
    <div className="mt-2 mx-4 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

function RecommendationIcon({ rec }: { rec: string }) {
  if (rec === 'pass') return <ThumbsUp size={16} className="text-green-600" />
  if (rec === 'fail') return <ThumbsDown size={16} className="text-red-500" />
  return <Minus size={16} className="text-amber-500" />
}
