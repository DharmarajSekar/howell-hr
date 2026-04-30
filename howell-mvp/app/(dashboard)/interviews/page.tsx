'use client'
import { useEffect, useState, useCallback } from 'react'
import { Calendar, Clock, Video, Users, Star, Bot, CheckCircle, XCircle, Zap, Settings, ExternalLink, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Interview } from '@/types'
import Link from 'next/link'

/* ── Auto-queue item type ─────────────────────────────────────────────────── */
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
    candidate: { full_name: string; email: string }
    job: { title: string }
  }
  round: { name: string; round_number: number }
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [queue, setQueue]           = useState<QueueItem[]>([])
  const [aiSessions, setAISessions] = useState<AISession[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'scheduled' | 'ai-queue' | 'ai-sessions'>('scheduled')
  const [approving, setApproving]   = useState<string | null>(null)

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
      const res = await fetch('/api/interviews/approve-queue', {
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
          <p className="text-gray-500 text-sm mt-1">
            {upcoming.length} upcoming · {completed.length} completed · {queue.length} awaiting approval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            <RefreshCw size={12} /> Refresh
          </button>
          <Link
            href="/settings/interview-config"
            className="flex items-center gap-1.5 text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900"
          >
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
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                t.highlight ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : (
        <>
          {/* Manual Interviews Tab */}
          {tab === 'scheduled' && (
            <div className="space-y-6">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
                  <div className="space-y-3">
                    {upcoming.map(iv => <InterviewCard key={iv.id} interview={iv} />)}
                  </div>
                </section>
              )}
              {completed.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed</h2>
                  <div className="space-y-3">
                    {completed.map(iv => <InterviewCard key={iv.id} interview={iv} />)}
                  </div>
                </section>
              )}
              {interviews.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">No interviews scheduled yet.</div>
              )}
            </div>
          )}

          {/* AI Approval Queue Tab */}
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
                    <QueueCard
                      key={item.id}
                      item={item}
                      approving={approving === item.id}
                      onApprove={() => handleApprove(item.id, 'approve')}
                      onReject={() => handleApprove(item.id, 'reject')}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {/* AI Sessions Tab */}
          {tab === 'ai-sessions' && (
            <div className="space-y-3">
              {aiSessions.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  <Bot size={32} className="mx-auto mb-3 text-gray-300" />
                  <p>No AI interview sessions yet.</p>
                  <p className="text-xs mt-1">AI sessions will appear here once interviews are scheduled and approved.</p>
                </div>
              ) : (
                aiSessions.map(s => <AISessionCard key={s.id} session={s} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Interview Card (manual) ──────────────────────────────────────────────── */
function InterviewCard({ interview: iv }: { interview: Interview }) {
  const app = iv.application
  const candidate = app?.candidate
  const job = app?.job

  return (
    <div className={`bg-white border rounded-xl shadow-sm p-5 ${iv.status === 'completed' ? 'border-gray-100 opacity-80' : 'border-gray-100'}`}>
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${iv.interview_type === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
          {iv.interview_type === 'video' ? <Video size={18} /> : <Users size={18} />}
        </div>
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
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              iv.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
              iv.status === 'completed' ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-600'
            }`}>
              {iv.status.charAt(0).toUpperCase() + iv.status.slice(1)}
            </span>
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
          {iv.feedback && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              {iv.rating && (
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < iv.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600">{iv.feedback}</p>
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
            <button
              onClick={onApprove}
              disabled={approving}
              className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              <CheckCircle size={12} /> {approving ? 'Processing…' : 'Approve & Send'}
            </button>
            <button
              onClick={onReject}
              disabled={approving}
              className="flex items-center gap-1.5 text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
            >
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
            <Link
              href={`/interview/ai-room?sessionId=${s.id}`}
              className="flex items-center gap-1.5 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition"
            >
              <Video size={12} /> View Session <ChevronRight size={11}/>
            </Link>
            {s.tavus_conversation_url && s.status !== 'completed' && (
              <a
                href={s.tavus_conversation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs border border-violet-300 text-violet-600 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition"
              >
                <ExternalLink size={12}/> Join Live
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
