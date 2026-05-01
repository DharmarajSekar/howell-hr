'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search, Star, MapPin, Phone, Mail, Users, Database, TrendingUp,
  UserPlus, Zap, RefreshCw, Upload, FileText, X, CheckCircle,
  Loader2, Heart, Copy, ChevronRight, AlertTriangle,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────
function sourceColor(source: string): string {
  if (!source) return 'bg-gray-100 text-gray-600'
  const s = source.toLowerCase()
  if (s.includes('linkedin'))    return 'bg-blue-100 text-blue-700'
  if (s.includes('naukri'))      return 'bg-orange-100 text-orange-700'
  if (s.includes('referral'))    return 'bg-emerald-100 text-emerald-700'
  if (s.includes('apply_link') || s.includes('direct')) return 'bg-purple-100 text-purple-700'
  if (s.includes('portal_sync') || s.includes('portal')) return 'bg-teal-100 text-teal-700'
  if (s.includes('indeed'))      return 'bg-indigo-100 text-indigo-700'
  if (s.includes('jsearch'))     return 'bg-green-100 text-green-700'
  if (s.includes('zip'))         return 'bg-cyan-100 text-cyan-700'
  return 'bg-gray-100 text-gray-600'
}

function sourceLabel(source: string): string {
  if (!source) return 'Unknown'
  const s = source.toLowerCase()
  if (s === 'portal_sync_linkedin')     return '🔗 LinkedIn'
  if (s === 'portal_sync_indeed')       return '🔗 Indeed'
  if (s === 'portal_sync_ziprecruiter') return '🔗 ZipRecruiter'
  if (s.startsWith('portal_sync_'))     return '🔗 ' + source.replace('portal_sync_','').replace(/_/g,' ')
  if (s.includes('portal sync'))        return '🔗 Portal'
  if (s === 'referral')                 return '🤝 Referral'
  if (s === 'direct')                   return '📩 Direct Apply'
  return source
}

function isPortalSourced(source: string): boolean {
  const s = (source || '').toLowerCase()
  return s.includes('portal_sync') || s.includes('portal sync') || s.startsWith('portal_sync')
}

