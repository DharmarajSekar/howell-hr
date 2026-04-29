'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, Star, MapPin, Phone, Mail, Users, Database, TrendingUp, UserPlus, Zap, RefreshCw } from 'lucide-react'

function sourceColor(source: string): string {
  if (!source) return 'bg-gray-100 text-gray-600'
  const s = source.toLowerCase()
  if (s.includes('linkedin'))   return 'bg-blue-100 text-blue-700'
  if (s.includes('naukri'))     return 'bg-orange-100 text-orange-700'
  if (s.includes('referral'))   return 'bg-green-100 text-green-700'
  if (s.includes('apply_link') || s.includes('direct')) return 'bg-purple-100 text-purple-700'
  if (s.includes('portal_sync') || s.includes('portal')) return 'bg-teal-100 text-teal-700'
  if (s.includes('indeed'))     return 'bg-indigo-100 text-indigo-700'
  if (s.includes('jsearch'))    return 'bg-green-100 text-green-700'
  if (s.includes('zip'))        return 'bg-cyan-100 text-cyan-700'
  return 'bg-gray-100 text-gray-600'
}

function sourceLabel(source: string): string {
  if (!source) return 'Unknown'
  const s = source.toLowerCase()
  if (s === 'portal_sync_linkedin')    return '🔗 LinkedIn'
  if (s === 'portal_sync_indeed')      return '🔗 Indeed'
  if (s === 'portal_sync_ziprecruiter') return '🔗 ZipRecruiter'
  if (s.startsWith('portal_sync_'))    return '🔗 ' + source.replace('portal_sync_','').replace(/_/g,' ')
  if (s.includes('portal sync'))       return '🔗 Portal'
  return source
}

function isPortalSourced(source: string): boolean {
  const s = (source || '').toLowerCase()
  return s.includes('portal_sync') || s.includes('portal sync') || s.startsWith('portal_sync')
}

