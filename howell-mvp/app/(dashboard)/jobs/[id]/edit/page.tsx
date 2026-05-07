'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Sparkles, Loader2, ArrowLeft, Zap, CheckCircle, Save } from 'lucide-react'
import Link from 'next/link'
import SkillPicker from '@/components/jobs/SkillPicker'

const DEPARTMENTS = ['Engineering', 'HR', 'Analytics', 'Operations', 'Finance', 'Technology', 'Sales', 'Marketing', 'Legal', 'Product', 'Design', 'Customer Success']
const LOCATIONS = [
  '── India ──',
  'Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai',
  'Kolkata', 'Ahmedabad', 'Jaipur', 'Noida', 'Gurugram', 'Kochi',
  '── Middle East ──',
  'Dubai, UAE', 'Abu Dhabi, UAE', 'Sharjah, UAE', 'Riyadh, Saudi Arabia',
  'Jeddah, Saudi Arabia', 'Doha, Qatar', 'Kuwait City, Kuwait',
  'Muscat, Oman', 'Manama, Bahrain',
  '── Asia Pacific ──',
  'Singapore', 'Kuala Lumpur, Malaysia', 'Bangkok, Thailand',
  'Jakarta, Indonesia', 'Manila, Philippines', 'Ho Chi Minh City, Vietnam',
  'Sydney, Australia', 'Melbourne, Australia', 'Tokyo, Japan',
  'Shanghai, China', 'Hong Kong', 'Seoul, South Korea',
  '── Europe ──',
  'London, UK', 'Manchester, UK', 'Dublin, Ireland',
  'Amsterdam, Netherlands', 'Berlin, Germany', 'Frankfurt, Germany',
  'Paris, France', 'Madrid, Spain', 'Milan, Italy',
  'Zurich, Switzerland', 'Stockholm, Sweden', 'Warsaw, Poland',
  '── North America ──',
  'New York, USA', 'San Francisco, USA', 'Austin, USA', 'Chicago, USA',
  'Seattle, USA', 'Boston, USA', 'Los Angeles, USA', 'Toronto, Canada',
  'Vancouver, Canada',
  '── Other ──',
  'Remote', 'Multiple Locations', 'Pan India',
]
const EMP_TYPES = ['Full-time', 'Contract', 'Part-time', 'Freelance', 'Internship']

