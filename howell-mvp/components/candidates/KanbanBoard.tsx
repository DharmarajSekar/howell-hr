'use client'
import Link from 'next/link'
import type { Application } from '@/types'
import { PIPELINE_STAGES, STATUS_LABELS } from '@/lib/utils'

interface Props { applications: Application[] }

const STAGE_COLORS: Record<string, string> = {
  applied:              'bg-gray-50  border-gray-200',
  screening:            'bg-blue-50  border-blue-200',
  shortlisted:          'bg-purple-50 border-purple-200',
  interview_scheduled:  'bg-amber-50 border-amber-200',
  interview_done:       'bg-pink-50  border-pink-200',
  offer:                'bg-emerald-50 border-emerald-200',
  hired:                'bg-green-50 border-green-200',
}

const HEADER_COLORS: Record<string, string> = {
  applied:              'text-gray-600  bg-gray-100',
  screening:            'text-blue-700  bg-blue-100',
  shortlisted:          'text-purple-700 bg-purple-100',
  interview_scheduled:  'text-amber-700 bg-amber-100',
  interview_done:       'text-pink-700  bg-pink-100',
  offer:                'text-emerald-700 bg-emerald-100',
  hired:                'text-green-700 bg-green-100',
}

function ScorePill({ score }: { score?: number }) {
  if (!score) return null
  const color = score >= 75 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{score}%</span>
}

export default function KanbanBoard({ applications }: Props) {
  const byStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = applications.filter(a => a.status === stage)
    return acc
  }, {} as Record<string, Application[]>)

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map(stage => {
        const cards = byStage[stage] || []
        return (
          <div key={stage} className="flex-shrink-0 w-52">
            {/* Column Header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg mb-1 ${HEADER_COLORS[stage]}`}>
              <span className="text-xs font-semibold">{STATUS_LABELS[stage]}</span>
              <span className="text-xs font-bold">{cards.length}</span>
            </div>

            {/* Cards */}
            <div className={`rounded-b-lg border min-h-24 p-2 space-y-2 ${STAGE_COLORS[stage]}`}>
              {cards.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-4">Empty</p>
              )}
              {cards.map(app => (
                <Link
                  key={app.id}
                  href={`/candidates/${app.candidate?.id}`}
                  className="block bg-white rounded-lg border border-gray-100 p-3 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-gray-900 leading-tight">
                      {app.candidate?.full_name}
                    </span>
                    <ScorePill score={app.ai_match_score} />
                  </div>
                  <div className="text-[11px] text-gray-500 leading-tight">
                    {app.candidate?.current_title}
                  </div>
                  {app.job && (
                    <div className="text-[10px] text-gray-400 mt-1 truncate">
                      {app.job.title}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