export default function TalentPoolClient() {
  const [candidates,   setCandidates]   = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [jobs,         setJobs]         = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null)

  const [search,    setSearch]    = useState('')
  const [source,    setSource]    = useState('all')
  const [selected,  setSelected]  = useState<any>(null)
  const [showMatch, setShowMatch] = useState(false)
  const [matchJob,  setMatchJob]  = useState('')

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

  // Fetch on mount
  useEffect(() => { loadData() }, [loadData])

  const appMap = useMemo(() => {
    const m: Record<string, any[]> = {}
    applications.forEach((a: any) => {
      if (!m[a.candidate_id]) m[a.candidate_id] = []
      m[a.candidate_id].push(a)
    })
    return m
  }, [applications])

  const filtered = useMemo(() => candidates.filter((c: any) => {
    const q   = search.toLowerCase()
    const matchSearch = !q ||
      c.full_name?.toLowerCase().includes(q) ||
      c.current_title?.toLowerCase().includes(q) ||
      c.current_company?.toLowerCase().includes(q) ||
      (c.skills || []).some((s: string) => s.toLowerCase().includes(q))
    const src = (c.source || '').toLowerCase()
    const matchSource =
      source === 'all'       ? true :
      source === 'portal'    ? isPortalSourced(c.source) :
      source === 'linkedin'  ? src.includes('linkedin') :
      source === 'naukri'    ? src.includes('naukri') :
      source === 'referral'  ? src.includes('referral') :
      source === 'apply_link'? src.includes('apply_link') || src.includes('direct') :
      c.source === source
    return matchSearch && matchSource
  }), [candidates, search, source])

  const matchedCandidates = useMemo(() => {
    if (!matchJob) return []
    const job = jobs.find((j: any) => j.id === matchJob)
    if (!job) return []
    const jobText = `${job.title} ${job.requirements || ''} ${job.description || ''}`.toLowerCase()
    return candidates.map((c: any) => {
      const skills     = (c.skills || [])
      const matchCount = skills.filter((s: string) => jobText.includes(s.toLowerCase())).length
      const expMatch   = c.experience_years >= (job.experience_min || 0)
      const score      = Math.min(98, (matchCount * 15) + (expMatch ? 20 : 0) + Math.floor(Math.random() * 15) + 40)
      return { ...c, matchScore: score }
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 8)
  }, [matchJob, candidates, jobs])

  const portalCount = candidates.filter((c: any) => isPortalSourced(c.source)).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Talent Pool</h1>
          <p className="text-sm text-gray-500 mt-0.5">Central repository of all candidates — applicants, sourced &amp; referrals</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            Refresh
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
          { label: 'Total Profiles',  value: loading ? '…' : candidates.length,   icon: Database,   color: 'text-gray-700 bg-white' },
          { label: 'Portal Sourced',  value: loading ? '…' : portalCount,          icon: Users,      color: 'text-teal-700 bg-teal-50' },
          { label: 'Referrals',       value: loading ? '…' : candidates.filter((c:any)=>(c.source||'').toLowerCase().includes('referral')).length, icon: UserPlus, color: 'text-green-700 bg-green-50' },
          { label: 'Avg Experience',  value: loading ? '…' : (candidates.length ? Math.round(candidates.reduce((s:number,c:any)=>s+(c.experience_years||0),0)/candidates.length)+'y' : '—'), icon: TrendingUp, color: 'text-purple-700 bg-purple-50' },
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
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
        </div>
        <select value={source} onChange={e => setSource(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="all">All Sources</option>
          <option value="portal">🔗 Portal Sourced (JSearch / LinkedIn / Indeed)</option>
          <option value="linkedin">LinkedIn</option>
          <option value="naukri">Naukri</option>
          <option value="referral">Referral</option>
          <option value="apply_link">Direct Apply</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw size={28} className="animate-spin text-red-700 mr-3"/>
          <span className="text-gray-500 text-sm">Loading candidates from database…</span>
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
                    ? 'No portal-sourced candidates yet. Go to AI Sourcing → AI Profile Sync, fetch profiles, then refresh this page.'
                    : 'No candidates match your filter.'}
                </p>
              </div>
            )}
            {filtered.map((c: any) => {
              const apps = appMap[c.id] || []
              return (
                <div key={c.id} onClick={() => setSelected(c)}
                  className={`bg-white border rounded-xl p-3.5 cursor-pointer transition ${selected?.id === c.id ? 'border-red-500 shadow-md' : 'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
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
                      </div>
                    </div>
                  </div>
                  {(c.skills || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(c.skills || []).slice(0, 4).map((s: string) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                      {(c.skills || []).length > 4 && <span className="text-xs text-gray-400">+{(c.skills||[]).length - 4}</span>}
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
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                        {selected.location && <span className="flex items-center gap-1"><MapPin size={11}/>{selected.location}</span>}
                        <span>{selected.experience_years} years experience</span>
                        {selected.salary_expectation > 0 && <span>₹{selected.salary_expectation} LPA expected</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${sourceColor(selected.source)}`}>{sourceLabel(selected.source)}</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {selected.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5">
                        <Mail size={14} className="text-gray-400"/>
                        <span className="truncate">{selected.email}</span>
                      </div>
                    )}
                    {selected.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5">
                        <Phone size={14} className="text-gray-400"/>
                        <span>{selected.phone}</span>
                      </div>
                    )}
                  </div>

                  {selected.summary && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">AI Summary</h3>
                      <p className="text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-lg p-3">{selected.summary}</p>
                    </div>
                  )}

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

      {/* AI Match Modal */}
      {showMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">AI Talent Match</h2>
              <p className="text-sm text-gray-500 mt-1">Find the best candidates from your talent pool for a role</p>
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
                        <div className="text-xs text-gray-500">{c.current_title} · {c.experience_years}y</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${c.matchScore>=80?'text-green-600':c.matchScore>=65?'text-yellow-600':'text-gray-500'}`}>{c.matchScore}%</div>
                        <div className="text-xs text-gray-400">match</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100">
              <button onClick={() => { setShowMatch(false); setMatchJob('') }}
                className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
