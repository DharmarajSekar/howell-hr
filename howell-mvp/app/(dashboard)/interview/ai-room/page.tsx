'use client'
/**
 * AI Interview Room — HR Management View
 *
 * This page is for HR to manage AI interview sessions.
 * The actual interview is conducted by the CANDIDATE at:
 *   /candidate-interview?sessionId=<id>
 *
 * HR uses this page to:
 *  - See all pending/active/completed AI sessions
 *  - Copy and send the candidate interview link
 *  - View scores and transcripts after completion
 */

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Bot, Copy, CheckCircle, Clock, User, Zap,
  ExternalLink, ArrowLeft, Video, Trophy, AlertCircle,
  Send, Mail, MessageCircle
} from 'lucide-react'
import Link from 'next/link'

interface Session {
  id: string
  status: string
  ai_score: number | null
  ai_summary: string | null
  recording_url: string | null
  created_at: string
  application?: {
    candidate?: { full_name: string; email: string; phone: string }
    job?: { title: string }
  }
}

function CopyLinkButton({ sessionId, candidateName }: { sessionId: string; candidateName: string }) {
  const [copied, setCopied] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/candidate-interview?sessionId=${sessionId}`
    : `/candidate-interview?sessionId=${sessionId}`

  const emailTemplate = `Subject: AI Interview Invitation — Howell Group\n\nDear ${candidateName},\n\nYou have been shortlisted for an AI-powered interview with Howell Group.\n\nPlease click the link below to start your interview at your convenience. The interview takes approximately 15–20 minutes.\n\n${link}\n\nTips:\n- Use Chrome or Edge browser for best experience\n- Allow microphone access when prompted\n- Find a quiet environment\n\nBest regards,\nHR Team — Howell Group`

  const whatsappMsg = `Hi ${candidateName}, you have been shortlisted for an AI interview with Howell Group! Please complete it using this link: ${link}\n\nUse Chrome/Edge browser and allow mic access. Takes ~15 mins. All the best! 🎯`

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-gray-50 focus:outline-none"
        />
        <button
          onClick={() => copy(link, 'link')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 ${
            copied ? 'bg-green-600 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          {copied ? <CheckCircle size={12}/> : <Copy size={12}/>}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      <button
        onClick={() => setShowTemplates(p => !p)}
        className="text-xs text-violet-600 hover:underline flex items-center gap-1"
      >
        <Mail size={11}/> {showTemplates ? 'Hide' : 'Show'} email & WhatsApp templates
      </button>

      {showTemplates && (
        <div className="space-y-3 mt-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">📧 Email Template</span>
              <button onClick={() => copy(emailTemplate, 'email')}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Copy size={10}/> Copy
              </button>
            </div>
            <textarea readOnly rows={5} value={emailTemplate}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-gray-50 resize-none focus:outline-none"/>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">💬 WhatsApp Message</span>
              <button onClick={() => copy(whatsappMsg, 'wa')}
                className="text-xs text-green-600 hover:underline flex items-center gap-1">
                <Copy size={10}/> Copy
              </button>
            </div>
            <textarea readOnly rows={3} value={whatsappMsg}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-gray-50 resize-none focus:outline-none"/>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionCard({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false)
  const name = session.application?.candidate?.full_name || 'Candidate'
  const job  = session.application?.job?.title || 'Unknown Role'
  const score = session.ai_score

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending:     { label: 'Awaiting Candidate', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
    in_progress: { label: 'In Progress',        color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: Zap },
    completed:   { label: 'Completed',          color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  }
  const sc = statusConfig[session.status] || statusConfig.pending
  const StatusIcon = sc.icon

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden transition ${
      session.status === 'completed' ? 'border-green-200' :
      session.status === 'in_progress' ? 'border-blue-300' : 'border-gray-200'
    }`}>
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpanded(p => !p)}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
          session.status === 'completed' ? 'bg-green-100 text-green-700' :
          session.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
        }`}>
          {name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900">{name}</div>
          <div className="text-xs text-gray-500 truncate">{job}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {score !== null && score !== undefined && (
            <span className={`text-sm font-black ${score >= 70 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {score}%
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${sc.color}`}>
            <StatusIcon size={10}/> {sc.label}
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          {session.status !== 'completed' ? (
            <div className="space-y-3">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex gap-2">
                <Send size={14} className="text-violet-500 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className="text-xs font-semibold text-violet-800">Send this link to {name}</p>
                  <p className="text-xs text-violet-600 mt-0.5">The candidate opens it on their own device — no login required. The AI conducts the interview automatically.</p>
                </div>
              </div>
              <CopyLinkButton sessionId={session.id} candidateName={name}/>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Score bar */}
              {score !== null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">AI Score</span>
                    <span className={`text-sm font-black ${score >= 70 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{score}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className={`h-2 rounded-full transition-all ${score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${score}%` }}/>
                  </div>
                </div>
              )}

              {session.ai_summary && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-gray-600 mb-1">AI Summary</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{session.ai_summary}</p>
                </div>
              )}

              {session.recording_url && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Recording</p>
                  <video src={session.recording_url} controls
                    className="w-full rounded-xl border border-gray-200 max-h-48 bg-gray-900 object-contain"/>
                </div>
              )}

              <Link href="/interviews"
                className="flex items-center gap-1.5 text-xs text-violet-600 hover:underline">
                <ExternalLink size={11}/> View full transcript & scores in Interviews
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AIRoomInner() {
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<'all'|'pending'|'completed'>('all')

  useEffect(() => {
    fetch('/api/interviews/ai-sessions')
      .then(r => r.json())
      .then(d => setSessions(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = sessions.filter(s =>
    filter === 'all'       ? true :
    filter === 'pending'   ? s.status !== 'completed' :
    filter === 'completed' ? s.status === 'completed' : true
  )

  const pendingCount   = sessions.filter(s => s.status !== 'completed').length
  const completedCount = sessions.filter(s => s.status === 'completed').length
  const avgScore = completedCount
    ? Math.round(sessions.filter(s => s.ai_score).reduce((a,s) => a + (s.ai_score||0), 0) / completedCount)
    : null

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/interviews" className="text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft size={16}/>
          </Link>
          <div className="p-2 bg-violet-100 rounded-lg">
            <Bot size={18} className="text-violet-600"/>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Interview Room</h1>
        </div>
        <p className="text-gray-500 text-sm ml-12">
          Manage AI interview sessions. Copy the candidate link and send it — the AI conducts the interview automatically.
        </p>
      </div>

      {/* How it works banner */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6 grid grid-cols-3 gap-4">
        {[
          { num: '1', label: 'HR copies link', desc: 'Click a session below → copy the candidate interview link' },
          { num: '2', label: 'Candidate opens it', desc: 'Candidate opens the link on their device (no login needed)' },
          { num: '3', label: 'AI interviews them', desc: 'AI avatar asks questions, listens, scores automatically' },
        ].map(s => (
          <div key={s.num} className="text-center">
            <div className="w-7 h-7 bg-violet-600 text-white rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1">{s.num}</div>
            <div className="text-xs font-semibold text-violet-800">{s.label}</div>
            <div className="text-xs text-violet-600 mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Awaiting Candidate', value: pendingCount, color: 'text-amber-600' },
          { label: 'Completed',          value: completedCount, color: 'text-green-600' },
          { label: 'Avg Score',          value: avgScore ? `${avgScore}%` : '—', color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {f === 'pending' ? 'Awaiting Candidate' : f === 'all' ? `All (${sessions.length})` : `Completed (${completedCount})`}
          </button>
        ))}
      </div>

      {/* Session list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading sessions…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
          <Bot size={36} className="mx-auto mb-3 text-gray-300"/>
          <p>No AI interview sessions yet.</p>
          <p className="text-xs mt-1">Go to <Link href="/interviews" className="text-violet-600 hover:underline">Interviews</Link> → schedule an AI round to create sessions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => <SessionCard key={s.id} session={s}/>)}
        </div>
      )}
    </div>
  )
}

export default function AIInterviewRoomPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Loading…</div>}>
      <AIRoomInner />
    </Suspense>
  )
}
