'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Sparkles, CheckCircle, Upload } from 'lucide-react'
import type { Job } from '@/types'

export default function ApplyPage() {
  const { jobId } = useParams()
  const [job, setJob]         = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', current_title: '',
    current_company: '', experience_years: '', location: '', salary_expectation: '', summary: '',
    skills: '',
  })

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`).then(r => r.json()).then(d => { setJob(d); setLoading(false) })
  }, [jobId])

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  async function parseResume() {
    setParsing(true)
    const res = await fetch('/api/ai/parse-resume', { method: 'POST' })
    const data = await res.json()
    setForm({
      full_name: data.full_name || '',
      email: data.email || '',
      phone: data.phone || '',
      current_title: data.current_title || '',
      current_company: data.current_company || '',
      experience_years: String(data.experience_years || ''),
      location: data.location || '',
      salary_expectation: String(data.salary_expectation || ''),
      summary: data.summary || '',
      skills: (data.skills || []).join(', '),
    })
    setParsing(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    // Upsert candidate
    const candRes = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        experience_years: Number(form.experience_years),
        salary_expectation: Number(form.salary_expectation),
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        source: 'apply_link',
      }),
    })
    const candidate = await candRes.json()

    // Score vs job
    const scoreRes = await fetch('/api/ai/score-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle: job?.title, candidateName: form.full_name }),
    })
    const score = await scoreRes.json()

    // Create application
    await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        candidate_id: candidate.id,
        status: 'applied',
        ai_match_score: score.score,
        ai_match_summary: score.summary,
        ai_strengths: score.strengths,
        ai_gaps: score.gaps,
      }),
    })

    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  )

  if (!job) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">Job not found.</div>
  )

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
        <p className="text-gray-500 text-sm">
          Thank you for applying to <strong>{job.title}</strong> at Howell. Our team will review your profile and be in touch soon.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-black">H</span>
            </div>
            <div>
              <div className="font-bold text-gray-900">Howell</div>
              <div className="text-xs text-gray-400">AI-Enabled HR Platform</div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>{job.department}</span>
            <span>·</span>
            <span>{job.location}</span>
            <span>·</span>
            <span>{job.experience_min}–{job.experience_max} yrs</span>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Your Details</h2>
            <button
              type="button"
              onClick={parseResume}
              disabled={parsing}
              className="flex items-center gap-2 text-sm font-medium text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition disabled:opacity-60"
            >
              {parsing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {parsing ? 'Parsing Resume…' : 'Auto-fill from Resume (AI)'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current Title</label>
                <input value={form.current_title} onChange={e => set('current_title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current Company</label>
                <input value={form.current_company} onChange={e => set('current_company', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Years of Experience</label>
                <input type="number" value={form.experience_years} onChange={e => set('experience_years', e.target.value)}
                  min={0} max={40}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expected CTC (LPA)</label>
                <input type="number" value={form.salary_expectation} onChange={e => set('salary_expectation', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
              <input value={form.skills} onChange={e => set('skills', e.target.value)}
                placeholder="e.g. Java, Spring Boot, AWS"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Professional Summary</label>
              <textarea value={form.summary} onChange={e => set('summary', e.target.value)}
                rows={4} placeholder="Brief overview of your background…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-700 hover:bg-red-800 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting & Scoring…</> : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
