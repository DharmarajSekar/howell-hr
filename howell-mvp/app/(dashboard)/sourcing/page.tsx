'use client'
import { useState, useEffect } from 'react'
import { Globe, Search, Zap, CheckCircle, Clock, Send, RefreshCw, User, MapPin, TrendingUp, BarChart2, AlertTriangle, Database, Archive, X } from 'lucide-react'

const PORTALS = [
  { id:'linkedin', name:'LinkedIn',           logo:'🔵', connected: false, pendingApproval: true  },
  { id:'indeed',   name:'Indeed',             logo:'🔷', connected: false, pendingApproval: true  },
  { id:'adzuna',   name:'Adzuna',             logo:'🟠', connected: true,  pendingApproval: false },
  { id:'jsearch',  name:'JSearch (RapidAPI)', logo:'🟢', connected: true,  pendingApproval: false },
]

type Job = {
  id: string; title: string; department: string; location: string
  status: string; requirements?: string; description?: string
}

type Profile = {
  id: string; name: string; title: string; location: string
  experience: string; skills: string[]; source: string; matchScore: number
  summary: string; email: string; phone: string; education: string
}

type MarketJob = {
  id: string; title: string; company: string; location: string
  salary_min: number; salary_max: number; description: string; created: string; source: string
}

// Extract searchable keywords from a job object
function buildQueryFromJob(job: Job): string {
  const base = job.title || ''
  const reqText = ((job.requirements || '') + ' ' + (job.description || '')).toUpperCase()
  const SKILLS = ['BMS','ELV','CCTV','PMP','SQL','PYTHON','AUTOCAD','HRBP','SAP','WORKDAY',
    'AGILE','SCRUM','BICSI','POSH','ISO','POWER BI','MS PROJECT','LENEL','GENETEC','HONEYWELL',
    'SIEMENS','ACCESS CONTROL','STRUCTURED CABLING','FIRE ALARM','HVAC','MEP','EPC','HRMS']
  const found = SKILLS.filter(s => reqText.includes(s)).slice(0, 4)
  return [base, ...found].join(' ').trim()
}

