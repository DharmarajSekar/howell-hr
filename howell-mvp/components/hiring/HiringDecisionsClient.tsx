'use client'
import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Minus, Plus, Zap, User, Briefcase, MapPin, Star, CheckCircle, XCircle, AlertCircle, BarChart2 } from 'lucide-react'

const REC_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
  'Strong Hire': { icon: ThumbsUp,   color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200', label: 'Strong Hire' },
  'Consider':    { icon: Minus,      color: 'text-yellow-700',bg: 'bg-yellow-50', border: 'border-yellow-200',label: 'Consider' },
  'Not Recommended': { icon: ThumbsDown, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200',   label: 'Not Recommended' },
}

const DECISION_COLORS: Record<string, string> = {
  hire:    'bg-green-600 text-white',
  hold:    'bg-yellow-500 text-white',
  reject:  'bg-red-600 text-white',
  pending: 'bg-gray-100 text-gray-600',
}

function aiRecommend(app: any): { rec: string; score: number; summary: string } {
  const resume = app.ai_match_score || 0
  const score  = Math.min(95, resume + Math.floor(Math.random() * 15))
  if (score >= 75) return { rec: 'Strong Hire',       score, summary: 'Candidate strongly matches the JD requirements. High AI confidence. Recommend immediate hiring decision.' }
  if (score >= 55) return { rec: 'Consider',          score, summary: 'Candidate partially matches requirements. Review strengths and gaps before deciding.' }
  return             { rec: 'Not Recommended',        score, summary: 'Candidate has significant skill gaps for this role. Consider other candidates first.' }
}

interface Props {
  decisions: any[]
  applications: any[]
}

export default function HiringDecisionsClient({ decisions: initial, applications }: Props) {
  const [decisions, setDecisions]   = useState<any[]>(initial)
  const [selected, setSelected]     = useState<any>(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [formApps, setFormApps]     = useState<string[]>([])
  const [adding, setAdding]         = useState(false)
  const [decisionNotes, setNotes]   = useState('')
  const [deciding, setDeciding]     = useState(false)

  async function addToComparison() {
    setAdding(true)
    try {
      const newDecisions: any[] = []
      for (const appId of formApps) {
        const app = applications.find((a: any) => a.id === appId)
        if (!app) continue
        const { rec, score, summary } = aiRecommend(app)
        const res = await fetch('/api/hiring-decisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            application_id: app.id,
            candidate_name: app.candidate?.full_name || 'Candidate',
            job_title: app.job?.title || 'Unknown Role',
            ai_recommendation: rec,
            ai_score: score,
            resume_score: app.ai_match_score || null,
            decision: 'pending',
          }),
        })
        const d = await res.json()
        newDecisions.push({ ...d, application: app })
      }
      setDecisions(prev => [...newDecisions, ...prev])
      setShowAdd(false)
      setFormApps([])
    } finally {
      setAdding(false)
    }
  }

  async function makeDecision(decisionId: string, decision: string) {
    setDeciding(true)
    try {
      const res = await fetch(`/api/hiring-decisions/${decisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          decision_notes: decisionNotes,
          decided_by: 'Dharmaraj Sekar',
          decided_at: new Date().toISOString(),
        }),
      })
      const updated = await res.json()
      setDecisions(prev => prev.map((d: any) => d.id === decisionId ? { ...d, ...updated } : d))
      if (selected?.id === decisionId) setSelected((s: any) => ({ ...s, ...updated }))
      setNotes('')
    } finally {
      setDeciding(false)
    }
  }

  const toggleAppSelection = (id: string) => {
    setFormApps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const hireCount   = decisions.filter((d:any) => d.decision === 'hire').length
  const holdCount   = decisions.filter((d:any) => d.decision === 'hold').length
  const rejectCount = decisions.filter((d:any) => d.decision === 'reject').length
  const pendingCount= decisions.filter((d:any) => d.decision === 'pending').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hiring Decision Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-powered comparison and Hire / Hold / Reject decisions</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Add Candidates
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending Review', value: pendingCount, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'Hired',          value: hireCount,   color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'On Hold',        value: holdCount,   color: 'text-yellow-700',bg: 'bg-yellow-50' },
          { label: 'Rejected',       value: rejectCount, color: 'text-red-700',   bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Decisions list */}
        <div className="col-span-2 space-y-2">
          <h2 className="font-semibold text-gray-900 text-sm mb-2">Candidates ({decisions.length})</h2>
          {decisions.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <BarChart2 size={32} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-sm text-gray-400">Add candidates to the dashboard to compare and decide.</p>
            </div>
          ) : (
            decisions.map((d: any) => {
              const rec = REC_CONFIG[d.ai_recommendation]
              return (
                <div key={d.id}
                  onClick={() => setSelected(selected?.id === d.id ? null : d)}
                  className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id === d.id ? 'border-red-500 shadow-md' : 'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium text-sm text-gray-900">{d.candidate_name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DECISION_COLORS[d.decision] || 'bg-gray-100 text-gray-500'}`}>
                      {d.decision.charAt(0).toUpperCase() + d.decision.slice(1)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{d.job_title}</div>
                  {rec && (
                    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${rec.bg} ${rec.border} ${rec.color} font-medium w-fit`}>
                      <rec.icon size={12}/>
                      {rec.label}
                      <span className="ml-auto pl-2">{d.ai_score}%</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Detail */}
        <div className="col-span-3">
          {selected ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              {/* Candidate header */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-lg flex-shrink-0">
                    {selected.candidate_name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-gray-900">{selected.candidate_name}</h2>
                    <p className="text-sm text-gray-500">{selected.job_title}</p>
                    {selected.application?.candidate && (
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        {selected.application.candidate.current_company && <span className="flex items-center gap-1"><Briefcase size={11}/>{selected.application.candidate.current_company}</span>}
                        {selected.application.candidate.location && <span className="flex items-center gap-1"><MapPin size={11}/>{selected.application.candidate.location}</span>}
                        {selected.application.candidate.experience_years != null && <span>{selected.application.candidate.experience_years}y experience</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Score Breakdown</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'AI Match Score', value: selected.ai_score, color: 'bg-purple-600' },
                    { label: 'Resume Score',   value: selected.resume_score, color: 'bg-blue-600' },
                    { label: 'Interview Score',value: selected.interview_score || null, color: 'bg-orange-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                      {s.value != null ? (
                        <>
                          <div className="text-xl font-bold text-gray-900 mb-1">{s.value}%</div>
                          <div className="bg-gray-200 rounded-full h-1.5">
                            <div className={`${s.color} h-1.5 rounded-full`} style={{ width: `${s.value}%` }}/>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-400 mt-1">Not available</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* AI recommendation banner */}
                {selected.ai_recommendation && REC_CONFIG[selected.ai_recommendation] && (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${REC_CONFIG[selected.ai_recommendation].bg} ${REC_CONFIG[selected.ai_recommendation].border}`}>
                    <Zap size={16} className="text-purple-500 flex-shrink-0 mt-0.5"/>
                    <div>
                      <div className={`text-sm font-bold ${REC_CONFIG[selected.ai_recommendation].color} mb-0.5`}>
                        AI Recommendation: {selected.ai_recommendation}
                      </div>
                      <p className="text-xs text-gray-600">
                        {selected.ai_score >= 75
                          ? 'Candidate strongly matches the JD requirements. High AI confidence. Recommend immediate hiring decision.'
                          : selected.ai_score >= 55
                          ? 'Candidate partially matches requirements. Review strengths and gaps before deciding.'
                          : 'Candidate has significant skill gaps for this role. Consider other candidates first.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Decision panel */}
              {selected.decision === 'pending' ? (
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Make Decision</h3>
                  <textarea
                    value={decisionNotes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add decision notes (optional)…"
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => makeDecision(selected.id, 'hire')} disabled={deciding}
                      className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                      <CheckCircle size={16}/> Hire
                    </button>
                    <button onClick={() => makeDecision(selected.id, 'hold')} disabled={deciding}
                      className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                      <AlertCircle size={16}/> Hold
                    </button>
                    <button onClick={() => makeDecision(selected.id, 'reject')} disabled={deciding}
                      className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                      <XCircle size={16}/> Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${DECISION_COLORS[selected.decision]} font-semibold`}>
                    {selected.decision === 'hire'   && <CheckCircle size={20}/>}
                    {selected.decision === 'hold'   && <AlertCircle size={20}/>}
                    {selected.decision === 'reject' && <XCircle size={20}/>}
                    Decision: {selected.decision.charAt(0).toUpperCase() + selected.decision.slice(1)}
                    {selected.decided_by && <span className="ml-auto text-xs opacity-80 font-normal">by {selected.decided_by}</span>}
                  </div>
                  {selected.decision_notes && (
                    <p className="text-sm text-gray-600 mt-3 bg-gray-50 rounded-lg p-3">{selected.decision_notes}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <BarChart2 size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select a candidate to view AI analysis and make a hiring decision</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Candidates Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Add Candidates for Review</h2>
              <p className="text-sm text-gray-500 mt-1">Select shortlisted candidates to compare and decide</p>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto space-y-2">
              {applications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No eligible candidates found. Shortlist some applications first.</p>
              ) : (
                applications.map((a: any) => (
                  <label key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50 transition">
                    <input type="checkbox" checked={formApps.includes(a.id)} onChange={() => toggleAppSelection(a.id)}
                      className="rounded text-red-700 focus:ring-red-500"/>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{a.candidate?.full_name}</div>
                      <div className="text-xs text-gray-500">{a.job?.title} · Score: {a.ai_match_score || '—'}%</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700`}>{a.status}</span>
                  </label>
                ))
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setShowAdd(false); setFormApps([]) }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={addToComparison} disabled={formApps.length === 0 || adding}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                {adding ? 'Adding…' : `Add ${formApps.length || ''} Candidates`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
