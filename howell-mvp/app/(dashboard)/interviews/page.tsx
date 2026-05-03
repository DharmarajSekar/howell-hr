'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Calendar, Clock, Video, Users, Star, Bot, CheckCircle, XCircle,
  Zap, Settings, ExternalLink, RefreshCw, ChevronRight, AlertCircle,
  Trophy, ThumbsUp, ThumbsDown, Minus, MessageSquare, Sparkles,
  Loader2, Phone, X,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Interview } from '@/types'
import Link from 'next/link'

/* ── Types ────────────────────────────────────────────────────────────────── */
interface QueueItem {
  id: string
  trigger_score: number
  scheduled_for: string
  status: string
  created_at: string
  application: {
    id: string
    candidate: { full_name: string; email: string; current_title?: string }
    job: { title: string }
  }
  round: { name: string; type: string; round_number: number; score_trigger: number }
}

interface AISession {
  id: string
  status: string
  tavus_conversation_url: string | null
  ai_score: number | null
  recommendation: string | null
  scheduled_at: string | null
  completed_at: string | null
  application: {
    candidate: { full_name: string; email: string; current_title?: string }
    job: { title: string }
  }
  round: { name: string; round_number: number }
}

const CATEGORIES = [
  { key: 'technical',       label: 'Technical Skills'  },
  { key: 'communication',   label: 'Communication'     },
  { key: 'culture_fit',     label: 'Culture Fit'       },
  { key: 'problem_solving', label: 'Problem Solving'   },
]

