'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Video, Play, CheckCircle, Clock, Star, Search, RefreshCw,
  User, Loader2, ExternalLink, Copy, ChevronDown, ChevronUp
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

export default function RecordingsPage() {
  const [sessions,  setSessions]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [playing,   setPlaying]   = useState<any>(null)
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/pre-screen', { cache: 'no-store' })
      const data = await res.json()
      setSessions(data || [])
    } catch { setSessions([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = sessions.filter((s: any) => {
    const q = search.toLowerCase()
    return !q || s.candidate_name?.toLowerCase().includes(q) || s.job_title?.toLowerCase().includes(q)
  })

  // Separate video sessions (have video_recordings) from text-only
  const videoSessions = filtered.filter((s: any) => s.status === 'completed')
  const pending       = filtered.filter((s: any) => s.status !== 'completed')

  function copyLink(session: any) {
    const url = `${window.location.origin}/video-prescreen/${session.id}`
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pre-Screen Recordings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review video responses from shortlisted candidates</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Sessions', value: sessions.length, color: 'text-gray-800' },
          { label: 'Videos Completed', value: videoSessions.length, color: 'text-green-700' },
          { label: 'Awaiting Response', value: pending.length, color: 'text-yellow-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by candidate name or role…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
      </div>

      {loading ? (
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
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold flex-shrink-0">
                    {s.candidate_name?.charAt(0) || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{s.candidate_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                        {s.status}
                      </span>
                      {hasVideo && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium flex items-center gap-1">
                          <Video size={10}/> Video recorded
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">{s.job_title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {s.completed_at
                        ? `Completed ${new Date(s.completed_at).toLocaleDateString('en-IN')}`
                        : `Created ${new Date(s.created_at).toLocaleDateString('en-IN')}`}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right mr-4">
                    <ScoreBadge score={s.ai_score}/>
                    <div className="text-xs text-gray-400">AI Score</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {s.status === 'pending' || s.status === 'in_progress' ? (
                      <button onClick={() => copyLink(s)}
                        title="Copy video pre-screen link"
                        className="flex items-center gap-1.5 text-xs text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition font-medium">
                        <Copy size={12}/> Copy Video Link
                      </button>
                    ) : (
                      <button onClick={() => setPlaying(s)}
                        className="flex items-center gap-1.5 text-xs text-white bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded-lg transition font-medium">
                        <Play size={12}/> Review
                      </button>
                    )}
                    <button onClick={() => setExpanded(isExpanded ? null : s.id)}
                      className="text-gray-400 hover:text-gray-600 p-1">
                      {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 text-sm text-gray-600 space-y-2">
                    {s.ai_evaluation && (
                      <div>
                        <span className="font-semibold text-gray-700">AI Evaluation: </span>
                        {s.ai_evaluation}
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500">Video pre-screen link:</span>
                      <a href={`/video-prescreen/${s.id}`} target="_blank" rel="noreferrer"
                        className="text-red-600 hover:underline flex items-center gap-1">
                        /video-prescreen/{s.id} <ExternalLink size={11}/>
                      </a>
                    </div>
                    {(s.video_recordings || []).length > 0 && (
                      <div>
                        <span className="font-semibold text-gray-700">Recordings ({s.video_recordings.length}):</span>
                        <div className="mt-1 space-y-1">
                          {s.video_recordings.map((r: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-500 bg-white rounded px-2 py-1 border border-gray-100">
                              <Video size={10} className="text-red-400"/>
                              <span>Q{i+1}: {r.question?.slice(0,60)}…</span>
                              <span className="ml-auto">{r.duration_secs}s</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Video player modal */}
      {playing && <VideoPlayerModal session={playing} onClose={() => setPlaying(null)}/>}
    </div>
  )
}
