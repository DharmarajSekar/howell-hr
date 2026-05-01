'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Application } from '@/types'
import { PIPELINE_STAGES, STATUS_LABELS } from '@/lib/utils'
import { Bot, Loader2, Video, EyeOff, Eye } from 'lucide-react'

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

const AI_INTERVIEW_STAGES = ['shortlisted', 'screening', 'applied']

function ScorePill({ score }: { score?: number }) {
  if (!score) return null
  const color = score >= 75 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{score}%</span>
}

function AIInterviewButton({ app }: { app: Application }) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function startAIInterview(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const res  = await fetch('/api/interviews/start-ai-interview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ applicationId: app.id }),
      })
      const data = await res.json()
      if (data.sessionId) router.push(`/interview/ai-room?sessionId=${data.sessionId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={startAIInterview} disabled={loading} title="Start AI Interview"
      className="flex items-center gap-1 text-[10px] font-semibold bg-violet-600 text-white px-2 py-1 rounded-md hover:bg-violet-700 disabled:opacity-60 transition mt-1.5 w-full justify-center">
      {loading ? <><Loader2 size={10} className="animate-spin"/> Starting…</> : <><Bot size={10}/> AI Interview</>}
    </button>
  )
}

// Generates a consistent anonymous label from a candidate ID
function anonymousLabel(id: string): string {
  const hash = id.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `Candidate #${hash}`
}

export default function KanbanBoard({ applications }: Props) {
  const [blindMode, setBlindMode] = useState(false)

  const byStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = applications
      .filter(a => a.status === stage)
      .sort((a, b) => (b.ai_match_score || 0) - (a.ai_match_score || 0))
    return acc
  }, {} as Record<string, Application[]>)

  return (
    <div>
      {/* Blind Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {blindMode && (
            <div className="flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
              <EyeOff size={12}/> Blind Screening Mode ON — names &amp; photos hidden to reduce unconscious bias
            </div>
          )}
        </div>
        <button
          onClick={() => setBlindMode(b => !b)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
            blindMode
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
          }`}>
          {blindMode ? <><Eye size={12}/> Reveal Names</> : <><EyeOff size={12}/> Blind Mode</>}
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => {
          const cards = byStage[stage] || []
          return (
            <div key={stage} className="flex-shrink-0 w-56">
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
                {cards.map((app, idx) => {
                  const displayName  = blindMode ? anonymousLabel(app.candidate?.id || app.id) : app.candidate?.full_name
                  const displayTitle = blindMode ? '— title hidden —' : app.candidate?.current_title
                  const avatarChar   = blindMode ? '?' : (app.candidate?.full_name?.charAt(0) || '?')

                  return (
                    <div key={app.id} className="relative">
                      {/* Rank badge for top scorers */}
                      {idx === 0 && app.ai_match_score && app.ai_match_score >= 70 && cards.length > 1 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center z-10">
                          <span className="text-[8px] font-black text-white">1</span>
                        </div>
                      )}
                      <Link
                        href={blindMode ? '#' : `/candidates/${app.candidate?.id}`}
                        onClick={blindMode ? (e) => e.preventDefault() : undefined}
                        className={`block bg-white rounded-lg border border-gray-100 p-3 shadow-sm hover:shadow-md transition ${blindMode ? 'cursor-default' : ''}`}>

                        {/* Avatar + name row */}
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${blindMode ? 'bg-blue-100 text-blue-500' : 'bg-red-100 text-red-600'}`}>
                              {avatarChar}
                            </div>
                            <span className={`text-xs font-semibold leading-tight ${blindMode ? 'text-blue-700' : 'text-gray-900'}`}>
                              {displayName}
                            </span>
                          </div>
                          <ScorePill score={app.ai_match_score}/>
                        </div>

                        <div className={`text-[11px] leading-tight ${blindMode ? 'text-blue-300 italic' : 'text-gray-500'}`}>
                          {displayTitle}
                        </div>

                        {app.job && (
                          <div className="text-[10px] text-gray-400 mt-1 truncate">
                            {app.job.title}
                          </div>
                        )}

                        {/* AI Interview button — only in non-blind or after reveal */}
                        {!blindMode && AI_INTERVIEW_STAGES.includes(stage) && (
                          <AIInterviewButton app={app}/>
                        )}

                        {/* View AI session if already scheduled */}
                        {stage === 'interview_scheduled' && !blindMode && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-violet-600 font-medium">
                            <Video size={10}/> AI Interview Scheduled
                          </div>
                        )}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