/* ── Feedback Modal ───────────────────────────────────────────────────────── */
function FeedbackModal({ interview, onClose, onSaved }: {
  interview: Interview
  onClose: () => void
  onSaved: () => void
}) {
  // Parse existing structured feedback
  let existingFeedback: any = {}
  try { existingFeedback = JSON.parse(interview.feedback || '{}') } catch {}

  const [categories,     setCategories]     = useState<Record<string, number>>(existingFeedback.categories || {})
  const [recommendation, setRecommendation] = useState<string>(existingFeedback.recommendation || 'hold')
  const [comments,       setComments]       = useState<string>(existingFeedback.comments || '')
  const [markComplete,   setMarkComplete]   = useState(interview.status !== 'completed')
  const [saving,         setSaving]         = useState(false)
  const [synthesizing,   setSynthesizing]   = useState(false)
  const [aiSummary,      setAiSummary]      = useState<string>(existingFeedback.ai_summary || '')

  function setRating(key: string, val: number) {
    setCategories(c => ({ ...c, [key]: val }))
  }

  const avgRating = (() => {
    const vals = Object.values(categories).filter(v => v > 0)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  })()

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/interviews/${interview.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories,
        recommendation,
        comments,
        interviewer:    'HR Admin',
        overall_rating: avgRating,
        status:         markComplete ? 'completed' : interview.status,
      }),
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleSynthesize() {
    setSynthesizing(true)
    // Save first so the route has the latest feedback
    await fetch(`/api/interviews/${interview.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories, recommendation, comments, interviewer: 'HR Admin', overall_rating: avgRating }),
    })
    const res  = await fetch(`/api/interviews/${interview.id}/synthesize`, { method: 'POST' })
    const data = await res.json()
    setAiSummary(data.summary || '')
    setSynthesizing(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-red-600" />
            <span className="font-bold text-gray-900 text-sm">Interview Feedback</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Candidate info */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <span className="font-semibold text-gray-900">{interview.application?.candidate?.full_name}</span>
            <span className="text-gray-400 mx-2">·</span>
            <span className="text-gray-500">{interview.application?.job?.title}</span>
          </div>

          {/* Category ratings */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Category Ratings</p>
            <div className="space-y-3">
              {CATEGORIES.map(cat => (
                <div key={cat.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 w-36">{cat.label}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(cat.key, n)}
                        className="transition"
                      >
                        <Star
                          size={20}
                          className={n <= (categories[cat.key] || 0)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-200 fill-gray-200 hover:text-amber-300 hover:fill-amber-300'}
                        />
                      </button>
                    ))}
                    <span className="text-xs text-gray-400 ml-1 w-4">
                      {categories[cat.key] ? categories[cat.key] : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {avgRating > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <span>Overall avg:</span>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} size={12}
                      className={n <= avgRating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}/>
                  ))}
                </div>
                <span className="font-semibold text-gray-700">{avgRating}/5</span>
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recommendation</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'proceed', label: 'Proceed',   icon: ThumbsUp,   cls: 'border-green-500 bg-green-50 text-green-700' },
                { value: 'hold',    label: 'Hold',       icon: Minus,      cls: 'border-amber-400 bg-amber-50 text-amber-700' },
                { value: 'reject',  label: 'Reject',     icon: ThumbsDown, cls: 'border-red-400 bg-red-50 text-red-600' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setRecommendation(opt.value)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-semibold transition ${
                    recommendation === opt.value ? opt.cls : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  <opt.icon size={13}/> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Interviewer Notes</p>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Key observations, specific examples, areas for concern or praise…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>

          {/* AI Summary */}
          {(aiSummary || synthesizing) && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} className="text-violet-600"/>
                <span className="text-xs font-semibold text-violet-700">AI-Synthesized Summary</span>
              </div>
              {synthesizing
                ? <p className="text-xs text-violet-500">Generating summary…</p>
                : <p className="text-xs text-violet-800 leading-relaxed">{aiSummary}</p>
              }
            </div>
          )}

          {/* Mark complete toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={markComplete} onChange={e => setMarkComplete(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500"/>
            <span className="text-sm text-gray-700">Mark interview as completed</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={handleSynthesize}
            disabled={synthesizing || (!comments && Object.keys(categories).length === 0)}
            className="flex items-center gap-1.5 text-xs border border-violet-300 text-violet-600 px-3 py-2 rounded-lg hover:bg-violet-50 disabled:opacity-40 transition"
          >
            {synthesizing ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}
            AI Synthesize
          </button>
          <div className="flex-1"/>
          <button onClick={onClose}
            className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-60 transition font-semibold">
            {saving ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle size={13}/>}
            Save Feedback
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [queue,      setQueue]      = useState<QueueItem[]>([])
  const [aiSessions, setAISessions] = useState<AISession[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<'scheduled' | 'ai-queue' | 'ai-sessions' | 'rankings'>('scheduled')
  const [approving,  setApproving]  = useState<string | null>(null)
  const [feedbackIv, setFeedbackIv] = useState<Interview | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ivRes, queueRes, sessRes] = await Promise.all([
        fetch('/api/interviews').then(r => r.json()),
        fetch('/api/interviews/auto-schedule').then(r => r.json()),
        fetch('/api/interviews/ai-sessions').then(r => r.json()),
      ])
      setInterviews(Array.isArray(ivRes) ? ivRes : [])
      setQueue(queueRes.queue || [])
      setAISessions(sessRes.sessions || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleApprove(queueId: string, action: 'approve' | 'reject') {
    setApproving(queueId)
    try {
      const res  = await fetch('/api/interviews/approve-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, action, approvedBy: 'HR Admin' }),
      })
      const data = await res.json()
      if (data.success) await loadAll()
    } finally {
      setApproving(null)
    }
  }

  const upcoming  = interviews.filter(iv => iv.status === 'scheduled')
  const completed = interviews.filter(iv => iv.status === 'completed')

  return (
    <div className="p-8">
      {/* Feedback Modal */}
      {feedbackIv && (
        <FeedbackModal
          interview={feedbackIv}
          onClose={() => setFeedbackIv(null)}
          onSaved={loadAll}
        />
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
          <p className="text-gray-500 text-sm mt-1">
            {upcoming.length} upcoming · {completed.length} completed · {queue.length} awaiting approval · {aiSessions.filter(s => s.status === 'completed' && s.ai_score !== null).length} scored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            <RefreshCw size={12} /> Refresh
          </button>
          <Link href="/settings/interview-config"
            className="flex items-center gap-1.5 text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900">
            <Settings size={12} /> Configure Pipeline
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {[
          { key: 'scheduled',   label: 'Manual Interviews', count: upcoming.length + completed.length },
          { key: 'ai-queue',    label: 'AI Approval Queue', count: queue.length, highlight: queue.length > 0 },
          { key: 'ai-sessions', label: 'AI Sessions',       count: aiSessions.length },
          { key: 'rankings',    label: '🏆 Rankings',       count: aiSessions.filter(s => s.status === 'completed' && s.ai_score !== null).length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                t.highlight ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : (
        <>
          {/* Manual Interviews */}
          {tab === 'scheduled' && (
            <div className="space-y-6">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
                  <div className="space-y-3">
                    {upcoming.map(iv => (
                      <InterviewCard key={iv.id} interview={iv} onFeedback={() => setFeedbackIv(iv)} />
                    ))}
                  </div>
                </section>
              )}
              {completed.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed</h2>
                  <div className="space-y-3">
                    {completed.map(iv => (
                      <InterviewCard key={iv.id} interview={iv} onFeedback={() => setFeedbackIv(iv)} />
                    ))}
                  </div>
                </section>
              )}
              {interviews.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">No interviews scheduled yet.</div>
              )}
            </div>
          )}

          {/* AI Approval Queue */}
          {tab === 'ai-queue' && (
            <div className="space-y-3">
              {queue.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  <Zap size={32} className="mx-auto mb-3 text-gray-300" />
                  <p>No pending approvals.</p>
                  <p className="text-xs mt-1">Auto-scheduled interviews that require HR approval will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start mb-4">
                    <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      These AI interviews were auto-triggered by score thresholds. Review and approve to send the Tavus video interview link to the candidate.
                    </p>
                  </div>
                  {queue.map(item => (
                    <QueueCard key={item.id} item={item}
                      approving={approving === item.id}
                      onApprove={() => handleApprove(item.id, 'approve')}
                      onReject={() => handleApprove(item.id, 'reject')}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {/* AI Sessions */}
          {tab === 'ai-sessions' && (
            <div className="space-y-3">
              {aiSessions.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  <Bot size={32} className="mx-auto mb-3 text-gray-300" />
                  <p>No AI interview sessions yet.</p>
                </div>
              ) : (
                aiSessions.map(s => <AISessionCard key={s.id} session={s} />)
              )}
            </div>
          )}

          {/* Rankings */}
          {tab === 'rankings' && <RankingsView sessions={aiSessions} />}
        </>
      )}
    </div>
  )
}

/* ── Interview Card ───────────────────────────────────────────────────────── */
function InterviewCard({ interview: iv, onFeedback }: { interview: Interview; onFeedback: () => void }) {
  const candidate = iv.application?.candidate
  const job       = iv.application?.job

  // Parse structured feedback
  let feedbackData: any = null
  let hasFeedback = false
  try {
    if (iv.feedback) {
      feedbackData = JSON.parse(iv.feedback)
      hasFeedback  = !!(feedbackData.categories || feedbackData.comments)
    }
  } catch {}

  const typeIcon = iv.interview_type === 'video'     ? <Video size={18}/>
                 : iv.interview_type === 'in_person' ? <Users size={18}/>
                 : <Phone size={18}/>
  const typeBg   = iv.interview_type === 'video'     ? 'bg-blue-50 text-blue-600'
                 : iv.interview_type === 'in_person' ? 'bg-purple-50 text-purple-600'
                 : 'bg-gray-50 text-gray-500'

  return (
    <div className={`bg-white border rounded-xl shadow-sm p-5 ${iv.status === 'completed' ? 'border-gray-100 opacity-90' : 'border-gray-200'}`}>
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${typeBg}`}>{typeIcon}</div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              {candidate && (
                <Link href={`/candidates/${candidate.id}`} className="font-semibold text-gray-900 text-sm hover:text-red-700">
                  {candidate.full_name}
                </Link>
              )}
              <div className="text-xs text-gray-500 mt-0.5">{job?.title}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                iv.status === 'scheduled'  ? 'bg-amber-100 text-amber-700' :
                iv.status === 'completed'  ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-600'
              }`}>
                {iv.status.charAt(0).toUpperCase() + iv.status.slice(1)}
              </span>
              <button
                onClick={onFeedback}
                className="flex items-center gap-1 text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:border-red-300 hover:text-red-600 transition"
              >
                <MessageSquare size={11}/>
                {hasFeedback ? 'Edit Feedback' : 'Add Feedback'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1"><Calendar size={12}/>{formatDateTime(iv.scheduled_at)}</span>
            <span className="flex items-center gap-1"><Clock size={12}/>{iv.duration_minutes} min</span>
          </div>

          {iv.meeting_link && iv.status === 'scheduled' && (
            <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-blue-600 hover:underline">
              Join Meeting →
            </a>
          )}

          {/* Structured feedback display */}
          {hasFeedback && feedbackData && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
              {/* Category stars */}
              {Object.keys(feedbackData.categories || {}).length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.filter(c => feedbackData.categories?.[c.key]).map(cat => (
                    <div key={cat.key} className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">{cat.label}:</span>
                      <div className="flex items-center">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} size={10}
                            className={n <= feedbackData.categories[cat.key]
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-200 fill-gray-200'}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Recommendation badge */}
              {feedbackData.recommendation && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  feedbackData.recommendation === 'proceed' ? 'bg-green-100 text-green-700' :
                  feedbackData.recommendation === 'reject'  ? 'bg-red-100 text-red-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {feedbackData.recommendation === 'proceed' ? <ThumbsUp size={9}/> :
                   feedbackData.recommendation === 'reject'  ? <ThumbsDown size={9}/> : <Minus size={9}/>}
                  {feedbackData.recommendation.charAt(0).toUpperCase() + feedbackData.recommendation.slice(1)}
                </span>
              )}
              {/* Comments */}
              {feedbackData.comments && (
                <p className="text-xs text-gray-600 leading-relaxed">{feedbackData.comments}</p>
              )}
              {/* AI summary */}
              {feedbackData.ai_summary && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-[10px] font-semibold text-violet-600 mb-1 flex items-center gap-1">
                    <Sparkles size={9}/> AI Summary
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">{feedbackData.ai_summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Queue Card ───────────────────────────────────────────────────────────── */
function QueueCard({ item, approving, onApprove, onReject }: {
  item: QueueItem; approving: boolean;
  onApprove: () => void; onReject: () => void
}) {
  return (
    <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-violet-50 rounded-xl flex-shrink-0">
          <Bot size={18} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-gray-900 text-sm">{item.application?.candidate?.full_name}</div>
              <div className="text-xs text-gray-500">{item.application?.job?.title}</div>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className={`text-lg font-black ${item.trigger_score >= 75 ? 'text-green-600' : item.trigger_score >= 55 ? 'text-amber-600' : 'text-red-500'}`}>
                {item.trigger_score}
              </div>
              <div className="text-[10px] text-gray-400">AI Score</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1">
              <span className="text-violet-600 font-medium">Round {item.round?.round_number}:</span> {item.round?.name}
            </span>
            <span className="flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">
              {item.round?.type === 'ai' ? '🤖 AI Interview' : '👤 Manual'}
            </span>
          </div>
          {item.scheduled_for && (
            <div className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
              <Calendar size={11}/> Scheduled for {new Date(item.scheduled_for).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={onApprove} disabled={approving}
              className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
              <CheckCircle size={12} /> {approving ? 'Processing…' : 'Approve & Send'}
            </button>
            <button onClick={onReject} disabled={approving}
              className="flex items-center gap-1.5 text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition">
              <XCircle size={12} /> Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── AI Session Card ──────────────────────────────────────────────────────── */
function AISessionCard({ session: s }: { session: AISession }) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    scheduled:   { label: 'Scheduled',  cls: 'bg-amber-100 text-amber-700' },
    in_progress: { label: 'Live',       cls: 'bg-red-100 text-red-700' },
    completed:   { label: 'Completed',  cls: 'bg-green-100 text-green-700' },
    failed:      { label: 'Failed',     cls: 'bg-red-100 text-red-600' },
    cancelled:   { label: 'Cancelled',  cls: 'bg-gray-100 text-gray-500' },
  }
  const st = statusMap[s.status] || { label: s.status, cls: 'bg-gray-100 text-gray-600' }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-violet-50 rounded-xl flex-shrink-0">
          <Bot size={18} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-gray-900 text-sm">{s.application?.candidate?.full_name}</div>
              <div className="text-xs text-gray-500">{s.application?.job?.title} · {s.round?.name}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {s.ai_score !== null && s.ai_score !== undefined && (
                <div className={`text-sm font-black ${s.ai_score >= 75 ? 'text-green-600' : s.ai_score >= 55 ? 'text-amber-600' : 'text-red-500'}`}>
                  {s.ai_score}
                </div>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-1.5">
            {s.scheduled_at && (
              <span className="flex items-center gap-1">
                <Calendar size={11}/> {new Date(s.scheduled_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
            {s.recommendation && (
              <span className={`capitalize font-medium ${
                s.recommendation === 'pass' ? 'text-green-600' :
                s.recommendation === 'fail' ? 'text-red-500' : 'text-amber-600'
              }`}>
                {s.recommendation === 'pass' ? '✓ Pass' : s.recommendation === 'fail' ? '✗ Reject' : '~ Borderline'}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Link href={`/interview/ai-room?sessionId=${s.id}`}
              className="flex items-center gap-1.5 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition">
              <Video size={12} /> View Session <ChevronRight size={11}/>
            </Link>
            {s.tavus_conversation_url && s.status !== 'completed' && (
              <a href={s.tavus_conversation_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs border border-violet-300 text-violet-600 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition">
                <ExternalLink size={12}/> Join Live
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Rankings View ────────────────────────────────────────────────────────── */
function RankingsView({ sessions }: { sessions: AISession[] }) {
  const scored = sessions.filter(s => s.status === 'completed' && s.ai_score !== null)

  if (scored.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        <Trophy size={32} className="mx-auto mb-3 text-gray-300" />
        <p>No scored interviews yet.</p>
        <p className="text-xs mt-1">Rankings appear once AI interview sessions are completed and scored.</p>
      </div>
    )
  }

  const byJob: Record<string, AISession[]> = {}
  for (const s of scored) {
    const title = s.application?.job?.title || 'Unknown Role'
    if (!byJob[title]) byJob[title] = []
    byJob[title].push(s)
  }
  for (const title of Object.keys(byJob)) {
    byJob[title].sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 bg-violet-50 border border-violet-100 rounded-xl px-5 py-3">
        <Trophy size={18} className="text-violet-600 flex-shrink-0" />
        <p className="text-sm text-violet-700 font-medium">
          {scored.length} candidate{scored.length !== 1 ? 's' : ''} ranked across {Object.keys(byJob).length} role{Object.keys(byJob).length !== 1 ? 's' : ''}
        </p>
        <span className="ml-auto text-xs text-violet-500">Sorted by AI interview score · highest first</span>
      </div>

      {Object.entries(byJob).map(([jobTitle, sessions]) => (
        <section key={jobTitle}>
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{sessions.length}</span>
            {jobTitle}
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">Candidate</th>
                  <th className="px-4 py-3 text-left">Round</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-center">Result</th>
                  <th className="px-4 py-3 text-left">Completed</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map((s, idx) => {
                  const score     = s.ai_score || 0
                  const scoreClr  = score >= 75 ? 'text-green-600' : score >= 55 ? 'text-amber-600' : 'text-red-500'
                  const barClr    = score >= 75 ? 'bg-green-500'  : score >= 55 ? 'bg-amber-400'  : 'bg-red-400'
                  const rankBadge = idx === 0 ? 'bg-amber-400 text-white'
                                  : idx === 1 ? 'bg-gray-300 text-gray-700'
                                  : idx === 2 ? 'bg-orange-300 text-white'
                                  : 'bg-gray-100 text-gray-500'
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 transition ${idx === 0 ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] font-black ${rankBadge}`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {s.application?.candidate?.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-xs">{s.application?.candidate?.full_name}</div>
                            <div className="text-[10px] text-gray-400">{s.application?.candidate?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs text-gray-500">{s.round?.name || 'AI Round'}</span></td>
                      <td className="px-4 py-3 text-center">
                        <div className={`text-lg font-black ${scoreClr}`}>{score}</div>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${barClr}`} style={{ width: `${score}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.recommendation === 'pass' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <ThumbsUp size={10}/> Pass
                          </span>
                        ) : s.recommendation === 'fail' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            <ThumbsDown size={10}/> Reject
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Minus size={10}/> Borderline
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">
                          {s.completed_at ? new Date(s.completed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/interview/ai-room?sessionId=${s.id}`}
                          className="text-xs text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1 justify-end">
                          View <ChevronRight size={12}/>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
