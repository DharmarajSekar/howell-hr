'use client'
import Link from 'next/link'
import { cn, STATUS_LABELS, STATUS_COLORS, formatDate } from '@/lib/utils'
import type { Application } from '@/types'
import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react'

interface Props { app: Application }

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low'
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {score}% match
    </span>
  )
}

export default function ApplicationCard({ app }: Props) {
  const [expanded, setExpanded] = useState(false)
  const candidate = app.candidate

  if (!candidate) return null

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
          {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/candidates/${candidate.id}`}
              className="font-semibold text-gray-900 hover:text-red-700 text-sm"
              onClick={e => e.stopPropagation()}
            >
              {candidate.full_name}
            </Link>
            {app.ai_match_score && <ScoreBadge score={app.ai_match_score} />}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {candidate.current_title} · {candidate.current_company} · {candidate.experience_years} yrs
          </div>
        </div>

        {/* Status */}
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[app.status])}>
          {STATUS_LABELS[app.status] || app.status}
        </span>

        {/* Expand */}
        <span className="text-gray-400">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {expanded && app.ai_match_summary && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
          <p className="text-xs text-gray-600">{app.ai_match_summary}</p>
          {app.ai_strengths && app.ai_strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Strengths</p>
              <ul className="space-y-1">
                {app.ai_strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <CheckCircle size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {app.ai_gaps && app.ai_gaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Gaps</p>
              <ul className="space-y-1">
                {app.ai_gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <XCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <StatusUpdater appId={app.id} currentStatus={app.status} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatusUpdater({ appId, currentStatus }: { appId: string; currentStatus: string }) {
  const NEXT_ACTIONS: Record<string, string[]> = {
    applied:              ['screening', 'rejected'],
    screening:            ['shortlisted', 'rejected'],
    shortlisted:          ['interview_scheduled', 'rejected'],
    interview_scheduled:  ['interview_done', 'rejected'],
    interview_done:       ['offer', 'rejected'],
    offer:                ['hired', 'rejected'],
  }
  const actions = NEXT_ACTIONS[currentStatus] || []
  const [updating, setUpdating] = useState(false)

  if (!actions.length) return null

  async function move(status: string) {
    setUpdating(true)
    await fetch(`/api/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    window.location.reload()
  }

  return (
    <>
      {actions.map(action => (
        <button
          key={action}
          disabled={updating}
          onClick={() => move(action)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-lg font-medium border transition disabled:opacity-50',
            action === 'rejected'
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          )}
        >
          → {STATUS_LABELS[action] || action}
        </button>
      ))}
    </>
  )
}
