'use client'

/**
 * AI Interview Room — HR View
 * ============================
 * HR uses this page to:
 *  1. Select an application and round
 *  2. Click "Generate AI Interview Link"
 *     → Calls /api/interviews/create-ai-session
 *     → Daily.co room is created + Pipecat bot is started
 *     → A shareable candidate link is returned
 *  3. Copy the link and send it to the candidate via email / WhatsApp
 *
 * For manual/panel rounds, the same page lets HR create a standard
 * Daily.co meeting link (no AI bot) via /api/interviews/create-manual-session.
 *
 * URL params read client-side to avoid Next.js 14 prerender issues.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Bot, Users, Copy, ExternalLink, CheckCircle, AlertCircle,
  Clock, Zap, ArrowLeft, RefreshCw, ChevronRight, Star,
  Trophy, MessageSquare, BarChart2, Link2, Video
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Application {
  id: string
  candidate_name: string
  job_title: string
  current_stage: string
}

interface InterviewRound {
  id: string
  round_number: number
  name: string
  type: 'ai' | 'manual' | 'panel'
  duration_minutes: number
  ai_questions: string[]
}

interface SessionResult {
  overall_score: number
  recommendation: string
  summary: string
  communication_score: number
  technical_score: number
  cultural_fit_score: number
  strengths: string[]
  areas_for_improvement: string[]
  question_evaluations: Array<{ question: string; score: number; notes: string }>
}

interface Session {
  id?: string
  application_id: string
  round_id: string
  daily_room_url: string
  status: 'pending' | 'active' | 'completed' | 'scheduled'
  type: string
  created_at: string
  completed_at?: string
  candidate_link?: string
  result?: SessionResult
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════

export default function AIInterviewRoomPage() {
  // URL params read client-side
  const [preselectedAppId,   setPreselectedAppId]   = useState<string | null>(null)
  const [preselectedRoundId, setPreselectedRoundId] = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setPreselectedAppId(p.get('applicationId'))
    setPreselectedRoundId(p.get('roundId'))
  }, [])

  // ── Data ───────────────────────────────────────────────────────────────────
  const [applications, setApplications] = useState<Application[]>([])
  const [rounds,       setRounds]       = useState<InterviewRound[]>([])
  const [sessions,     setSessions]     = useState<Session[]>([])

  const [selectedApp,   setSelectedApp]   = useState('')
  const [selectedRound, setSelectedRound] = useState('')

  // ── Loading / feedback states ──────────────────────────────────────────────
  const [loadingApps,     setLoadingApps]     = useState(true)
  const [loadingRounds,   setLoadingRounds]   = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [generating,      setGenerating]      = useState(false)
  const [error,           setError]           = useState('')

  // ── Generated link ─────────────────────────────────────────────────────────
  const [candidateLink, setCandidateLink]   = useState('')
  const [linkCopied,    setLinkCopied]      = useState(false)
  const [activeSession, setActiveSession]   = useState<Session | null>(null)

  // ── View ───────────────────────────────────────────────────────────────────
  const [view, setView] = useState<'create' | 'result'>('create')
  const [viewingResult, setViewingResult] = useState<Session | null>(null)

  // ── Load applications ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingApps(true)
    fetch('/api/applications?stage=interview&limit=50')
      .then(r => r.json())
      .then(d => {
        const list: Application[] = Array.isArray(d) ? d : (d.applications || [])
        setApplications(list)
        // Auto-select from URL param or first in list
        if (preselectedAppId && list.some(a => a.id === preselectedAppId)) {
          setSelectedApp(preselectedAppId)
        } else if (list.length > 0 && !selectedApp) {
          setSelectedApp(list[0].id)
        }
      })
      .catch(() => setError('Failed to load applications'))
      .finally(() => setLoadingApps(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedAppId])

  // ── Load rounds when application changes ──────────────────────────────────
  const loadRounds = useCallback(async (applicationId: string) => {
    if (!applicationId) return
    setLoadingRounds(true)
    setRounds([])
    setSelectedRound('')
    try {
      const app = applications.find(a => a.id === applicationId)
      if (!app) return
      // Fetch round config for this job
      const jobRes = await fetch(`/api/applications/${applicationId}`)
      const jobData = await jobRes.json()
      const jobId = jobData?.job_id || jobData?.application?.job_id
      if (!jobId) return

      const res = await fetch(`/api/interviews/config?jobId=${jobId}`)
      const data = await res.json()
      const roundList: InterviewRound[] = data.rounds || []
      setRounds(roundList)

      if (preselectedRoundId && roundList.some(r => r.id === preselectedRoundId)) {
        setSelectedRound(preselectedRoundId)
      } else if (roundList.length > 0) {
        setSelectedRound(roundList[0].id)
      }
    } finally {
      setLoadingRounds(false)
    }
  }, [applications, preselectedRoundId])

  useEffect(() => {
    if (selectedApp && applications.length > 0) loadRounds(selectedApp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp, applications])

  // ── Load existing sessions ─────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!selectedApp) return
    setLoadingSessions(true)
    try {
      const res = await fetch(`/api/interviews/ai-sessions?applicationId=${selectedApp}`)
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : (data.sessions || []))
    } catch {
      /* silent */
    } finally {
      setLoadingSessions(false)
    }
  }, [selectedApp])

  useEffect(() => { loadSessions() }, [loadSessions])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const selectedRoundObj  = rounds.find(r => r.id === selectedRound)
  const selectedAppObj    = applications.find(a => a.id === selectedApp)
  const isAiRound         = selectedRoundObj?.type === 'ai'

  // ── Generate AI interview link ─────────────────────────────────────────────
  async function generateAiLink() {
    if (!selectedApp || !selectedRound || !selectedRoundObj || !selectedAppObj) return
    setGenerating(true)
    setError('')
    setCandidateLink('')
    setActiveSession(null)

    try {
      const res = await fetch('/api/interviews/create-ai-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId:  selectedApp,
          roundId:        selectedRound,
          candidateName:  selectedAppObj.candidate_name,
          jobTitle:       selectedAppObj.job_title,
          questions:      selectedRoundObj.ai_questions || [],
          durationMinutes: selectedRoundObj.duration_minutes || 60,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.candidateLink) {
        throw new Error(data.error || 'Failed to generate interview link')
      }

      setCandidateLink(data.candidateLink)
      setActiveSession({
        application_id: selectedApp,
        round_id:       selectedRound,
        daily_room_url: data.roomUrl,
        status:         'pending',
        type:           'ai_pipecat',
        created_at:     new Date().toISOString(),
        candidate_link: data.candidateLink,
      })

      // Refresh session list
      loadSessions()

    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Generate manual meeting link ───────────────────────────────────────────
  async function generateManualLink() {
    if (!selectedApp || !selectedRound || !selectedRoundObj) return
    setGenerating(true)
    setError('')
    setCandidateLink('')

    try {
      const res = await fetch('/api/interviews/create-manual-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId:    selectedApp,
          roundId:          selectedRound,
          roundType:        selectedRoundObj.type,
          interviewerEmails: [],
          scheduledAt:      new Date().toISOString(),
          durationMinutes:  selectedRoundObj.duration_minutes || 60,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.meetingLink) throw new Error(data.error || 'Failed to generate meeting link')

      setCandidateLink(data.meetingLink)
      setActiveSession({
        application_id: selectedApp,
        round_id:       selectedRound,
        daily_room_url: data.meetingLink,
        status:         'scheduled',
        type:           selectedRoundObj.type,
        created_at:     new Date().toISOString(),
        candidate_link: data.meetingLink,
      })
      loadSessions()

    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  // ── Score colours ──────────────────────────────────────────────────────────
  function scoreColor(score: number, max = 100) {
    const pct = (score / max) * 100
    if (pct >= 75) return 'text-green-400'
    if (pct >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  function recommendationLabel(r: string) {
    switch (r) {
      case 'strong_hire': return { label: 'Strong Hire', color: 'bg-green-500/20 text-green-400' }
      case 'hire':        return { label: 'Hire',        color: 'bg-blue-500/20 text-blue-400'  }
      case 'maybe':       return { label: 'Maybe',       color: 'bg-yellow-500/20 text-yellow-400' }
      case 'no_hire':     return { label: 'No Hire',     color: 'bg-red-500/20 text-red-400' }
      default:            return { label: r,              color: 'bg-gray-500/20 text-gray-400'  }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Render — Result Detail View
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'result' && viewingResult?.result) {
    const r = viewingResult.result
    const rec = recommendationLabel(r.recommendation)
    const app = applications.find(a => a.id === viewingResult.application_id)

    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setView('create')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Sessions
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold">Interview Result</h1>
            <p className="text-gray-400 mt-1">{app?.candidate_name} · {app?.job_title}</p>
          </div>

          {/* Score overview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className={`text-5xl font-black mb-1 ${scoreColor(r.overall_score)}`}>{r.overall_score}</div>
              <div className="text-gray-400 text-sm">Overall Score / 100</div>
              <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-medium ${rec.color}`}>
                <Trophy className="w-3 h-3" /> {rec.label}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              {[
                { label: 'Communication', score: r.communication_score, max: 10 },
                { label: 'Technical',     score: r.technical_score,     max: 10 },
                { label: 'Culture Fit',   score: r.cultural_fit_score,  max: 10 },
              ].map(({ label, score, max }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{label}</span>
                    <span className={scoreColor(score, max)}>{score}/{max}</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${scoreColor(score, max).replace('text-', 'bg-')}`} style={{ width: `${(score / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-300">
              <MessageSquare className="w-4 h-4" /> Summary
            </div>
            <p className="text-gray-300 leading-relaxed">{r.summary}</p>
          </div>

          {/* Strengths / Areas */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Strengths
              </div>
              <ul className="space-y-1.5">
                {r.strengths.map((s, i) => <li key={i} className="text-gray-300 text-sm flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span>{s}</li>)}
              </ul>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Areas to Improve
              </div>
              <ul className="space-y-1.5">
                {r.areas_for_improvement.map((a, i) => <li key={i} className="text-gray-300 text-sm flex items-start gap-2"><span className="text-yellow-500 mt-0.5">•</span>{a}</li>)}
              </ul>
            </div>
          </div>

          {/* Per-question breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> Question Breakdown
            </div>
            <div className="space-y-4">
              {r.question_evaluations.map((q, i) => (
                <div key={i} className="border-t border-gray-800 pt-4 first:border-0 first:pt-0">
                  <div className="flex items-start justify-between gap-4 mb-1.5">
                    <p className="text-gray-300 text-sm font-medium">{q.question}</p>
                    <span className={`text-sm font-bold shrink-0 ${scoreColor(q.score, 10)}`}>{q.score}/10</span>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">{q.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Render — Main Create / Manage View
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">

        {/* Page header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/interview" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-purple-400" /> AI Interview Room
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">Generate a Pipecat-powered AI interview link and share it with your candidate</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-6">

          {/* ── Left: Create session ────────────────────────────────────────── */}
          <div className="col-span-3 space-y-5">

            {/* Application selector */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Select Candidate
              </label>
              {loadingApps ? (
                <div className="h-10 bg-gray-800 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={selectedApp}
                  onChange={e => { setSelectedApp(e.target.value); setCandidateLink(''); setActiveSession(null) }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">— Choose an application —</option>
                  {applications.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.candidate_name} · {a.job_title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Round selector */}
            {selectedApp && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Select Interview Round
                </label>
                {loadingRounds ? (
                  <div className="h-10 bg-gray-800 rounded-lg animate-pulse" />
                ) : rounds.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No rounds configured.{' '}
                    <Link href="/settings/interview-config" className="text-purple-400 hover:underline">
                      Configure interview pipeline →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rounds.map(r => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedRound(r.id); setCandidateLink(''); setActiveSession(null) }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-sm ${
                          selectedRound === r.id
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {r.type === 'ai'
                            ? <Bot className="w-4 h-4 text-purple-400" />
                            : <Users className="w-4 h-4 text-blue-400" />
                          }
                          <div className="text-left">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-gray-400 capitalize">{r.type} · {r.duration_minutes} min</div>
                          </div>
                        </div>
                        <div className={`text-xs px-2 py-0.5 rounded-full ${
                          r.type === 'ai'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {r.type === 'ai' ? 'Pipecat AI' : r.type === 'panel' ? 'Panel' : 'Manual'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Generate button */}
            {selectedApp && selectedRound && (
              <button
                onClick={isAiRound ? generateAiLink : generateManualLink}
                disabled={generating}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  generating
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : isAiRound
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
                }`}
              >
                {generating ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> {isAiRound ? 'Starting Pipecat bot…' : 'Creating meeting room…'}</>
                ) : (
                  <>{isAiRound ? <><Zap className="w-4 h-4" /> Generate AI Interview Link</> : <><Video className="w-4 h-4" /> Create Meeting Link</>}</>
                )}
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Generated link box */}
            {candidateLink && (
              <div className="bg-gray-900 border border-green-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 text-green-400 text-sm font-semibold mb-3">
                  <CheckCircle className="w-4 h-4" />
                  {isAiRound ? 'AI interview ready — Pipecat bot is waiting in the room' : 'Meeting room created'}
                </div>

                <label className="block text-xs text-gray-500 mb-1.5">Candidate Link (share this)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono truncate">
                    {candidateLink}
                  </div>
                  <button
                    onClick={() => copyLink(candidateLink)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      linkCopied
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {linkCopied ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                  <a
                    href={candidateLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-all"
                    title="Open in new tab (preview)"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {isAiRound && (
                  <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                    The Pipecat bot (Alex) is already in the room. The candidate joins this link, sees the Simli avatar, and the interview begins automatically. Results are posted back to the HRMS when complete.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Past sessions ────────────────────────────────────────── */}
          <div className="col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Sessions
                </h2>
                <button onClick={loadSessions} className="text-gray-500 hover:text-white transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingSessions ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />)}
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-sm">
                  <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No sessions yet
                </div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {sessions.map((s, i) => {
                    const rec = s.result ? recommendationLabel(s.result.recommendation) : null
                    return (
                      <div
                        key={i}
                        className="border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {s.type === 'ai_pipecat'
                              ? <Bot className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              : <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            }
                            <span className="text-xs text-gray-300 font-medium capitalize">
                              {s.type === 'ai_pipecat' ? 'AI (Pipecat)' : s.type}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.status === 'completed' ? 'bg-green-500/20 text-green-400'
                            : s.status === 'pending'  ? 'bg-yellow-500/20 text-yellow-400'
                            : s.status === 'active'   ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                            : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {s.status}
                          </span>
                        </div>

                        {s.result && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`text-sm font-bold ${scoreColor(s.result.overall_score)}`}>
                              {s.result.overall_score}/100
                            </div>
                            {rec && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${rec.color}`}>
                                {rec.label}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {s.candidate_link && (
                            <button
                              onClick={() => copyLink(s.candidate_link!)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                            >
                              <Copy className="w-3 h-3" /> Copy link
                            </button>
                          )}
                          {s.result && (
                            <button
                              onClick={() => { setViewingResult(s); setView('result') }}
                              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors ml-auto"
                            >
                              View result <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="text-xs text-gray-600 mt-1.5">
                          {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
