'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Plus, MapPin, Clock, Users, MoreVertical, CheckCircle, FileEdit, XCircle, PauseCircle, Trash2, RefreshCw } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string
  title: string
  department: string
  location: string
  employment_type: string
  experience_min: number
  experience_max: number
  salary_min?: number
  salary_max?: number
  status: 'active' | 'draft' | 'paused' | 'closed'
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border border-green-200',
  draft:  'bg-gray-100  text-gray-600  border border-gray-200',
  paused: 'bg-amber-100 text-amber-700 border border-amber-200',
  closed: 'bg-red-100   text-red-700   border border-red-200',
}

function daysOpen(created_at: string) {
  return Math.floor((Date.now() - new Date(created_at).getTime()) / 86_400_000)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

type FilterStatus = 'all' | 'active' | 'draft' | 'paused' | 'closed'

// ── Status action menu ───────────────────────────────────────────────────────
const STATUS_ACTIONS = [
  { status: 'active', label: 'Set Active',  icon: CheckCircle,  color: 'text-green-600' },
  { status: 'draft',  label: 'Move to Draft', icon: FileEdit,   color: 'text-gray-500'  },
  { status: 'paused', label: 'Pause',        icon: PauseCircle, color: 'text-amber-500' },
  { status: 'closed', label: 'Close Role',   icon: XCircle,     color: 'text-red-500'   },
]

function JobMenu({ job, onStatusChange, onDelete }: {
  job: Job
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen]  = useState(false)
  const ref              = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative" onClick={e => e.preventDefault()}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
        title="Actions"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-44">
          {STATUS_ACTIONS.filter(a => a.status !== job.status).map(action => (
            <button
              key={action.status}
              onClick={() => { onStatusChange(job.id, action.status); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition ${action.color}`}
            >
              <action.icon size={14} />
              {action.label}
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { onDelete(job.id); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const [jobs,       setJobs]       = useState<Job[]>([])
  const [appCounts,  setAppCounts]  = useState<Record<string, number>>({})
  const [filter,     setFilter]     = useState<FilterStatus>('all')
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showSpinner = false) {
    if (showSpinner) setRefreshing(true)
    try {
      const [jobsRes, appsRes] = await Promise.all([
        fetch('/api/jobs', { cache: 'no-store' }),
        fetch('/api/applications', { cache: 'no-store' }),
      ])
      const jobsData = await jobsRes.json()
      const appsData = await appsRes.json()

      setJobs(Array.isArray(jobsData) ? jobsData : [])

      // Count applications per job
      const counts: Record<string, number> = {}
      if (Array.isArray(appsData)) {
        appsData.forEach((a: any) => {
          counts[a.job_id] = (counts[a.job_id] || 0) + 1
        })
      }
      setAppCounts(counts)
    } catch { /* non-fatal */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleStatusChange(id: string, status: string) {
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: status as any } : j))
    await fetch(`/api/jobs/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this job posting? This cannot be undone.')) return
    setJobs(prev => prev.filter(j => j.id !== id))
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
  }

  // Filter
  const displayed = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  // Counts per status
  const counts = {
    all:    jobs.length,
    active: jobs.filter(j => j.status === 'active').length,
    draft:  jobs.filter(j => j.status === 'draft').length,
    paused: jobs.filter(j => j.status === 'paused').length,
    closed: jobs.filter(j => j.status === 'closed').length,
  }

  const TABS: { key: FilterStatus; label: string }[] = [
    { key: 'all',    label: `All (${counts.all})`       },
    { key: 'active', label: `Active (${counts.active})`  },
    { key: 'draft',  label: `Draft (${counts.draft})`    },
    { key: 'paused', label: `Paused (${counts.paused})`  },
    { key: 'closed', label: `Closed (${counts.closed})`  },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
          <p className="text-gray-500 text-sm mt-1">
            {counts.all} positions · {counts.active} active · {counts.draft} draft · {counts.closed} closed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/jobs/new"
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> New Job
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              filter === tab.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-16 text-center">
          <p className="text-gray-400 text-sm">No {filter === 'all' ? '' : filter} jobs found.</p>
          {filter === 'all' && (
            <Link href="/jobs/new" className="inline-block mt-3 text-sm text-red-700 hover:underline">
              Create your first job →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {displayed.map(job => (
            <div key={job.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 hover:shadow-md transition relative group">
              <div className="flex items-start justify-between">
                <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-semibold text-gray-900 group-hover:text-red-700 transition">{job.title}</h2>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[job.status] || STATUS_STYLES.draft}`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Users size={13}/>{job.department}</span>
                    <span className="flex items-center gap-1"><MapPin size={13}/>{job.location}</span>
                    <span className="flex items-center gap-1"><Clock size={13}/>{job.experience_min}–{job.experience_max} yrs</span>
                  </div>
                </Link>

                <div className="flex items-start gap-3 ml-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{appCounts[job.id] || 0}</div>
                    <div className="text-xs text-gray-500">applicants</div>
                  </div>
                  {/* ⋮ Actions menu */}
                  <JobMenu
                    job={job}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-3 text-xs text-gray-400">
                <span>{job.employment_type}</span>
                {job.salary_min && job.salary_max && (
                  <span>₹{job.salary_min.toLocaleString()}–{job.salary_max.toLocaleString()} LPA</span>
                )}
                <span className="ml-auto flex items-center gap-3">
                  <span className="text-gray-300">|</span>
                  <span>{daysOpen(job.created_at)} days open</span>
                  <span className="text-gray-300">|</span>
                  <span>Posted {formatDate(job.created_at)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