export default function EditJobPage() {
  const router = useRouter()
  const { id }  = useParams<{ id: string }>()

  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [origStatus, setOrigStatus] = useState('draft')

  const [form, setForm] = useState({
    title: '', department: DEPARTMENTS[0], location: LOCATIONS[1],
    employment_type: EMP_TYPES[0], experience_min: 3, experience_max: 7,
    salary_min: '' as string | number, salary_max: '' as string | number,
    description: '', requirements: '', nice_to_have: '',
    openings: 1, positions_filled: 0,
  })
  const [skills, setSkills] = useState<string[]>([])

  // Load existing job on mount
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/jobs/${id}`, { cache: 'no-store' })
        const job  = await res.json()
        setOrigStatus(job.status || 'draft')
        setForm({
          title:           job.title           || '',
          department:      job.department      || DEPARTMENTS[0],
          location:        job.location        || LOCATIONS[1],
          employment_type: job.employment_type || EMP_TYPES[0],
          experience_min:  job.experience_min  ?? 3,
          experience_max:  job.experience_max  ?? 7,
          salary_min:      job.salary_min      ?? '',
          salary_max:      job.salary_max      ?? '',
          description:     job.description     || '',
          requirements:    job.requirements    || '',
          nice_to_have:    job.nice_to_have    || '',
          openings:        job.openings        ?? 1,
          positions_filled:job.positions_filled ?? 0,
        })
        if (Array.isArray(job.skills)) setSkills(job.skills)
      } catch { /* show empty form */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  function set(key: string, val: any) {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function generateJD() {
    if (!form.title) return alert('Please enter a job title first')
    setGenerating(true)
    const res = await fetch('/api/ai/generate-jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title, department: form.department,
        location: form.location, employmentType: form.employment_type,
        experienceMin: Number(form.experience_min), experienceMax: Number(form.experience_max),
        salaryMin: form.salary_min ? Number(form.salary_min) : undefined,
        salaryMax: form.salary_max ? Number(form.salary_max) : undefined,
      }),
    })
    const { description, requirements, niceToHave } = await res.json()
    setForm(f => ({ ...f, description, requirements, nice_to_have: niceToHave }))
    setGenerating(false)
  }

  async function save(publishStatus?: string) {
    setSaving(true)
    try {
      const payload: any = {
        ...form,
        skills,
        experience_min: Number(form.experience_min),
        experience_max: Number(form.experience_max),
        salary_min:     form.salary_min !== '' ? Number(form.salary_min) : null,
        salary_max:     form.salary_max !== '' ? Number(form.salary_max) : null,
        openings:       Number(form.openings) || 1,
      }
      if (publishStatus) payload.status = publishStatus

      await fetch(`/api/jobs/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      setSaved(true)
      router.refresh()
      router.push('/jobs')
    } catch (err: any) {
      alert(`Error saving: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  /** Reopen closed job → creates a BRAND NEW job (old closed record is preserved) */
  async function reopenAsNew() {
    setSaving(true)
    try {
      const payload = {
        ...form,
        skills,
        experience_min:   Number(form.experience_min),
        experience_max:   Number(form.experience_max),
        salary_min:       form.salary_min !== '' ? Number(form.salary_min) : null,
        salary_max:       form.salary_max !== '' ? Number(form.salary_max) : null,
        openings:         Number(form.openings) || 1,
        positions_filled: 0,          // fresh start
        status:           'active',
      }

      const res = await fetch('/api/jobs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to create new posting')

      router.push('/jobs')
    } catch (err: any) {
      alert(`Error reopening: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-8 max-w-3xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-1/3" />
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  )

  const isDraft  = origStatus === 'draft'
  const isClosed = origStatus === 'closed'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="text-gray-400 hover:text-gray-700 transition">
            <ArrowLeft size={20}/>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isDraft ? 'Edit Draft' : isClosed ? 'Edit Closed Job' : 'Edit Job Posting'}
            </h1>
            <p className="text-gray-500 text-sm">
              {isDraft
                ? 'Finish editing and publish when ready'
                : isClosed
                ? 'You can update details and reactivate this role'
                : 'Changes save immediately'}
            </p>
          </div>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle size={13}/> Saved
          </span>
        )}
      </div>

      {isClosed && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">⚠ This job is currently closed</p>
          <p>Edit the details below, then click <strong>"Reopen as New Post"</strong> — a fresh active posting will be created and the old closed record will be kept for history. Or use <strong>"Save Changes"</strong> to update only the closed record without reopening.</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title <span className="text-red-500">*</span></label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Senior ELV Engineer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select value={form.department} onChange={e => set('department', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {LOCATIONS.map(l => l.startsWith('──')
                  ? <option key={l} disabled style={{ color: '#9ca3af', fontWeight: 600 }}>{l}</option>
                  : <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {EMP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.experience_min} min={0} max={20}
                  onChange={e => set('experience_min', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                <span className="text-gray-400 text-sm">to</span>
                <input type="number" value={form.experience_max} min={0} max={30}
                  onChange={e => set('experience_max', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salary Range (LPA)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.salary_min} placeholder="Min"
                  onChange={e => set('salary_min', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                <span className="text-gray-400 text-sm">–</span>
                <input type="number" value={form.salary_max} placeholder="Max"
                  onChange={e => set('salary_max', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Openings
                <span className="ml-1.5 text-xs font-normal text-gray-400">Auto-closes when all positions are filled</span>
              </label>
              <input type="number" min={1} max={100} value={form.openings}
                onChange={e => set('openings', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
            </div>
            {!isDraft && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Positions Filled</label>
                <input type="number" min={0} max={form.openings} value={form.positions_filled}
                  onChange={e => set('positions_filled', Math.min(form.openings, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
            )}
          </div>
        </div>

        {/* Skills */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Required Skills</h2>
              <p className="text-xs text-gray-500 mt-0.5">Used for AI candidate matching and interview question generation</p>
            </div>
            {form.title && (
              <div className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                <Zap size={11}/> Auto-suggested for "{form.title}"
              </div>
            )}
          </div>
          <SkillPicker selected={skills} onChange={s => { setSkills(s); setSaved(false) }} jobTitle={form.title} />
        </div>

        {/* Job Description */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Job Description</h2>
            <button type="button" onClick={generateJD} disabled={generating}
              className="flex items-center gap-2 text-sm font-medium text-red-700 border border-red-200 px-3 py-1.5 rounded-lg transition disabled:opacity-60 hover:border-red-300">
              {generating ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>}
              {generating ? 'Generating…' : 'Regenerate with AI'}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={6} placeholder="Role overview and responsibilities…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
            <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)}
              rows={5} placeholder="Must-have qualifications…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nice to Have</label>
            <textarea value={form.nice_to_have} onChange={e => set('nice_to_have', e.target.value)}
              rows={3} placeholder="Preferred but not required…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"/>
          </div>
        </div>

        {/* Action buttons — vary by status */}
        <div className="flex gap-3">
          <Link href="/jobs"
            className="flex-1 text-center py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </Link>

          {/* Save changes (keep current status) */}
          <button onClick={() => save()} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-60">
            <Save size={15}/>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>

          {/* Status-specific primary action */}
          {isDraft && (
            <button onClick={() => save('active')} disabled={saving}
              className="flex-1 bg-red-700 hover:bg-red-800 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-60">
              {saving ? 'Publishing…' : 'Publish Job'}
            </button>
          )}
          {isClosed && (
            <button onClick={reopenAsNew} disabled={saving}
              className="flex-1 bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-60">
              {saving ? 'Creating New Post…' : '✦ Reopen as New Post'}
            </button>
          )}
          {origStatus === 'active' && (
            <button onClick={() => save('active')} disabled={saving}
              className="flex-1 bg-red-700 hover:bg-red-800 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-60">
              {saving ? 'Updating…' : 'Update & Keep Live'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