export default function SourcingPage() {
  const [activeTab, setActiveTab]             = useState<'distribute'|'profiles'|'market'>('distribute')

  // Jobs from Supabase
  const [jobs, setJobs]                       = useState<Job[]>([])
  const [loadingJobs, setLoadingJobs]         = useState(true)
  const [selectedJob, setSelectedJob]         = useState<Job | null>(null)

  // Distribution
  const [distributed, setDistributed]         = useState<Record<string, boolean>>({})
  const [distributing, setDistributing]       = useState(false)

  // Profile tab
  const [searchQuery, setSearchQuery]         = useState('')
  const [searchLocation, setSearchLocation]   = useState('')
  const [profiles, setProfiles]               = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [profileSource, setProfileSource]     = useState<'mock'|'live'|null>(null)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [synced, setSynced]                   = useState<Record<string, 'syncing'|'done'|'error'>>({})
  const [bulkSaveStatus, setBulkSaveStatus]   = useState<{saved:number;failed:number;total:number;done:boolean;errors?:string[]}|null>(null)
  const [shortlisted, setShortlisted]         = useState<Set<string>>(new Set())

  // Source mode: external AI fetch vs internal DB search
  const [sourceMode, setSourceMode]           = useState<'external'|'internal'>('external')

  // Market tab
  const [marketQuery, setMarketQuery]         = useState('')
  const [marketJobs, setMarketJobs]           = useState<MarketJob[]>([])
  const [loadingMarket, setLoadingMarket]     = useState(false)
  const [salaryData, setSalaryData]           = useState<any>(null)
  const [marketSource, setMarketSource]       = useState<'mock'|'live'|null>(null)

  // ── Load real jobs from Supabase on mount ──
  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then(data => {
        const jobList: Job[] = data.jobs || data || []
        setJobs(jobList)
        if (jobList.length > 0) {
          setSelectedJob(jobList[0])
          setSearchQuery(buildQueryFromJob(jobList[0]))
          setMarketQuery(jobList[0].title)
        }
      })
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false))
  }, [])

  // ── Auto-update search query when job selection changes ──
  function selectJob(job: Job) {
    setSelectedJob(job)
    setSearchQuery(buildQueryFromJob(job))
    setMarketQuery(job.title)
    setProfiles([])
    setSelectedProfile(null)
    setProfileSource(null)
  }

  async function distributeJob() {
    if (!selectedJob) return
    setDistributing(true)
    await new Promise(r => setTimeout(r, 1800))
    const dist: Record<string, boolean> = {}
    PORTALS.forEach(p => { dist[`${selectedJob.id}-${p.id}`] = !p.pendingApproval })
    setDistributed(prev => ({ ...prev, ...dist }))
    setDistributing(false)
  }

  async function fetchProfiles() {
    setLoadingProfiles(true)
    setSelectedProfile(null)
    setBulkSaveStatus(null)
    try {
      const q = searchQuery || selectedJob?.title || 'engineer'
      const res = await fetch(`/api/portals/jsearch?query=${encodeURIComponent(q)}&location=${encodeURIComponent(searchLocation)}`)
      const data = await res.json()
      const fetchedProfiles: Profile[] = data.profiles || []
      setProfiles(fetchedProfiles)
      setProfileSource(data.source)

      // ── AUTO-SAVE ALL FETCHED PROFILES TO SUPABASE IMMEDIATELY ──
      if (fetchedProfiles.length > 0) {
        setBulkSaveStatus({ saved: 0, total: fetchedProfiles.length, done: false })
        try {
          const syncRes = await fetch('/api/portals/save-profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profiles: fetchedProfiles,
              jobId: selectedJob?.id || null,
            }),
          })
          const syncData = await syncRes.json()
          setBulkSaveStatus({
            saved:  syncData.saved  || 0,
            failed: syncData.failed || 0,
            total:  fetchedProfiles.length,
            done:   true,
            errors: syncData.errors,
          })

          // Mark all as auto-synced
          const autoSynced: Record<string, 'done'> = {}
          fetchedProfiles.forEach(p => { autoSynced[p.id] = 'done' })
          setSynced(prev => ({ ...prev, ...autoSynced }))
        } catch (e: any) {
          setBulkSaveStatus({ saved: 0, failed: fetchedProfiles.length, total: fetchedProfiles.length, done: true, errors: [e?.message || 'Network error calling bulk-sync'] })
        }
      }
    } catch {
      setProfiles([])
    } finally {
      setLoadingProfiles(false)
    }
  }

  async function fetchInternalProfiles() {
    setLoadingProfiles(true)
    setSelectedProfile(null)
    setBulkSaveStatus(null)
    try {
      const q = searchQuery || selectedJob?.title || 'engineer'
      const jobParam = selectedJob?.id ? `&jobId=${selectedJob.id}` : ''
      const res = await fetch(`/api/portals/internal-search?query=${encodeURIComponent(q)}${jobParam}&limit=30`)
      const data = await res.json()
      const fetchedProfiles: Profile[] = (data.profiles || []).map((p: any) => ({
        ...p,
        id:         p.id,
        name:       p.name,
        title:      p.title,
        location:   p.location,
        experience: p.experience,
        skills:     p.skills || [],
        source:     p.source || 'Internal DB',
        matchScore: p.matchScore || 0,
        summary:    p.summary || '',
        email:      p.email || '',
        phone:      p.phone || '',
        education:  p.education || '',
      }))
      setProfiles(fetchedProfiles)
      setProfileSource('live') // internal DB is always "live"
    } catch {
      setProfiles([])
    } finally {
      setLoadingProfiles(false)
    }
  }

  async function syncToHRMS(profile: Profile) {
    if (!selectedJob) return
    setSynced(prev => ({ ...prev, [profile.id]: 'syncing' }))
    try {
      const res = await fetch('/api/portals/sync-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          jobId: selectedJob.id,
          matchScore: profile.matchScore,
        }),
      })
      const data = await res.json()
      setSynced(prev => ({ ...prev, [profile.id]: data.success ? 'done' : 'error' }))
    } catch {
      setSynced(prev => ({ ...prev, [profile.id]: 'error' }))
    }
  }

  async function fetchMarketData() {
    setLoadingMarket(true)
    const q = marketQuery || selectedJob?.title || 'engineer'
    try {
      const [jobsRes, salaryRes] = await Promise.all([
        fetch(`/api/portals/adzuna?q=${encodeURIComponent(q)}&l=Mumbai&type=jobs`),
        fetch(`/api/portals/adzuna?q=${encodeURIComponent(q)}&l=Mumbai&type=salary`),
      ])
      const [jobsData, salaryData] = await Promise.all([jobsRes.json(), salaryRes.json()])
      setMarketJobs(jobsData.results || [])
      setSalaryData(salaryData.data || null)
      setMarketSource(jobsData.source)
    } catch {
      setMarketJobs([])
    } finally {
      setLoadingMarket(false)
    }
  }

  const isJobDistributed = selectedJob ? PORTALS.some(p => distributed[`${selectedJob.id}-${p.id}`]) : false

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Talent Sourcing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Distribute your jobs, fetch AI-matched candidates, and analyse the market — across LinkedIn, Indeed, Adzuna & more</p>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded-xl text-sm font-medium">
          <Zap size={14}/> AI Sourcing Active · 4 Portals
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          ['distribute','🚀 Job Distribution'],
          ['profiles','🤖 AI Profile Sync'],
          ['market','📊 Market Intelligence'],
        ].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k as any)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${activeTab===k?'border-red-700 text-red-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Job Distribution ── */}
      {activeTab === 'distribute' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Job list from Supabase */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Your Job Postings</h3>
              {loadingJobs && <RefreshCw size={13} className="text-gray-400 animate-spin"/>}
            </div>
            {loadingJobs ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="bg-gray-100 rounded-xl h-16 animate-pulse"/>)}
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                <p className="text-xs text-gray-400">No jobs found. Create a job posting first at <strong>/jobs</strong></p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map(j => (
                  <div key={j.id} onClick={() => selectJob(j)}
                    className={`bg-white border rounded-xl p-3.5 cursor-pointer transition ${selectedJob?.id===j.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                    <div className="font-medium text-sm text-gray-900">{j.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{j.department} · {j.location}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${j.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{j.status}</span>
                      {distributed[`${j.id}-adzuna`] && (
                        <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={10}/> Distributed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Portal distribution panel */}
          <div className="col-span-2">
            {selectedJob ? (
              <>
                <h3 className="font-semibold text-gray-900 text-sm mb-3">
                  Distribute to Portals — <span className="text-red-700">{selectedJob.title}</span>
                </h3>

                {/* AI query preview */}
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-4 flex items-start gap-2.5">
                  <Zap size={14} className="text-purple-500 flex-shrink-0 mt-0.5"/>
                  <div>
                    <div className="text-xs font-semibold text-purple-700 mb-0.5">AI Search Query Built from JD</div>
                    <div className="text-xs text-gray-700 font-mono bg-white border border-purple-100 rounded px-2 py-1">{searchQuery || buildQueryFromJob(selectedJob)}</div>
                    <div className="text-xs text-purple-500 mt-1">This query will be used to fetch matching candidates in AI Profile Sync →</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  {PORTALS.map(p => {
                    const isDone = distributed[`${selectedJob.id}-${p.id}`]
                    return (
                      <div key={p.id} className={`bg-white border rounded-xl p-4 shadow-sm ${isDone?'border-green-200 bg-green-50':p.pendingApproval?'border-orange-100 bg-orange-50':'border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xl">{p.logo}</span>
                          <div>
                            <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                            <div className={`text-xs font-medium ${isDone?'text-green-600':p.pendingApproval?'text-orange-600':'text-blue-600'}`}>
                              {isDone ? '✓ Job Posted' : p.pendingApproval ? '⏳ Awaiting Partner Approval' : '✓ Connected · Ready'}
                            </div>
                          </div>
                        </div>
                        {p.pendingApproval && !isDone && (
                          <p className="text-xs text-orange-600 bg-orange-100 rounded-lg px-2 py-1.5">
                            Apply at their developer portal. Job will auto-post once approved.
                          </p>
                        )}
                        {isDone && (
                          <p className="text-xs text-green-700 flex items-center gap-1.5">
                            <CheckCircle size={12}/> Live · Candidates can apply now
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button onClick={distributeJob} disabled={distributing}
                  className="w-full flex items-center justify-center gap-2.5 bg-red-700 hover:bg-red-800 text-white py-3.5 rounded-xl text-sm font-bold transition disabled:opacity-60">
                  {distributing
                    ? <><RefreshCw size={16} className="animate-spin"/> Distributing to all portals…</>
                    : <><Send size={16}/> Distribute "{selectedJob.title}" to All Connected Portals</>}
                </button>

                {isJobDistributed && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-0.5"/>
                    <div>
                      <div className="text-sm font-bold text-green-800 mb-0.5">Job Distributed!</div>
                      <p className="text-xs text-green-700">"{selectedJob.title}" is live on connected portals. Switch to <strong>AI Profile Sync</strong> tab — the search is pre-filled with keywords from this JD. Click "AI Fetch Profiles" to find matching candidates.</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
                <Globe size={40} className="mx-auto text-gray-300 mb-3"/>
                <p className="text-gray-400">Select a job from the left to distribute to portals</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: AI Profile Sync ── */}
      {activeTab === 'profiles' && (
        <div>
          {/* Source mode toggle */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-gray-500 uppercase">Search Source:</span>
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => { setSourceMode('external'); setProfiles([]); setProfileSource(null); setBulkSaveStatus(null) }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${sourceMode==='external' ? 'bg-white shadow text-red-700 border border-red-100' : 'text-gray-500 hover:text-gray-700'}`}>
                <Zap size={12}/> AI Fetch (External Portals)
              </button>
              <button
                onClick={() => { setSourceMode('internal'); setProfiles([]); setProfileSource(null); setBulkSaveStatus(null) }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${sourceMode==='internal' ? 'bg-white shadow text-blue-700 border border-blue-100' : 'text-gray-500 hover:text-gray-700'}`}>
                <Archive size={12}/> Internal DB (Past Applicants)
              </button>
            </div>
            {sourceMode === 'internal' && (
              <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                Searches your Candidates Master — past applicants, referrals, Resdex imports
              </span>
            )}
          </div>

          {/* Search bar — pre-filled from selected job */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-5">
            {selectedJob && (
              <div className="flex items-center gap-2 mb-3 text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                <Zap size={12}/>
                <span>AI query auto-built from <strong>{selectedJob.title}</strong> JD — edit below if needed</span>
              </div>
            )}
            <div className="flex items-end gap-4">
              <div className="flex-1 relative">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role / Skills (auto-filled from JD)</label>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. ELV Engineer BMS CCTV"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 bottom-2 text-gray-400 hover:text-gray-600 transition">
                    <X size={14}/>
                  </button>
                )}
              </div>
              {sourceMode === 'external' && (
                <div className="w-44 relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location (optional)</label>
                  <input value={searchLocation} onChange={e => setSearchLocation(e.target.value)}
                    placeholder={selectedJob?.location || 'e.g. Mumbai'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                  {searchLocation && (
                    <button onClick={() => setSearchLocation('')}
                      className="absolute right-2.5 bottom-2 text-gray-400 hover:text-gray-600 transition">
                      <X size={14}/>
                    </button>
                  )}
                </div>
              )}
              {sourceMode === 'external' ? (
                <button onClick={fetchProfiles} disabled={loadingProfiles}
                  className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
                  {loadingProfiles ? <RefreshCw size={15} className="animate-spin"/> : <Zap size={15}/>}
                  AI Fetch Profiles
                </button>
              ) : (
                <button onClick={fetchInternalProfiles} disabled={loadingProfiles}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
                  {loadingProfiles ? <RefreshCw size={15} className="animate-spin"/> : <Database size={15}/>}
                  Search Internal DB
                </button>
              )}
            </div>
            {profileSource && sourceMode === 'external' && (
              <div className={`mt-2 text-xs font-medium ${profileSource==='live'?'text-green-600':'text-orange-500'}`}>
                {profileSource==='live' ? '✓ Live profiles from JSearch API (LinkedIn + Indeed + Glassdoor)' : '⚡ Demo profiles — add RAPIDAPI_KEY to Vercel for live data'}
              </div>
            )}
            {profileSource && sourceMode === 'internal' && profiles.length > 0 && (
              <div className="mt-2 text-xs font-medium text-blue-600">
                ✓ Showing {profiles.length} matches from your internal Candidates Master — ranked by skill relevance
              </div>
            )}
            {/* Auto-save status banner */}
            {bulkSaveStatus && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${
                bulkSaveStatus.done && bulkSaveStatus.saved > 0 ? 'bg-green-50 border border-green-200 text-green-700' :
                bulkSaveStatus.done && bulkSaveStatus.failed > 0 ? 'bg-red-50 border border-red-200 text-red-700' :
                'bg-blue-50 border border-blue-100 text-blue-700'}`}>
                {!bulkSaveStatus.done
                  ? <div className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin"/> Auto-saving {bulkSaveStatus.total} profiles to HRMS database…</div>
                  : bulkSaveStatus.saved > 0
                    ? <div className="flex items-center gap-2 flex-wrap">
                        <CheckCircle size={13}/>
                        <span><strong>{bulkSaveStatus.saved}</strong> of {bulkSaveStatus.total} profiles added to <strong>Candidates Master</strong>.</span>
                        <span className="text-green-600">Use "Move to Shortlisted" below to add them to the hiring pipeline.</span>
                        <strong className="underline cursor-pointer" onClick={()=>window.location.href='/talent-pool'}>View in Talent Pool →</strong>
                      </div>
                    : <div>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle size={13}/>
                          <span>Save failed — {bulkSaveStatus.failed} of {bulkSaveStatus.total} errors.</span>
                        </div>
                        {bulkSaveStatus.errors && bulkSaveStatus.errors.length > 0 && (
                          <div className="mt-1 text-xs font-normal opacity-80">{bulkSaveStatus.errors.slice(0,3).join(' · ')}</div>
                        )}
                      </div>
                }
              </div>
            )}
          </div>

          {profiles.length > 0 && (
            <div className="grid grid-cols-5 gap-6">
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">{profiles.length} profiles found</span>
                  <span className="text-xs text-gray-400">{Object.values(synced).filter(v=>v==='done').length} synced to HRMS</span>
                </div>
                {profiles.map(p => (
                  <div key={p.id} onClick={() => setSelectedProfile(p)}
                    className={`bg-white border rounded-xl p-3.5 cursor-pointer transition ${selectedProfile?.id===p.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-sm flex-shrink-0">{p.name.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.title}</div>
                      </div>
                      <div className={`text-sm font-black ${p.matchScore>=70?'text-green-600':p.matchScore>=50?'text-yellow-600':'text-gray-400'}`}>{p.matchScore}%</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-gray-500"><MapPin size={10}/>{p.location}</span>
                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                        p.source==='LinkedIn' || p.source.includes('LinkedIn') ? 'bg-blue-100 text-blue-700' :
                        p.source==='Internal DB' || p.source==='Referral' || p.source==='Resdex' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'}`}>{p.source}</span>
                      {synced[p.id] === 'done' && <span className="flex items-center gap-1 text-green-600 ml-auto"><Database size={11}/> Synced</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="col-span-3">
                {selectedProfile ? (
                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-black text-xl flex-shrink-0">{selectedProfile.name.charAt(0)}</div>
                          <div>
                            <h2 className="font-bold text-gray-900">{selectedProfile.name}</h2>
                            <p className="text-sm text-gray-500">{selectedProfile.title} · {selectedProfile.experience}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={11}/>{selectedProfile.location}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                selectedProfile.source==='LinkedIn' || selectedProfile.source.includes('LinkedIn') ? 'bg-blue-100 text-blue-700' :
                                selectedProfile.source==='Internal DB' || selectedProfile.source==='Referral' || selectedProfile.source==='Resdex' ? 'bg-purple-100 text-purple-700' :
                                'bg-green-100 text-green-700'}`}>{selectedProfile.source}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-black ${selectedProfile.matchScore>=70?'text-green-600':selectedProfile.matchScore>=50?'text-yellow-500':'text-gray-400'}`}>{selectedProfile.matchScore}%</div>
                          <div className="text-xs text-gray-500">AI match score</div>
                        </div>
                      </div>
                      <div className="mt-3 bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${selectedProfile.matchScore>=70?'bg-green-500':selectedProfile.matchScore>=50?'bg-yellow-400':'bg-gray-300'}`}
                          style={{ width:`${selectedProfile.matchScore}%` }}/>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">AI Summary</div>
                        <p className="text-sm text-gray-700 leading-relaxed">{selectedProfile.summary}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Skills</div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProfile.skills.map((s:string) => (
                            <span key={s} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <div className="text-gray-500 mb-0.5">Education</div>
                          <div className="font-medium text-gray-800">{selectedProfile.education}</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <div className="text-gray-500 mb-0.5">Matched Job</div>
                          <div className="font-medium text-gray-800 truncate">{selectedJob?.title || '—'}</div>
                        </div>
                      </div>

                      {/* Status info */}
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5 mb-2">
                        <div className="flex items-center gap-2 text-xs text-blue-700">
                          <CheckCircle size={13} className="text-blue-500 flex-shrink-0"/>
                          {sourceMode === 'internal'
                            ? <span><strong>Already in Candidates Master</strong> — sourced from {selectedProfile.source}.</span>
                            : <span><strong>Saved to Candidates Master</strong> — visible in Talent Pool for HR review.</span>
                          }
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Database size={13} className="flex-shrink-0"/>
                          <span>Click below to add to the <strong>hiring pipeline</strong> for {selectedJob?.title || 'the selected role'}.</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShortlisted(prev => { const n = new Set(prev); n.add(selectedProfile.id); return n })
                          syncToHRMS(selectedProfile)
                        }}
                        disabled={shortlisted.has(selectedProfile.id)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition ${shortlisted.has(selectedProfile.id) ? 'bg-green-600 text-white cursor-default' : 'bg-red-700 hover:bg-red-800 text-white'}`}>
                        {shortlisted.has(selectedProfile.id)
                          ? <><CheckCircle size={15}/> Added to Pipeline ✓</>
                          : <><Zap size={15}/> Shortlist — Add to Hiring Pipeline</>
                        }
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
                    <User size={40} className="mx-auto text-gray-300 mb-3"/>
                    <p className="text-gray-400">Select a profile to view AI analysis and sync to HRMS</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {profiles.length === 0 && !loadingProfiles && (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              {sourceMode === 'external'
                ? <Zap size={40} className="mx-auto text-gray-300 mb-3"/>
                : <Archive size={40} className="mx-auto text-blue-200 mb-3"/>
              }
              <p className="text-gray-600 font-medium mb-1">
                {sourceMode === 'external' ? 'AI Profile Sync Ready' : 'Internal DB Search Ready'}
              </p>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                {sourceMode === 'external'
                  ? (selectedJob
                      ? `Query pre-filled from "${selectedJob.title}" JD. Click "AI Fetch Profiles" to find matching candidates.`
                      : 'Select a job first, or enter a role manually above.')
                  : (selectedJob
                      ? `Search your internal Candidates Master for "${selectedJob.title}" matches — past applicants, sourced profiles, and referrals.`
                      : 'Select a job first, or enter skills manually to search past candidates.')
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Market Intelligence ── */}
      {activeTab === 'market' && (
        <div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-5">
            <div className="flex items-end gap-4">
              <div className="flex-1 relative">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role / Job Title</label>
                <input value={marketQuery} onChange={e => setMarketQuery(e.target.value)}
                  placeholder={selectedJob?.title || 'e.g. ELV Engineer'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                {marketQuery && (
                  <button onClick={() => setMarketQuery('')}
                    className="absolute right-2.5 bottom-2 text-gray-400 hover:text-gray-600 transition">
                    <X size={14}/>
                  </button>
                )}
              </div>
              <button onClick={fetchMarketData} disabled={loadingMarket}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
                {loadingMarket ? <RefreshCw size={15} className="animate-spin"/> : <BarChart2 size={15}/>}
                Fetch Market Data
              </button>
            </div>
            {marketSource && (
              <div className={`mt-2 text-xs font-medium ${marketSource==='live'?'text-green-600':'text-orange-500'}`}>
                {marketSource==='live' ? '✓ Live data from Adzuna API' : '⚡ Demo data — add ADZUNA_APP_ID + ADZUNA_APP_KEY to Vercel for live data'}
              </div>
            )}
          </div>

          {salaryData && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label:'Market Minimum', value:`${salaryData.currency||'₹'}${((salaryData.min||0)/100000).toFixed(1)}L`, color:'bg-white' },
                { label:'Market Average',  value:`${salaryData.currency||'₹'}${((salaryData.avg||0)/100000).toFixed(1)}L`, color:'bg-green-50 text-green-700' },
                { label:'Market Maximum',  value:`${salaryData.currency||'₹'}${((salaryData.max||0)/100000).toFixed(1)}L`, color:'bg-blue-50 text-blue-700' },
              ].map(s => (
                <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 shadow-sm`}>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {marketJobs.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Competing Job Postings ({marketJobs.length})</h3>
              <div className="space-y-3">
                {marketJobs.map(j => (
                  <div key={j.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm text-gray-900">{j.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{j.company} · {j.location}</div>
                      </div>
                      {(j.salary_min > 0 || j.salary_max > 0) && (
                        <div className="text-sm font-bold text-gray-900">
                          ₹{(j.salary_min/100000).toFixed(1)}L – ₹{(j.salary_max/100000).toFixed(1)}L
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{j.description}</p>
                    <div className="text-xs text-gray-400 mt-1">{j.source} · {j.created}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {marketJobs.length === 0 && !loadingMarket && (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <TrendingUp size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-600 font-medium mb-1">Market Intelligence Ready</p>
              <p className="text-sm text-gray-400">Search for a role to see salary benchmarks and competing job postings from Adzuna</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
