'use client'
import { useState } from 'react'
import { Globe, Search, Zap, CheckCircle, Clock, Send, RefreshCw, User, MapPin, Briefcase, TrendingUp, BarChart2, Star, AlertTriangle, Plus, ExternalLink } from 'lucide-react'

const JOB_POSTINGS = [
  { id:'JOB-001', title:'ELV Engineer',        site:'Mumbai',    department:'Engineering', status:'open' },
  { id:'JOB-002', title:'Site Supervisor',      site:'Pune',      department:'Operations',  status:'open' },
  { id:'JOB-003', title:'HR Business Partner',  site:'Bengaluru', department:'HR',          status:'open' },
  { id:'JOB-004', title:'Project Manager – ELV',site:'Delhi',     department:'Engineering', status:'open' },
  { id:'JOB-005', title:'Data Analyst – HR',    site:'Hyderabad', department:'HR',          status:'open' },
]

const PORTALS = [
  { id:'linkedin', name:'LinkedIn',            logo:'🔵', connected: false, pendingApproval: true  },
  { id:'indeed',   name:'Indeed',              logo:'🔷', connected: false, pendingApproval: true  },
  { id:'adzuna',   name:'Adzuna',              logo:'🟠', connected: true,  pendingApproval: false },
  { id:'jsearch',  name:'JSearch (RapidAPI)',  logo:'🟢', connected: true,  pendingApproval: false },
]

type Profile = {
  id: string; name: string; title: string; location: string
  experience: string; skills: string[]; source: string; matchScore: number
  summary: string; email: string; phone: string; education: string
}

type MarketJob = {
  id: string; title: string; company: string; location: string
  salary_min: number; salary_max: number; description: string; created: string; source: string
}