// ── Component ─────────────────────────────────────────────────
export default function TalentPoolClient() {
  const [candidates,   setCandidates]   = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [jobs,         setJobs]         = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null)

  const [search,    setSearch]    = useState('')
  const [source,    setSource]    = useState('all')
  const [selected,  setSelected]  = useState<any>(null)

  // AI Match for Role modal
  const [showMatch, setShowMatch] = useState(false)
  const [matchJob,  setMatchJob]  = useState('')

  // Similar candidates
  const [showSimilar,   setShowSimilar]   = useState(false)
  const [similarTarget, setSimilarTarget] = useState<any>(null)

  // Referral modal
  const [showReferral,   setShowReferral]   = useState(false)
  const [referralForm,   setReferralForm]   = useState({
    full_name: '', email: '', phone: '', current_title: '',
    current_company: '', experience_years: '', skills: '',
    location: '', referred_by: '', referral_notes: '', job_id: '',
  })
  const [referralSaving,  setReferralSaving]  = useState(false)
  const [referralSuccess, setReferralSuccess] = useState(false)

  // Resume parse modal
  const [showResumeParse, setShowResumeParse] = useState(false)
  const [resumeText,      setResumeText]      = useState('')
  const [parsedData,      setParsedData]      = useState<any>(null)
  const [parsing,         setParsing]         = useState(false)
  const [parseSaveStatus, setParseSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [parseError,      setParseError]      = useState('')

  // ── Data Load ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/talent-pool-data', { cache: 'no-store' })
      const data = await res.json()
      setCandidates(data.candidates   || [])
      setApplications(data.applications || [])
      setJobs(data.jobs               || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to load talent pool data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const appMap = useMemo(() => {
    const m: Record<string, any[]> = {}
    applications.forEach((a: any) => {
      if (!m[a.candidate_id]) m[a.candidate_id] = []
      m[a.candidate_id].push(a)
    })
    return m
  }, [applications])

  // ── Filtered list ─────────────────────────────────────────
  const filtered = useMemo(() => candidates.filter((c: any) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.full_name?.toLowerCase().includes(q) ||
      c.current_title?.toLowerCase().includes(q) ||
      c.current_company?.toLowerCase().includes(q) ||
      (c.skills || []).some((s: string) => s.toLowerCase().includes(q))
    const src = (c.source || '').toLowerCase()
    const matchSource =
      source === 'all'        ? true :
      source === 'portal'     ? isPortalSourced(c.source) :
      source === 'linkedin'   ? src.includes('linkedin') :
      source === 'naukri'     ? src.includes('naukri') :
      source === 'referral'   ? src.includes('referral') :
      source === 'apply_link' ? src.includes('apply_link') || src.includes('direct') :
      c.source === source
    return matchSearch && matchSource
  }), [candidates, search, source])

  // ── AI Match for Role ─────────────────────────────────────
  const matchedCandidates = useMemo(() => {
    if (!matchJob) return []
    const job = jobs.find((j: any) => j.id === matchJob)
    if (!job) return []
    const jobText = `${job.title} ${job.requirements || ''} ${job.description || ''}`.toLowerCase()
    return candidates.map((c: any) => {
      const skills     = (c.skills || [])
      const matchCount = skills.filter((s: string) => jobText.includes(s.toLowerCase())).length
      const expMatch   = c.experience_years >= (job.experience_min || 0)
      const score      = Math.min(98, (matchCount * 15) + (expMatch ? 20 : 0) + Math.floor(Math.random() * 10) + 40)
      return { ...c, matchScore: score }
    }).sort((a: any, b: any) => b.matchScore - a.matchScore).slice(0, 8)
  }, [matchJob, candidates, jobs])

  // ── Similar Candidates ────────────────────────────────────
  const similarCandidates = useMemo(() => {
    if (!similarTarget) return []
    const targetSkills = (similarTarget.skills || []).map((s: string) => s.toLowerCase())
    const targetTitle  = (similarTarget.current_title || '').toLowerCase()

    return candidates
      .filter((c: any) => c.id !== similarTarget.id)
      .map((c: any) => {
        const cSkills   = (c.skills || []).map((s: string) => s.toLowerCase())
        const overlap   = cSkills.filter((s: string) => targetSkills.includes(s)).length
        const titleSim  = targetTitle && c.current_title &&
          (c.current_title.toLowerCase().includes(targetTitle.split(' ')[0]) ||
           targetTitle.includes(c.current_title.toLowerCase().split(' ')[0]))
        const expDiff   = Math.abs((c.experience_years || 0) - (similarTarget.experience_years || 0))
        const score     = Math.min(98, (overlap * 18) + (titleSim ? 20 : 0) + (expDiff <= 2 ? 10 : 0))
        return { ...c, similarScore: score }
      })
      .filter((c: any) => c.similarScore > 20)
      .sort((a: any, b: any) => b.similarScore - a.similarScore)
      .slice(0, 6)
  }, [similarTarget, candidates])

  // ── Referral Submit ───────────────────────────────────────
  async function submitReferral() {
    if (!referralForm.full_name || !referralForm.referred_by) return
    setReferralSaving(true)
    try {
      const skillsArr = referralForm.skills
        ? referralForm.skills.split(',').map(s => s.trim()).filter(Boolean)
        : []
      const res = await fetch('/api/talent-pool/add-referral', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...referralForm,
          experience_years: parseInt(referralForm.experience_years) || 0,
          skills:           skillsArr,
          job_id:           referralForm.job_id || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setReferralSuccess(true)
        setTimeout(() => {
          setShowReferral(false)
          setReferralSuccess(false)
          setReferralForm({ full_name:'', email:'', phone:'', current_title:'', current_company:'', experience_years:'', skills:'', location:'', referred_by:'', referral_notes:'', job_id:'' })
          loadData()
        }, 1800)
      }
    } finally {
      setReferralSaving(false)
    }
  }

  // ── Resume Parse ──────────────────────────────────────────
  async function parseResume() {
    if (!resumeText.trim()) return
    setParsing(true)
    setParsedData(null)
    setParseError('')
    try {
      const res  = await fetch('/api/ai/parse-resume', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resumeText }),
      })
      const data = await res.json()
      if (data.error) { setParseError(data.error); return }
      setParsedData({ ...data, resume_text: resumeText })
    } catch (e: any) {
      setParseError('Failed to parse resume. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  async function saveParsedCandidate() {
    if (!parsedData) return
    setParseSaveStatus('saving')
    try {
      const res  = await fetch('/api/talent-pool/save-parsed', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(parsedData),
      })
      const data = await res.json()
      if (data.success) {
        setParseSaveStatus('saved')
        setTimeout(() => {
          setShowResumeParse(false)
          setResumeText('')
          setParsedData(null)
          setParseSaveStatus('idle')
          loadData()
        }, 1800)
      } else {
        setParseSaveStatus('error')
      }
    } catch {
      setParseSaveStatus('error')
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setResumeText(text || '')
    }
    reader.readAsText(file)
  }

  const portalCount   = candidates.filter((c: any) => isPortalSourced(c.source)).length
  const referralCount = candidates.filter((c: any) => (c.source || '').toLowerCase().includes('referral')).length

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Talent Pool</h1>
          <p className="text-sm text-gray-500 mt-0.5">Central repository — applicants, sourced profiles &amp; referrals</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">Updated {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh
          </button>
          <button onClick={() => { setShowResumeParse(true); setResumeText(''); setParsedData(null); setParseError('') }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            <Upload size={16}/> AI Resume Parse
          </button>
          <button onClick={() => { setShowReferral(true); setReferralSuccess(false) }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            <Heart size={16}/> Refer a Candidate
          </button>
          <button onClick={() => setShowMatch(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            <Zap size={16}/> AI Match for Role
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total Profiles',  value: loading ? '…' : candidates.length,   icon: Database,   color:'text-gray-700 bg-white' },
          { label:'Portal Sourced',  value: loading ? '…' : portalCount,          icon: Users,      color:'text-teal-700 bg-teal-50' },
          { label:'Referrals',       value: loading ? '…' : referralCount,         icon: Heart,      color:'text-emerald-700 bg-emerald-50' },
          { label:'Avg Experience',  value: loading ? '…' : (candidates.length ? Math.round(candidates.reduce((s:number,c:any)=>s+(c.experience_years||0),0)/candidates.length)+'y' : '—'), icon: TrendingUp, color:'text-purple-700 bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-3`}>
            <s.icon size={20} className="flex-shrink-0"/>
            <div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, title, company, or skill…"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
              <X size={14}/>
            </button>
          )}
        </div>
        <select value={source} onChange={e => setSource(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="all">All Sources</option>
          <option value="portal">🔗 Portal Sourced</option>
          <option value="linkedin">LinkedIn</option>
          <option value="naukri">Naukri</option>
          <option value="referral">🤝 Referrals</option>
          <option value="apply_link">📩 Direct Apply</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw size={28} className="animate-spin text-red-700 mr-3"/>
          <span className="text-gray-500 text-sm">Loading candidates…</span>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-6">
          {/* Candidate list */}
          <div className="col-span-2 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            <p className="text-xs text-gray-500 mb-2">{filtered.length} profiles</p>
            {filtered.length === 0 && (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Database size={28} className="mx-auto text-gray-300 mb-2"/>
                <p className="text-sm text-gray-500">
                  {source === 'portal'
                    ? 'No portal-sourced candidates yet. Go to AI Sourcing → AI Profile Sync.'
                    : source === 'referral'
                    ? 'No referrals yet. Click "Refer a Candidate" to add one.'
                    : 'No candidates match your filter.'}
                </p>
              </div>
            )}
            {filtered.map((c: any) => {
              const apps = appMap[c.id] || []
              return (
                <div key={c.id} onClick={() => setSelected(c)}
                  className={`bg-white border rounded-xl p-3.5 cursor-pointer transition ${selected?.id===c.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                      {c.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-gray-900 truncate">{c.full_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${sourceColor(c.source)}`}>{sourceLabel(c.source)}</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{c.current_title} · {c.current_company}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{c.experience_years}y exp</span>
                        {c.location && <span className="flex items-center gap-0.5"><MapPin size={10}/>{c.location}</span>}
                        {apps.length > 0 && <span className="text-blue-500">{apps.length} application{apps.length>1?'s':''}</span>}
                        {c.referred_by && <span className="text-emerald-600 font-medium">Ref: {c.referred_by}</span>}
                      </div>
                    </div>
                  </div>
                  {(c.skills || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(c.skills || []).slice(0, 4).map((s: string) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                      {(c.skills || []).length > 4 && <span className="text-xs text-gray-400">+{(c.skills||[]).length-4}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Candidate detail */}
          <div className="col-span-3">
            {selected ? (
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-xl flex-shrink-0">
                      {selected.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h2 className="font-bold text-lg text-gray-900">{selected.full_name}</h2>
                      <p className="text-sm text-gray-600">{selected.current_title} at {selected.current_company}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                        {selected.location && <span className="flex items-center gap-1"><MapPin size={11}/>{selected.location}</span>}
                        <span>{selected.experience_years} years exp</span>
                        {selected.salary_expectation > 0 && <span>₹{selected.salary_expectation} LPA expected</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${sourceColor(selected.source)}`}>{sourceLabel(selected.source)}</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Contact */}
                  <div className="grid grid-cols-2 gap-3">
                    {selected.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5">
                        <Mail size={14} className="text-gray-400 flex-shrink-0"/>
                        <span className="truncate">{selected.email}</span>
                      </div>
                    )}
                    {selected.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5">
                        <Phone size={14} className="text-gray-400 flex-shrink-0"/>
                        <span>{selected.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Referral info — show if referred */}
                  {selected.referred_by && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Heart size={13} className="text-emerald-600"/>
                        <span className="text-xs font-bold text-emerald-700 uppercase">Employee Referral</span>
                      </div>
                      <div className="text-sm text-emerald-800">
                        Referred by <strong>{selected.referred_by}</strong>
                        {selected.referral_date && (
                          <span className="text-xs text-emerald-600 ml-2">
                            on {new Date(selected.referral_date).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                      {selected.referral_notes && (
                        <p className="text-xs text-emerald-700 mt-1 italic">"{selected.referral_notes}"</p>
                      )}
                    </div>
                  )}

                  {/* AI Summary */}
                  {selected.summary && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">AI Summary</h3>
                      <p className="text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-lg p-3">{selected.summary}</p>
                    </div>
                  )}

                  {/* Skills */}
                  {(selected.skills || []).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(selected.skills || []).map((s: string) => (
                          <span key={s} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Applications */}
                  {(appMap[selected.id] || []).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Applications</h3>
                      <div className="space-y-1.5">
                        {(appMap[selected.id] || []).map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5 text-sm">
                            <span className="text-gray-700">{a.job?.title || 'Unknown Role'}</span>
                            <div className="flex items-center gap-2">
                              {a.ai_match_score > 0 && <span className="text-xs font-bold text-green-600">{a.ai_match_score}%</span>}
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{a.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Similar Candidates CTA */}
                  <button
                    onClick={() => { setSimilarTarget(selected); setShowSimilar(true) }}
                    className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-xl text-sm font-medium transition">
                    <Copy size={14}/> Find Similar Candidates
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
                <Database size={40} className="mx-auto text-gray-300 mb-3"/>
                <p className="text-gray-400">Select a candidate to view their full profile</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AI Match for Role Modal ─────────────────────────── */}
      {showMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">AI Talent Match</h2>
                <p className="text-sm text-gray-500 mt-0.5">Best candidates from your talent pool for a role</p>
              </div>
              <button onClick={() => { setShowMatch(false); setMatchJob('') }} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Job Role</label>
                <select value={matchJob} onChange={e => setMatchJob(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Select a job posting…</option>
                  {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.title} — {j.department}</option>)}
                </select>
              </div>
              {matchJob && matchedCandidates.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  <p className="text-xs text-gray-500 mb-2">Top {matchedCandidates.length} AI-matched candidates</p>
                  {matchedCandidates.map((c: any, i: number) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-sm font-bold text-gray-400 w-5">#{i+1}</span>
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                        {c.full_name?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{c.full_name}</div>
                        <div className="text-xs text-gray-500">{c.current_title} · {c.experience_years}y · {sourceLabel(c.source)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${c.matchScore>=80?'text-green-600':c.matchScore>=65?'text-yellow-600':'text-gray-500'}`}>{c.matchScore}%</div>
                        <div className="text-xs text-gray-400">match</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {matchJob && matchedCandidates.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">No candidates in pool yet. Source some profiles first.</div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100">
              <button onClick={() => { setShowMatch(false); setMatchJob('') }}
                className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Similar Candidates Modal ────────────────────────── */}
      {showSimilar && similarTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Similar Candidates</h2>
                <p className="text-sm text-gray-500 mt-0.5">Profiles similar to <strong>{similarTarget.full_name}</strong></p>
              </div>
              <button onClick={() => setShowSimilar(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="p-6">
              {similarCandidates.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  No similar profiles found in your current talent pool.
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-3">{similarCandidates.length} similar profiles found</p>
                  {similarCandidates.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {c.full_name?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{c.full_name}</div>
                        <div className="text-xs text-gray-500">{c.current_title} · {c.experience_years}y · {c.location}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(c.skills || []).slice(0, 3).map((s: string) => (
                            <span key={s} className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${c.similarScore>=70?'text-green-600':c.similarScore>=50?'text-yellow-600':'text-gray-500'}`}>{c.similarScore}%</div>
                        <div className="text-xs text-gray-400">similar</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100">
              <button onClick={() => setShowSimilar(false)}
                className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refer a Candidate Modal ─────────────────────────── */}
      {showReferral && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Refer a Candidate</h2>
                <p className="text-sm text-gray-500 mt-0.5">Add someone from your network to the talent pool</p>
              </div>
              <button onClick={() => setShowReferral(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>

            {referralSuccess ? (
              <div className="p-12 text-center">
                <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3"/>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Referral Submitted!</h3>
                <p className="text-sm text-gray-500">The candidate has been added to the talent pool.</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
                  <strong>Referral tracking is on.</strong> The candidate will be tagged with your name and visible in the Referrals filter.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Candidate Name <span className="text-red-500">*</span></label>
                    <input value={referralForm.full_name} onChange={e => setReferralForm(f=>({...f, full_name: e.target.value}))}
                      placeholder="Full name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Referred By <span className="text-red-500">*</span></label>
                    <input value={referralForm.referred_by} onChange={e => setReferralForm(f=>({...f, referred_by: e.target.value}))}
                      placeholder="Your name / employee name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                    <input value={referralForm.email} onChange={e => setReferralForm(f=>({...f, email: e.target.value}))}
                      placeholder="candidate@email.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
                    <input value={referralForm.phone} onChange={e => setReferralForm(f=>({...f, phone: e.target.value}))}
                      placeholder="+91 98765 43210"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current Title</label>
                    <input value={referralForm.current_title} onChange={e => setReferralForm(f=>({...f, current_title: e.target.value}))}
                      placeholder="e.g. Senior ELV Engineer"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current Company</label>
                    <input value={referralForm.current_company} onChange={e => setReferralForm(f=>({...f, current_company: e.target.value}))}
                      placeholder="e.g. Siemens"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Experience (years)</label>
                    <input type="number" value={referralForm.experience_years} onChange={e => setReferralForm(f=>({...f, experience_years: e.target.value}))}
                      placeholder="e.g. 5"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location</label>
                    <input value={referralForm.location} onChange={e => setReferralForm(f=>({...f, location: e.target.value}))}
                      placeholder="e.g. Mumbai"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Key Skills (comma-separated)</label>
                  <input value={referralForm.skills} onChange={e => setReferralForm(f=>({...f, skills: e.target.value}))}
                    placeholder="e.g. BMS, ELV, CCTV, AutoCAD"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Referring for Role (optional)</label>
                  <select value={referralForm.job_id} onChange={e => setReferralForm(f=>({...f, job_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="">General talent pool (no specific role)</option>
                    {jobs.filter((j:any)=>j.status==='active').map((j: any) => (
                      <option key={j.id} value={j.id}>{j.title} — {j.department}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Why are you referring this person?</label>
                  <textarea value={referralForm.referral_notes} onChange={e => setReferralForm(f=>({...f, referral_notes: e.target.value}))}
                    rows={3} placeholder="e.g. Worked with them at Siemens for 3 years — excellent BMS engineer, very professional."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"/>
                </div>

                <button onClick={submitReferral}
                  disabled={referralSaving || !referralForm.full_name || !referralForm.referred_by}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-bold transition disabled:opacity-60">
                  {referralSaving ? <><Loader2 size={15} className="animate-spin"/> Submitting…</> : <><Heart size={15}/> Submit Referral</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AI Resume Parse Modal ───────────────────────────── */}
      {showResumeParse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">AI Resume Analyser</h2>
                <p className="text-sm text-gray-500 mt-0.5">Paste resume text — AI extracts name, contact, skills, experience, salary &amp; location</p>
              </div>
              <button onClick={() => setShowResumeParse(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>

            <div className="p-6 space-y-4">
              {!parsedData ? (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition">
                      <Upload size={13}/> Upload .txt file
                      <input type="file" accept=".txt,.text" onChange={handleFileUpload} className="hidden"/>
                    </label>
                    <span className="text-xs text-gray-400">or paste resume text below</span>
                  </div>
                  <textarea
                    value={resumeText}
                    onChange={e => setResumeText(e.target.value)}
                    rows={12}
                    placeholder={`Paste the candidate's resume text here…\n\nExample:\nJohn Smith\njohn.smith@email.com | +91 98765 43210 | Mumbai\n\nSenior ELV Engineer at Siemens (2019–present)\n• 6 years experience in BMS, CCTV, Access Control\n• Skills: AutoCAD, Honeywell, Lenel, Structured Cabling\n• Salary expectation: ₹18 LPA`}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
                  {parseError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <AlertTriangle size={14}/>{parseError}
                    </div>
                  )}
                  <button onClick={parseResume}
                    disabled={parsing || resumeText.trim().length < 30}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold transition disabled:opacity-60">
                    {parsing ? <><Loader2 size={15} className="animate-spin"/> Analysing with AI…</> : <><Zap size={15}/> Analyse Resume with AI</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-2.5">
                    <CheckCircle size={16} className="text-blue-600 flex-shrink-0"/>
                    <span className="text-sm text-blue-700 font-medium">AI extracted the following information. Review and save to talent pool.</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label:'Full Name',       key:'full_name' },
                      { label:'Email',           key:'email' },
                      { label:'Phone',           key:'phone' },
                      { label:'Current Title',   key:'current_title' },
                      { label:'Current Company', key:'current_company' },
                      { label:'Experience (yrs)', key:'experience_years', type:'number' },
                      { label:'Location',        key:'location' },
                      { label:'Salary Exp (LPA)', key:'salary_expectation', type:'number' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{field.label}</label>
                        <input
                          type={field.type || 'text'}
                          value={parsedData[field.key] || ''}
                          onChange={e => setParsedData((d: any) => ({ ...d, [field.key]: field.type === 'number' ? parseFloat(e.target.value)||0 : e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </div>
                    ))}
                  </div>

                  {/* Skills */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Extracted Skills</label>
                    <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200 min-h-[44px]">
                      {(parsedData.skills || []).map((s: string) => (
                        <span key={s} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">
                          {s}
                          <button onClick={() => setParsedData((d: any) => ({ ...d, skills: d.skills.filter((sk: string) => sk !== s) }))}
                            className="text-blue-400 hover:text-blue-700 ml-0.5"><X size={10}/></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">AI Summary</label>
                    <textarea
                      value={parsedData.summary || ''}
                      onChange={e => setParsedData((d: any) => ({ ...d, summary: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => { setParsedData(null); setParseError('') }}
                      className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                      ← Re-parse
                    </button>
                    <button onClick={saveParsedCandidate}
                      disabled={parseSaveStatus === 'saving' || parseSaveStatus === 'saved'}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition ${
                        parseSaveStatus === 'saved' ? 'bg-green-600 text-white' :
                        parseSaveStatus === 'error' ? 'bg-red-600 text-white' :
                        'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
                      }`}>
                      {parseSaveStatus === 'saving' ? <><Loader2 size={15} className="animate-spin"/> Saving…</> :
                       parseSaveStatus === 'saved'  ? <><CheckCircle size={15}/> Saved to Talent Pool!</> :
                       parseSaveStatus === 'error'  ? 'Save Failed — Retry' :
                       <><Database size={15}/> Add to Talent Pool</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
