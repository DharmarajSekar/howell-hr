'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, ArrowLeft, Zap } from 'lucide-react'
import Link from 'next/link'
import SkillPicker from '@/components/jobs/SkillPicker'
import { suggestCategoriesForTitle } from '@/lib/skill-master'

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

export default function NewJobPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '', department: DEPARTMENTS[0], location: LOCATIONS[1],
    employment_type: EMP_TYPES[0], experience_min: 3, experience_max: 7,
    salary_min: '', salary_max: '',
    description: '', requirements: '', nice_to_have: '',
    status: 'active',
  })
  const [skills,     setSkills]     = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving,     setSaving]     = useState(false)

  function set(key: string, val: any) {
    setForm(f => ({ ...f, [key]: val }))
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          skills,
          experience_min: Number(form.experience_min),
          experience_max: Number(form.experience_max),
          salary_min: form.salary_min ? Number(form.salary_min) : undefined,
          salary_max: form.salary_max ? Number(form.salary_max) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Failed to publish job: ${err.error || res.statusText}`)
        setSaving(false)
        return
      }
      // Bust Next.js router cache so /jobs re-fetches from DB
      router.refresh()
      router.push('/jobs')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/jobs" className="text-gray-400 hover:text-gray-700 transition">
          <ArrowLeft size={20}/>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Job Posting</h1>
          <p className="text-gray-500 text-sm">Use AI to generate a compelling job description</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Basic Info ───────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title <span className="text-red-500">*</span></label>
              <input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Senior ELV Engineer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                required/>
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
                  : <option key={l}>{l}</option>
                )}
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
          </div>
        </div>

        {/* ── Required Skills ──────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Required Skills</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Pick from the master or type a custom skill. Skills are used for AI candidate matching, sourcing queries, and interview question generation.
              </p>
            </div>
            {form.title && (
              <div className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                <Zap size={11}/> Auto-suggested for "{form.title}"
              </div>
            )}
          </div>

          <SkillPicker
            selected={skills}
            onChange={setSkills}
            jobTitle={form.title}
          />
        </div>

        {/* ── Job Description ──────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Job Description</h2>
            <button
              type="button"
              onClick={generateJD}
              disabled={generating}
              className="flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition disabled:opacity-60">
              {generating ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>}
              {generating ? 'Generating…' : 'Generate with AI'}
            </button>
          </div>

          {generating && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-red-700 flex items-center gap-2">
              <Loader2 size={15} className="animate-spin"/> AI is writing your job description…
            </div>
          )}

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

        <div className="flex gap-3">
          <Link href="/jobs"
            className="flex-1 text-center py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 bg-red-700 hover:bg-red-800 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-60">
            {saving ? 'Publishing…' : `Publish Job${skills.length > 0 ? ` · ${skills.length} skills` : ''}`}
          </button>
        </div>
      </form>
    </div>
  )
}
