'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Application } from '@/types'
import { PIPELINE_STAGES, STATUS_LABELS } from '@/lib/utils'
import { Bot, Loader2, Video, EyeOff, Eye, UserPlus, X, XCircle, Calendar, ChevronDown, RotateCcw } from 'lucide-react'
import { addCandidateAction } from '@/app/actions/addCandidate'

interface Props {
  applications: Application[]
  rejectedApplications?: Application[]
}

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
  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : (data.jobs || [])
      setJobs(list)
    }).catch(() => {})
  }, [])

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
      // Direct server action — no API fetch, no middleware, no network issues
      const result = await addCandidateAction({
        ...form,
        skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      })

      if (result.error) {
        setError(result.error)
        return
      }

      onAdded()
    } catch (err: any) {
      setError(`Unexpected error: ${err.message}`)
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

function ScorePill({ score }: { score?: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">AI…</span>
  }
  if (score === 0) return null
  const color = score >= 75 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{score}%</span>
}

function AIInterviewButton({ app }: { app: Application }) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function startAIInterview(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/interviews/start-ai-interview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ applicationId: app.id }),
      })
      const data = await res.json()
      if (data.sessionId) {
        router.push(`/interview/ai-room?sessionId=${data.sessionId}`)
      } else if (data.error) {
        const isTableMissing = data.error.toLowerCase().includes('does not exist') ||
                               data.error.toLowerCase().includes('schema cache')
        setError(isTableMissing
          ? 'Run interview-ai-schema.sql in Supabase first'
          : data.error)
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-1.5">
      <button onClick={startAIInterview} disabled={loading} title="Start AI Interview"
        className="flex items-center gap-1 text-[10px] font-semibold bg-violet-600 text-white px-2 py-1 rounded-md hover:bg-violet-700 disabled:opacity-60 transition w-full justify-center">
        {loading ? <><Loader2 size={10} className="animate-spin"/> Starting…</> : <><Bot size={10}/> AI Interview</>}
      </button>
      {error && (
        <p className="text-[9px] text-red-500 mt-0.5 leading-tight text-center">{error}</p>
      )}
    </div>
  )
}

// Generates a consistent anonymous label from a candidate ID
function anonymousLabel(id: string): string {
  const hash = id.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `Candidate #${hash}`
}