export default function SourcingPage() {
  const [activeTab, setActiveTab]             = useState<'distribute'|'profiles'|'market'>('distribute')
  const [selectedJob, setSelectedJob]         = useState(JOB_POSTINGS[0])
  const [distributed, setDistributed]         = useState<Record<string, boolean>>({})
  const [distributing, setDistributing]       = useState(false)

  // Profile tab state
  const [searchQuery, setSearchQuery]         = useState('')
  const [searchLocation, setSearchLocation]   = useState('')
  const [profiles, setProfiles]               = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [profileSource, setProfileSource]     = useState<'mock'|'live'|null>(null)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [shortlisted, setShortlisted]         = useState<Set<string>>(new Set())

  // Market tab state
  const [marketQuery, setMarketQuery]         = useState('')
  const [marketJobs, setMarketJobs]           = useState<MarketJob[]>([])
  const [loadingMarket, setLoadingMarket]     = useState(false)
  const [salaryData, setSalaryData]           = useState<any>(null)
  const [marketSource, setMarketSource]       = useState<'mock'|'live'|null>(null)

  async function distributeJob() {
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
    try {
      const q = searchQuery || selectedJob.title
      const res = await fetch(`/api/portals/jsearch?query=${encodeURIComponent(q)}&location=${encodeURIComponent(searchLocation)}`)
      const data = await res.json()
      setProfiles(data.profiles || [])
      setProfileSource(data.source)
    } catch {
      setProfiles([])
    } finally {
      setLoadingProfiles(false)
    }
  }

  async function fetchMarketData() {
    setLoadingMarket(true)
    const q = marketQuery || selectedJob.title
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

  function toggleShortlist(id: string) {
    setShortlisted(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const isJobDistributed = PORTALS.some(p => distributed[`${selectedJob.id}-${p.id}`])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Talent Sourcing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Distribute jobs, fetch AI-matched candidates, and analyse the market — across LinkedIn, Indeed, Adzuna & more</p>
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
          <div className="col-span-1">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Select Job to Distribute</h3>
            <div className="space-y-2">
              {JOB_POSTINGS.map(j => (
                <div key={j.id} onClick={() => setSelectedJob(j)}
                  className={`bg-white border rounded-xl p-3.5 cursor-pointer transition ${selectedJob.id===j.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                  <div className="font-medium text-sm text-gray-900">{j.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{j.department} · {j.site}</div>
                  {isJobDistributed && selectedJob.id === j.id && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
                      <CheckCircle size={11}/> Distributed
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Portal Distribution — {selectedJob.title}</h3>
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
                          {isDone ? '✓ Job Posted' : p.pendingApproval ? '⏳ Pending Approval' : '✓ Connected · Ready'}
                        </div>
                      </div>
                    </div>
                    {p.pendingApproval && !isDone && (
                      <div className="text-xs text-orange-600 bg-orange-100 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
                        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5"/>
                        API partner approval in progress. Job will auto-post once approved.
                      </div>
                    )}
                    {isDone && (
                      <div className="text-xs text-green-700 flex items-center gap-1.5">
                        <CheckCircle size={12}/> Live on {p.name} · Candidates can now apply
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button onClick={distributeJob} disabled={distributing}
              className="w-full flex items-center justify-center gap-2.5 bg-red-700 hover:bg-red-800 text-white py-3.5 rounded-xl text-sm font-bold transition disabled:opacity-60">
              {distributing
                ? <><RefreshCw size={16} className="animate-spin"/> Distributing to all portals…</>
                : <><Send size={16}/> Distribute "{selectedJob.title}" to All Connected Portals</>
              }
            </button>

            {isJobDistributed && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-0.5"/>
                <div>
                  <div className="text-sm font-bold text-green-800 mb-0.5">Job Successfully Distributed!</div>
                  <p className="text-xs text-green-700">"{selectedJob.title}" is now live on Adzuna and JSearch. LinkedIn & Indeed will go live once partner API approval is complete. Switch to AI Profile Sync tab to start fetching candidates.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: AI Profile Sync ── */}
      {activeTab === 'profiles' && (
        <div>
          {/* Search bar */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-5">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role / Skills to Search</label>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`e.g. ${selectedJob.title}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
              <div className="w-48">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location (optional)</label>
                <input value={searchLocation} onChange={e => setSearchLocation(e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
              <button onClick={fetchProfiles} disabled={loadingProfiles}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
                {loadingProfiles ? <RefreshCw size={15} className="animate-spin"/> : <Zap size={15}/>}
                AI Fetch Profiles
              </button>
            </div>
            {profileSource && (
              <div className={`mt-2 text-xs font-medium ${profileSource==='live'?'text-green-600':'text-orange-600'}`}>
                {profileSource==='live' ? '✓ Live data from JSearch API' : '⚡ Demo data (add RAPIDAPI_KEY to .env.local for live profiles)'}
              </div>
            )}
          </div>

          {profiles.length > 0 && (
            <div className="grid grid-cols-5 gap-6">
              {/* Profile list */}
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">{profiles.length} profiles found</span>
                  <span className="text-xs text-gray-500">{shortlisted.size} shortlisted</span>
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
                      <div className={`text-sm font-black ${p.matchScore>=70?'text-green-600':p.matchScore>=50?'text-yellow-600':'text-gray-400'}`}>
                        {p.matchScore}%
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin size={10}/>{p.location}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.source==='LinkedIn'?'bg-blue-100 text-blue-700':p.source==='Indeed'?'bg-indigo-100 text-indigo-700':'bg-green-100 text-green-700'}`}>{p.source}</span>
                      {shortlisted.has(p.id) && <CheckCircle size={12} className="text-green-500 ml-auto"/>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Profile detail */}
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
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedProfile.source==='LinkedIn'?'bg-blue-100 text-blue-700':selectedProfile.source==='Indeed'?'bg-indigo-100 text-indigo-700':'bg-green-100 text-green-700'}`}>{selectedProfile.source}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-black ${selectedProfile.matchScore>=70?'text-green-600':selectedProfile.matchScore>=50?'text-yellow-500':'text-gray-400'}`}>
                            {selectedProfile.matchScore}%
                          </div>
                          <div className="text-xs text-gray-500">AI match score</div>
                        </div>
                      </div>
                      {/* Match bar */}
                      <div className="mt-3 bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${selectedProfile.matchScore>=70?'bg-green-500':selectedProfile.matchScore>=50?'bg-yellow-400':'bg-gray-300'}`}
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
                          <div className="text-gray-500 mb-0.5">Contact</div>
                          <div className="font-medium text-gray-800 truncate">{selectedProfile.email}</div>
                        </div>
                      </div>
                      <div className="flex gap-2.5 pt-1">
                        <button onClick={() => toggleShortlist(selectedProfile.id)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${shortlisted.has(selectedProfile.id)?'bg-green-600 text-white hover:bg-green-700':'bg-red-700 text-white hover:bg-red-800'}`}>
                          {shortlisted.has(selectedProfile.id) ? '✓ Shortlisted' : 'Shortlist & Sync to HRMS'}
                        </button>
                        <button className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                          <Send size={13}/> Invite
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
                    <User size={40} className="mx-auto text-gray-300 mb-3"/>
                    <p className="text-gray-400">Select a profile to view AI analysis</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {profiles.length === 0 && !loadingProfiles && (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <Zap size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-600 font-medium mb-1">AI Profile Sync Ready</p>
              <p className="text-sm text-gray-400">Enter a role or skills above and click "AI Fetch Profiles" to pull candidates from all connected portals</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Market Intelligence ── */}
      {activeTab === 'market' && (
        <div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-5">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Role / Job Title</label>
                <input value={marketQuery} onChange={e => setMarketQuery(e.target.value)}
                  placeholder={`e.g. ${selectedJob.title}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
              <button onClick={fetchMarketData} disabled={loadingMarket}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60">
                {loadingMarket ? <RefreshCw size={15} className="animate-spin"/> : <BarChart2 size={15}/>}
                Fetch Market Data
              </button>
            </div>
            {marketSource && (
              <div className={`mt-2 text-xs font-medium ${marketSource==='live'?'text-green-600':'text-orange-600'}`}>
                {marketSource==='live' ? '✓ Live data from Adzuna API' : '⚡ Demo data (add ADZUNA_APP_ID + ADZUNA_APP_KEY to .env.local for live data)'}
              </div>
            )}
          </div>

          {salaryData && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label:'Market Minimum', value:`${salaryData.currency || '₹'}${((salaryData.min||0)/100000).toFixed(1)}L`, color:'text-gray-700 bg-white' },
                { label:'Market Average',  value:`${salaryData.currency || '₹'}${((salaryData.avg||0)/100000).toFixed(1)}L`, color:'text-green-700 bg-green-50' },
                { label:'Market Maximum',  value:`${salaryData.currency || '₹'}${((salaryData.max||0)/100000).toFixed(1)}L`, color:'text-blue-700 bg-blue-50' },
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
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Competing Job Postings on Market ({marketJobs.length})</h3>
              <div className="space-y-3">
                {marketJobs.map(j => (
                  <div key={j.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm text-gray-900">{j.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{j.company} · {j.location}</div>
                      </div>
                      <div className="text-right">
                        {(j.salary_min > 0 || j.salary_max > 0) && (
                          <div className="text-sm font-bold text-gray-900">
                            ₹{(j.salary_min/100000).toFixed(1)}L – ₹{(j.salary_max/100000).toFixed(1)}L
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">{j.source} · {j.created}</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{j.description}</p>
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
