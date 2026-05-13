'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Video, Play, CheckCircle, Clock, Star, Search, RefreshCw,
  User, Loader2, ExternalLink, Copy, ChevronDown, ChevronUp,
  Bot, ThumbsUp, ThumbsDown, Minus, FileText, MessageSquare
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  completed:   'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  pending:     'bg-gray-100 text-gray-600',
}

const SCORE_COLOR = (s: number) =>
  s >= 80 ? 'text-green-600' : s >= 60 ? 'text-yellow-600' : 'text-red-500'

function ScoreBadge({ score }: { score: number | null }) {
  if (!score) return <span className="text-xs text-gray-400">—</span>
  return (
    <span className={`text-lg font-bold ${SCORE_COLOR(score)}`}>
      {score}<span className="text-xs font-normal text-gray-400">/100</span>
    </span>
  )
}

function VideoPlayerModal({ session, onClose }: { session: any; onClose: () => void }) {
  const [currentQ, setCurrentQ] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const recordings: any[] = session.video_recordings || []
  const current = recordings[currentQ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">{session.candidate_name}</h2>
            <p className="text-sm text-gray-400">{session.job_title} · Video Pre-Screen Recordings</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl font-bold">×</button>
        </div>

        <div className="flex">
          {/* Video area */}
          <div className="flex-1 p-5">
            {recordings.length === 0 ? (
              <div className="aspect-video bg-gray-800 rounded-xl flex flex-col items-center justify-center">
                <Video size={40} className="text-gray-500 mb-3"/>
                <p className="text-sm text-gray-400">No video recordings stored for this session.</p>
                <p className="text-xs text-gray-500 mt-1">Videos are recorded in the browser and metadata is logged here.</p>
              </div>
            ) : current?.storage_path ? (
              <div className="aspect-video bg-gray-800 rounded-xl flex flex-col items-center justify-center p-6">
                <Video size={36} className="text-gray-500 mb-3"/>
                <p className="text-sm text-gray-300 font-medium mb-1">Recording Q{currentQ + 1}</p>
                <p className="text-xs text-gray-500 font-mono bg-gray-700 px-3 py-1.5 rounded">{current.storage_path}</p>
                <p className="text-xs text-gray-500 mt-3 text-center max-w-xs">
                  In production, videos are uploaded to Supabase Storage and stream here.<br/>
                  Duration: {current.duration_secs}s
                </p>
              </div>
            ) : (
              <div className="aspect-video bg-gray-800 rounded-xl flex items-center justify-center">
                <p className="text-gray-500 text-sm">No playback available</p>
              </div>
            )}

            {/* AI Evaluation */}
            {session.ai_evaluation && (
              <div className="mt-4 bg-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={14} className="text-yellow-400"/>
                  <span className="text-xs font-semibold text-gray-300 uppercase">AI Evaluation</span>
                  {session.ai_score && (
                    <span className={`ml-auto text-sm font-bold ${SCORE_COLOR(session.ai_score)}`}>{session.ai_score}/100</span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{session.ai_evaluation}</p>
              </div>
            )}
          </div>

          {/* Question list */}
          <div className="w-64 border-l border-gray-700 overflow-y-auto">
            <div className="p-3 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-400 uppercase">Questions</span>
            </div>
            {recordings.length > 0 ? recordings.map((r: any, i: number) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                className={`w-full text-left p-3 border-b border-gray-800 text-sm transition ${
                  i === currentQ ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Video size={12} className="flex-shrink-0 text-red-400"/>
                  <span className="font-medium">Q{i + 1}</span>
                  <span className="ml-auto text-xs text-gray-500">{r.duration_secs}s</span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{r.question}</p>
              </button>
            )) : (
              <div className="p-4 text-xs text-gray-500 text-center">No question data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── AI Interview Session Detail Modal ─────────────────────────────────────── */
function AISessionModal({ session, onClose }: { session: any; onClose: () => void }) {
  const [showTx, setShowTx] = useState(false)

  const recColor = {
    pass:  'bg-green-50 text-green-700 border-green-200',
    fail:  'bg-red-50 text-red-600 border-red-200',
    maybe: 'bg-amber-50 text-amber-700 border-amber-200',
  }[session.recommendation as string] ?? 'bg-gray-50 text-gray-600 border-gray-200'

  const recLabel = {
    pass:  'Strong Hire / Hire',
    fail:  'Reject',
    maybe: 'Consider',
  }[session.recommendation as string] ?? session.recommendation ?? '—'

  const recIcon = session.recommendation === 'pass'
    ? <ThumbsUp size={15} />
    : session.recommendation === 'fail'
      ? <ThumbsDown size={15} />
      : <Minus size={15} />

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <Bot size={18} className="text-violet-600" /> {session.candidate_name}
            </h2>
            <p className="text-sm text-gray-500">{session.job_title} · AI Interview Results</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Score + Recommendation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">AI Score</p>
              <div className={`text-5xl font-black ${SCORE_COLOR(session.ai_score ?? 0)}`}>
                {session.ai_score ?? '—'}
              </div>
              <div className="text-xs text-gray-400">/ 100</div>
              {session.ai_score && (
                <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${session.ai_score >= 75 ? 'bg-green-500' : session.ai_score >= 55 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${session.ai_score}%` }}
                  />
                </div>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recommendation</p>
              <div className={`inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg border ${recColor}`}>
                {recIcon} {recLabel}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Completed {session.completed_at ? new Date(session.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>

          {/* Recording Video */}
          {session.recording_url ? (
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-700">
                <Video size={13} className="text-gray-400"/>
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Interview Recording</span>
              </div>
              <div className="p-3">
                <video
                  src={session.recording_url}
                  controls
                  className="w-full rounded-lg"
                  style={{ maxHeight: '280px' }}
                >
                  Your browser does not support video playback.
                </video>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-5 flex items-center gap-3">
              <Video size={20} className="text-gray-300 flex-shrink-0"/>
              <div>
                <p className="text-sm text-gray-500 font-medium">No recording available</p>
                <p className="text-xs text-gray-400 mt-0.5">Recording will appear here once the candidate completes the interview with video enabled.</p>
              </div>
            </div>
          )}

          {/* AI Evaluation Summary */}
          {session.ai_summary && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Star size={12} /> AI Evaluation Summary
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{session.ai_summary}</p>
            </div>
          )}

          {/* Transcript */}
          {session.transcript?.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTx(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2"><MessageSquare size={14} /> Transcript ({session.transcript.length} entries)</span>
                {showTx ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showTx && (
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {session.transcript.map((line: any, i: number) => (
                    <div key={i} className={`px-4 py-3 flex gap-3 ${line.role === 'interviewer' ? 'bg-violet-50' : 'bg-white'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${line.role === 'interviewer' ? 'bg-violet-200' : 'bg-gray-200'}`}>
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
      </div>
    </div>
  )
}

export default function RecordingsPage() {
  const [sessions,    setSessions]    = useState<any[]>([])
  const [aiSessions,  setAiSessions]  = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [aiLoading,   setAiLoading]   = useState(true)
  const [search,      setSearch]      = useState('')
  const [playing,     setPlaying]     = useState<any>(null)
  const [aiViewing,   setAiViewing]   = useState<any>(null)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [activeTab,   setActiveTab]   = useState<'video' | 'ai'>('ai')

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/pre-screen', { cache: 'no-store' })
      const data = await res.json()
      setSessions(data || [])
    } catch { setSessions([]) }
    setLoading(false)
  }

  const loadAI = async () => {
    setAiLoading(true)
    try {
      const res  = await fetch('/api/interviews/completed-sessions', { cache: 'no-store' })
      const data = await res.json()
      setAiSessions(data.sessions || [])
    } catch { setAiSessions([]) }
    setAiLoading(false)
  }

  useEffect(() => { load(); loadAI() }, [])

  const filtered = sessions.filter((s: any) => {
    const q = search.toLowerCase()
    return !q || s.candidate_name?.toLowerCase().includes(q) || s.job_title?.toLowerCase().includes(q)
  })
  const filteredAI = aiSessions.filter((s: any) => {
    const q = search.toLowerCase()
    return !q || s.candidate_name?.toLowerCase().includes(q) || s.job_title?.toLowerCase().includes(q)
  })

  const videoSessions = filtered.filter((s: any) => s.status === 'completed')
  const pending       = filtered.filter((s: any) => s.status !== 'completed')

  function copyLink(session: any) {
    const url = `${window.location.origin}/video-prescreen/${session.id}`
    navigator.clipboard.writeText(url)
  }

  const recLabel = (rec: string) => ({ pass: 'Hire', fail: 'Reject', maybe: 'Consider' }[rec] ?? rec ?? '—')
  const recClass = (rec: string) => ({
    pass:  'bg-green-100 text-green-700',
    fail:  'bg-red-100 text-red-600',
    maybe: 'bg-amber-100 text-amber-700',
  }[rec] ?? 'bg-gray-100 text-gray-600')

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interview Recordings & Results</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review video responses and AI interview scores</p>
        </div>
        <button onClick={() => { load(); loadAI() }} disabled={loading || aiLoading}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
          <RefreshCw size={14} className={(loading || aiLoading) ? 'animate-spin' : ''}/> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'AI Interviews Done', value: aiSessions.length, color: 'text-violet-700' },
          { label: 'Avg AI Score', value: aiSessions.length ? Math.round(aiSessions.reduce((a: number, s: any) => a + (s.ai_score || 0), 0) / aiSessions.length) + '/100' : '—', color: 'text-gray-800' },
          { label: 'Video Pre-Screens', value: videoSessions.length, color: 'text-green-700' },
          { label: 'Awaiting Response', value: pending.length, color: 'text-yellow-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'ai' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Bot size={14} /> AI Interview Results {aiSessions.length > 0 && <span className="bg-violet-100 text-violet-700 text-xs px-1.5 rounded-full">{aiSessions.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'video' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Video size={14} /> Video Pre-Screens {sessions.length > 0 && <span className="bg-red-100 text-red-700 text-xs px-1.5 rounded-full">{sessions.length}</span>}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by candidate name or role…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"/>
      </div>

      {/* ── AI Interview Results Tab ── */}
      {activeTab === 'ai' && (
        aiLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-violet-600 mr-3"/>
            <span className="text-gray-500 text-sm">Loading AI interview results…</span>
          </div>
        ) : filteredAI.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
            <Bot size={40} className="mx-auto text-gray-300 mb-3"/>
            <p className="text-gray-400 font-medium">No AI interview results yet.</p>
            <p className="text-sm text-gray-400 mt-1">Once candidates complete an AI interview, their scores and evaluation will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAI.map((s: any) => (
              <div key={s.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold flex-shrink-0">
                  {s.candidate_name?.charAt(0) || '?'}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{s.candidate_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium flex items-center gap-1">
                      <Bot size={10}/> AI Interview
                    </span>
                    {s.recommendation && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${recClass(s.recommendation)}`}>
                        {recLabel(s.recommendation)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{s.job_title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.completed_at ? `Completed ${new Date(s.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'In progress'}
                  </div>
                </div>
                {/* Score */}
                <div className="text-right mr-4">
                  <ScoreBadge score={s.ai_score}/>
                  <div className="text-xs text-gray-400">AI Score</div>
                </div>
                {/* Action */}
                <button
                  onClick={() => setAiViewing(s)}
                  className="flex items-center gap-1.5 text-xs text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition font-medium"
                >
                  <FileText size={12}/> Review
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Video Pre-Screens Tab ── */}
      {activeTab === 'video' && (
        loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-red-700 mr-3"/>
            <span className="text-gray-500 text-sm">Loading sessions…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
            <Video size={40} className="mx-auto text-gray-300 mb-3"/>
            <p className="text-gray-400">No pre-screen sessions yet.</p>
            <p className="text-sm text-gray-400 mt-1">Start a pre-screen session from the Pre-Screen Bot page, then share the video link with the candidate.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s: any) => {
              const hasVideo   = (s.video_recordings || []).length > 0
              const isExpanded = expanded === s.id
              return (
                <div key={s.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold flex-shrink-0">
                      {s.candidate_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{s.candidate_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                        {hasVideo && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium flex items-center gap-1">
                            <Video size={10}/> Video recorded
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">{s.job_title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {s.completed_at ? `Completed ${new Date(s.completed_at).toLocaleDateString('en-IN')}` : `Created ${new Date(s.created_at).toLocaleDateString('en-IN')}`}
                      </div>
                    </div>
                    <div className="text-right mr-4">
                      <ScoreBadge score={s.ai_score}/>
                      <div className="text-xs text-gray-400">AI Score</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status === 'pending' || s.status === 'in_progress' ? (
                        <button onClick={() => copyLink(s)}
                          className="flex items-center gap-1.5 text-xs text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition font-medium">
                          <Copy size={12}/> Copy Link
                        </button>
                      ) : (
                        <button onClick={() => setPlaying(s)}
                          className="flex items-center gap-1.5 text-xs text-white bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded-lg transition font-medium">
                          <Play size={12}/> Review
                        </button>
                      )}
                      <button onClick={() => setExpanded(isExpanded ? null : s.id)} className="text-gray-400 hover:text-gray-600 p-1">
                        {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 text-sm text-gray-600 space-y-2">
                      {s.ai_evaluation && <div><span className="font-semibold text-gray-700">AI Evaluation: </span>{s.ai_evaluation}</div>}
                      <div className="flex items-center gap-4">
                        <span className="text-gray-500">Video pre-screen link:</span>
                        <a href={`/video-prescreen/${s.id}`} target="_blank" rel="noreferrer" className="text-red-600 hover:underline flex items-center gap-1">
                          /video-prescreen/{s.id} <ExternalLink size={11}/>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Modals */}
      {playing   && <VideoPlayerModal session={playing}   onClose={() => setPlaying(null)}/>}
      {aiViewing && <AISessionModal   session={aiViewing} onClose={() => setAiViewing(null)}/>}
    </div>
  )
}