/* ── Rejected Tab View ───────────────────────────────────────────────────── */
function RejectedView({ rejected }: { rejected: Application[] }) {
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [jobFilter, setJobFilter] = useState('all')
  const [restoring, setRestoring] = useState<string | null>(null)

  // Collect unique jobs from rejected list
  const jobs = useMemo(() => {
    const map: Record<string, string> = {}
    rejected.forEach(a => { if (a.job?.id) map[a.job.id] = a.job.title })
    return Object.entries(map).map(([id, title]) => ({ id, title }))
  }, [rejected])

  const filtered = useMemo(() => {
    return rejected.filter(a => {
      const updatedAt = new Date(a.updated_at || a.created_at || '')
      if (dateFrom) {
        const from = new Date(dateFrom)
        from.setHours(0, 0, 0, 0)
        if (updatedAt < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        if (updatedAt > to) return false
      }
      if (jobFilter !== 'all' && a.job?.id !== jobFilter) return false
      return true
    }).sort((a, b) => new Date(b.updated_at || b.created_at || '').getTime() - new Date(a.updated_at || a.created_at || '').getTime())
  }, [rejected, dateFrom, dateTo, jobFilter])

  async function restoreToApplied(appId: string) {
    setRestoring(appId)
    try {
      await fetch('/api/applications/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId }),
      })
      window.location.reload()
    } finally {
      setRestoring(null)
    }
  }

  function setQuickFilter(preset: string) {
    const now   = new Date()
    const today = now.toISOString().split('T')[0]
    if (preset === 'today') {
      setDateFrom(today); setDateTo(today)
    } else if (preset === 'week') {
      const from = new Date(now); from.setDate(from.getDate() - 7)
      setDateFrom(from.toISOString().split('T')[0]); setDateTo(today)
    } else if (preset === 'month') {
      const from = new Date(now); from.setDate(from.getDate() - 30)
      setDateFrom(from.toISOString().split('T')[0]); setDateTo(today)
    } else {
      setDateFrom(''); setDateTo('')
    }
  }

  return (
    <div>
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
        <XCircle size={15} className="text-red-400 flex-shrink-0"/>
        <span className="text-xs font-semibold text-red-700">{filtered.length} rejected profile{filtered.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-1 ml-auto">
          {/* Quick presets */}
          {['today','week','month','all'].map(p => (
            <button key={p} onClick={() => setQuickFilter(p)}
              className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition capitalize font-medium">
              {p === 'all' ? 'All time' : p === 'week' ? 'Last 7d' : p === 'month' ? 'Last 30d' : 'Today'}
            </button>
          ))}
        </div>
        {/* Custom date range */}
        <div className="flex items-center gap-2 border-l border-red-200 pl-3">
          <Calendar size={13} className="text-red-400"/>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-xs border border-red-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-400"/>
          <span className="text-xs text-red-400">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-xs border border-red-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-400"/>
        </div>
        {/* Job filter */}
        {jobs.length > 0 && (
          <select value={jobFilter} onChange={e => setJobFilter(e.target.value)}
            className="text-xs border border-red-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-400">
            <option value="all">All roles</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        )}
        {(dateFrom || dateTo || jobFilter !== 'all') && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setJobFilter('all') }}
            className="text-xs text-red-500 hover:text-red-700 underline">Clear</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <XCircle size={36} className="mx-auto text-gray-300 mb-3"/>
          <p className="text-gray-400 text-sm">No rejected profiles match your filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <span>Candidate</span>
            <span>Role</span>
            <span>AI Score</span>
            <span>Source</span>
            <span>Rejected On</span>
            <span></span>
          </div>
          {filtered.map(app => {
            const name     = app.candidate?.full_name || 'Unknown'
            const title    = app.candidate?.current_title || '—'
            const jobTitle = app.job?.title || '—'
            const score    = app.ai_match_score
            const source   = app.candidate?.source || 'direct'
            const date     = new Date(app.updated_at || app.created_at || '')
            const dateStr  = date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
            const timeStr  = date.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
            const isRestoring = restoring === app.id

            return (
              <div key={app.id}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-red-200 hover:shadow-sm transition">
                {/* Candidate */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                    <div className="text-xs text-gray-400 truncate">{title}</div>
                  </div>
                </div>
                {/* Role */}
                <div className="text-sm text-gray-600 truncate">{jobTitle}</div>
                {/* Score */}
                <div>
                  {score ? (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                      {score}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>
                {/* Source */}
                <div>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {source === 'direct' ? '📩 Direct' : source.includes('portal') ? '🔗 Portal' : source}
                  </span>
                </div>
                {/* Date */}
                <div className="text-xs text-gray-500">
                  <div>{dateStr}</div>
                  <div className="text-gray-300">{timeStr}</div>
                </div>
                {/* Restore */}
                <button
                  onClick={() => restoreToApplied(app.id)}
                  disabled={isRestoring}
                  title="Move back to Applied"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 border border-gray-200 hover:border-green-300 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50">
                  {isRestoring ? <Loader2 size={11} className="animate-spin"/> : <RotateCcw size={11}/>}
                  Restore
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function KanbanBoard({ applications, rejectedApplications = [] }: Props) {
  const router   = useRouter()
  const [activeTab,    setActiveTab]    = useState<'pipeline' | 'rejected'>('pipeline')
  const [blindMode,    setBlindMode]    = useState(false)
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
          onAdded={() => { setShowAddModal(false); window.location.reload() }}
        />
      )}

      {/* Tabs + Toolbar */}
      <div className="flex items-center justify-between mb-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition ${
              activeTab === 'pipeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            Active Pipeline
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'pipeline' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
              {applications.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition ${
              activeTab === 'rejected' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <XCircle size={12}/>
            Rejected
            {rejectedApplications.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                {rejectedApplications.length}
              </span>
            )}
          </button>
        </div>

        {/* Actions — only show on pipeline tab */}
        {activeTab === 'pipeline' && (
          <div className="flex items-center gap-2">
            {blindMode && (
              <div className="flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
                <EyeOff size={12}/> Blind Screening Mode ON
              </div>
            )}
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
        )}
      </div>

      {/* ── Rejected tab ── */}
      {activeTab === 'rejected' && (
        <RejectedView rejected={rejectedApplications} />
      )}

      {/* ── Pipeline Kanban ── */}
      {activeTab === 'pipeline' && (
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
                        {idx === 0 && app.ai_match_score && app.ai_match_score >= 70 && cards.length > 1 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center z-10">
                            <span className="text-[8px] font-black text-white">1</span>
                          </div>
                        )}
                        <Link
                          href={blindMode ? '#' : `/candidates/${app.candidate?.id}`}
                          onClick={blindMode ? (e) => e.preventDefault() : undefined}
                          className={`block bg-white rounded-lg border border-gray-100 p-3 shadow-sm hover:shadow-md transition ${blindMode ? 'cursor-default' : ''}`}>

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

                          {!blindMode && AI_INTERVIEW_STAGES.includes(stage) && (
                            <AIInterviewButton app={app}/>
                          )}

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
      )}
    </div>
  )
}
