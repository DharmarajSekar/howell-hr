'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Loader2, Sparkles, CheckCircle, XCircle, Calendar, FileText } from 'lucide-react'
import { formatCurrency, STATUS_LABELS, STATUS_COLORS, cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import InterviewScheduler from '@/components/candidates/InterviewScheduler'
import OfferLetterModal from '@/components/candidates/OfferLetterModal'
import type { Candidate, Application } from '@/types'

export default function CandidateDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [apps, setApps]           = useState<Application[]>([])
  const [loading, setLoading]     = useState(true)
  const [scoring, setScoring]     = useState<string | null>(null)
  const [scheduleApp, setScheduleApp] = useState<Application | null>(null)
  const [offerApp, setOfferApp]       = useState<Application | null>(null)

  async function load() {
    const [candRes, appsRes] = await Promise.all([
      fetch('/api/candidates').then(r => r.json()),
      fetch('/api/applications').then(r => r.json()),
    ])
    const cand = candRes.find((c: Candidate) => c.id === id)
    setCandidate(cand || null)
    setApps(appsRes.filter((a: Application) => a.candidate_id === id))
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function scoreApplication(app: Application) {
    if (!candidate || !app.job) return
    setScoring(app.id)
    const res = await fetch('/api/ai/score-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle: app.job.title, candidateName: candidate.full_name }),
    })
    const { score, summary, strengths, gaps } = await res.json()
    await fetch(`/api/applications/${app.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_match_score: score, ai_match_summary: summary, ai_strengths: strengths, ai_gaps: gaps }),
    })
    setApps(prev => prev.map(a => a.id === app.id
      ? { ...a, ai_match_score: score, ai_match_summary: summary, ai_strengths: strengths, ai_gaps: gaps } : a))
    setScoring(null)
    toast(`Match score: ${score}% for ${candidate.full_name}`)
  }

  async function moveStatus(appId: string, status: string) {
    await fetch(`/api/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    toast(`Status updated to "${STATUS_LABELS[status]}"`)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  )
  if (!candidate) return (
    <div className="p-8 text-center text-gray-500">Candidate not found.</div>
  )

  const initials = candidate.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)

  const CAN_SCHEDULE = ['shortlisted', 'screening', 'applied']
  const CAN_OFFER    = ['interview_done', 'shortlisted']

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/candidates" className="flex items-center gap-2 text-gray-400 hover:text-gray-700 mb-6 text-sm transition">
        <ArrowLeft size={16} /> Back to Pipeline
      </Link>

      <div className="grid grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xl font-bold mx-auto mb-3">
              {initials}
            </div>
            <h1 className="text-lg font-bold text-gray-900">{candidate.full_name}</h1>
            <p className="text-sm text-gray-500">{candidate.current_title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{candidate.current_company}</p>

            <div className="mt-4 space-y-2 text-sm text-left">
              {[
                { icon: Mail,     text: candidate.email },
                { icon: Phone,    text: candidate.phone },
                { icon: MapPin,   text: candidate.location },
                { icon: Briefcase,text: `${candidate.experience_years} years exp` },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-gray-600">
                  <Icon size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="truncate text-xs">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.map((skill: string) => (
                <span key={skill} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">{skill}</span>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
            <div className="space-y-1 text-sm">
              {[
                { label: 'Expected CTC', value: formatCurrency(candidate.salary_expectation) },
                { label: 'Source',       value: candidate.source?.replace('_', ' ') },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-400 text-xs">{label}</span>
                  <span className="font-medium text-xs capitalize">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Applications */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-2">Summary</h2>
            <p className="text-sm text-gray-600">{candidate.summary}</p>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900">Applications ({apps.length})</h2>

            {apps.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
                <p className="text-gray-400 text-sm">No active applications.</p>
              </div>
            )}

            {apps.map(app => (
              <div key={app.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{app.job?.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{app.job?.department} · {app.job?.location}</div>
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[app.status])}>
                    {STATUS_LABELS[app.status] || app.status}
                  </span>
                </div>

                {/* AI Score */}
                {app.ai_match_score ? (
                  <div className="space-y-2 mb-3">
                    <div className={cn(
                      'inline-block text-sm font-bold px-2.5 py-0.5 rounded-full',
                      app.ai_match_score >= 75 ? 'bg-green-100 text-green-700' :
                      app.ai_match_score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    )}>
                      {app.ai_match_score}% Match
                    </div>
                    {app.ai_match_summary && <p className="text-xs text-gray-600">{app.ai_match_summary}</p>}
                    {app.ai_strengths?.map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <CheckCircle size={11} className="text-green-500 mt-0.5 flex-shrink-0" />{s}
                      </div>
                    ))}
                    {app.ai_gaps?.map((g: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <XCircle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />{g}
                      </div>
                    ))}
                  </div>
                ) : (
                  <button onClick={() => scoreApplication(app)} disabled={scoring === app.id}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition disabled:opacity-60 mb-3">
                    {scoring === app.id
                      ? <><Loader2 size={12} className="animate-spin" /> Scoring…</>
                      : <><Sparkles size={12} /> Run AI Match Score</>}
                  </button>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                  {CAN_SCHEDULE.includes(app.status) && (
                    <button onClick={() => setScheduleApp({ ...app, candidate, job: app.job } as Application)}
                      className="flex items-center gap-1.5 text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition">
                      <Calendar size={12} /> Schedule Interview
                    </button>
                  )}
                  {app.status === 'interview_scheduled' && (
                    <button onClick={() => moveStatus(app.id, 'interview_done')}
                      className="flex items-center gap-1.5 text-xs font-medium border border-pink-200 text-pink-700 hover:bg-pink-50 px-3 py-1.5 rounded-lg transition">
                      <CheckCircle size={12} /> Mark Interviewed
                    </button>
                  )}
                  {CAN_OFFER.includes(app.status) && (
                    <button onClick={() => setOfferApp({ ...app, candidate, job: app.job } as Application)}
                      className="flex items-center gap-1.5 text-xs font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition">
                      <FileText size={12} /> Generate Offer Letter
                    </button>
                  )}
                  {app.status === 'offer' && (
                    <button onClick={() => moveStatus(app.id, 'hired')}
                      className="flex items-center gap-1.5 text-xs font-medium border border-green-200 text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg transition">
                      <CheckCircle size={12} /> Mark as Hired
                    </button>
                  )}
                  {!['hired', 'rejected', 'withdrawn'].includes(app.status) && (
                    <button onClick={() => moveStatus(app.id, 'rejected')}
                      className="flex items-center gap-1.5 text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">
                      <XCircle size={12} /> Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {scheduleApp && (
        <InterviewScheduler
          open={!!scheduleApp}
          onClose={() => setScheduleApp(null)}
          application={scheduleApp}
          onScheduled={load}
        />
      )}
      {offerApp && (
        <OfferLetterModal
          open={!!offerApp}
          onClose={() => { setOfferApp(null); load() }}
          application={offerApp}
        />
      )}
    </div>
  )
}
