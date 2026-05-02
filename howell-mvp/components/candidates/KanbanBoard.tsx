'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Application } from '@/types'
import { PIPELINE_STAGES, STATUS_LABELS } from '@/lib/utils'
import { Bot, Loader2, Video, EyeOff, Eye, UserPlus, X } from 'lucide-react'

interface Props { applications: Application[] }

/* ── Add Candidate Modal ──────────────────────────────────────────────────── */
function AddCandidateModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [jobs,   setJobs]   = useState<{ id: string; title: string }[]>([])
  const [form, setForm] = useState({
    full_name:          '',
    email:              '',
    phone:              '',
    current_title:      '',
    current_company:    '',
    experience_years:   '',
    location:           '',
    salary_expectation: '',
    skills:             '',
    summary:            '',
    job_id:             '',   // which job they're applying for
  })

  // Load jobs for the dropdown
  useState(() => {
    fetch('/api/jobs').then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : (data.jobs || [])
      setJobs(list)
    }).catch(() => {})
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name || !form.email) { setError('Name and Email are required'); return }
    if (!form.job_id) { setError('Please select a job to apply for — this is needed to show the candidate on the pipeline board'); return }
    setSaving(true)
    setError(null)
    try {
      // Step 1: Create or upsert the candidate
      const candidatePayload = {
        full_name:          form.full_name,
        email:              form.email,
        phone:              form.phone,
        current_title:      form.current_title,
        current_company:    form.current_company,
        experience_years:   form.experience_years   ? parseInt(form.experience_years)   : null,
        location:           form.location,
        salary_expectation: form.salary_expectation ? parseInt(form.salary_expectation) : null,
        skills:             form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        summary:            form.summary,
        source:             'direct',
      }
      const cRes  = await fetch('/api/candidates', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(candidatePayload),
      })
      const candidate = await cRes.json()
      if (!cRes.ok) { setError(candidate.error || 'Failed to create candidate'); return }

      // Step 2: Create an application linking candidate → job
      const appRes = await fetch('/api/applications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          candidate_id: candidate.id,
          job_id:       form.job_id,
          status:       'applied',
          source:       'direct',
        }),
      })
      const app = await appRes.json()
      if (!appRes.ok) { setError(app.error || 'Candidate saved but failed to create application'); return }

      onAdded()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-red-600" />
            <h2 className="text-lg font-bold text-gray-900">Add Candidate</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Job selector — required to appear on pipeline */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <label className="block text-xs font-semibold text-amber-800 mb-1.5">
              Applying for Job <span className="text-red-500">*</span>
              <span className="font-normal text-amber-600 ml-1">— required to appear on the pipeline board</span>
            </label>
            <select
              value={form.job_id}
              onChange={e => set('job_id', e.target.value)}
              className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
              required
            >
              <option value="">Select a job posting…</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>

          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="e.g. Rahul Sharma" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="rahul@email.com" required />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="Chennai, India" />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Current Title</label>
              <input value={form.current_title} onChange={e => set('current_title', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="Senior ELV Engineer" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Current Company</label>
              <input value={form.current_company} onChange={e => set('current_company', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="Acme Corp" />
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Years of Experience</label>
              <input type="number" min={0} max={50} value={form.experience_years} onChange={e => set('experience_years', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="5" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Salary (₹/yr)</label>
              <input type="number" value={form.salary_expectation} onChange={e => set('salary_expectation', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="800000" />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Skills <span className="text-gray-400 font-normal">(comma separated)</span></label>
            <input value={form.skills} onChange={e => set('skills', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
              placeholder="CCTV, Access Control, BMS, Fire Alarm" />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Summary / Notes</label>
            <textarea value={form.summary} onChange={e => set('summary', e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
              placeholder="Brief background or notes about this candidate…" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 text-sm bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-60 transition font-semibold">
              {saving ? <><Loader2 size={14} className="animate-spin"/> Saving…</> : <><UserPlus size={14}/> Add Candidate</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
  const router   = useRouter()
  const [blindMode,   setBlindMode]   = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const byStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = applications
      .filter(a => a.status === stage)
      .sort((a, b) => (b.ai_match_score || 0) - (a.ai_match_score || 0))
    return acc
  }, {} as Record<string, Application[]>)

  return (
    <div>
      {/* Add Candidate Modal */}
      {showAddModal && (
        <AddCandidateModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => router.refresh()}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {blindMode && (
            <div className="flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
              <EyeOff size={12}/> Blind Screening Mode ON — names &amp; photos hidden to reduce unconscious bias
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-red-600 text-white border-red-600 hover:bg-red-700 transition">
            <UserPlus size={12}/> Add Candidate
          </button>
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
