'use client'
import { useState } from 'react'
import { Search, Plus, Globe, Users, TrendingUp, CheckCircle, Clock, XCircle, Zap, Star, MapPin, Building2, RefreshCw } from 'lucide-react'

const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn:  'bg-blue-100 text-blue-700',
  Naukri:    'bg-orange-100 text-orange-700',
  Indeed:    'bg-purple-100 text-purple-700',
  Referral:  'bg-green-100 text-green-700',
}

const STATUS_COLORS: Record<string, string> = {
  reached_out:   'bg-gray-100 text-gray-600',
  responded:     'bg-blue-100 text-blue-700',
  interested:    'bg-green-100 text-green-700',
  not_interested:'bg-red-100 text-red-600',
  in_process:    'bg-yellow-100 text-yellow-700',
}

const STATUS_LABELS: Record<string, string> = {
  reached_out:   'Reached Out',
  responded:     'Responded',
  interested:    'Interested',
  not_interested:'Not Interested',
  in_process:    'In Process',
}

interface Props {
  campaigns: any[]
  jobs: any[]
}

export default function SourcingClient({ campaigns: initial, jobs }: Props) {
  const [campaigns, setCampaigns] = useState<any[]>(initial)
  const [selected, setSelected]   = useState<any>(null)
  const [showForm, setShowForm]   = useState(false)
  const [launching, setLaunching] = useState(false)
  const [form, setForm]           = useState({ job_id: '', platforms: ['LinkedIn','Naukri','Indeed'] })

  const togglePlatform = (p: string) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }))
  }

  async function launchCampaign() {
    const job = jobs.find((j: any) => j.id === form.job_id)
    if (!job) return
    setLaunching(true)
    try {
      const res = await fetch('/api/sourcing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, job_title: job.title, platforms: form.platforms }),
      })
      const campaign = await res.json()
      setCampaigns(prev => [campaign, ...prev])
      setSelected(campaign)
      setShowForm(false)
      setForm({ job_id: '', platforms: ['LinkedIn','Naukri','Indeed'] })
    } finally {
      setLaunching(false)
    }
  }

  async function refreshCampaign(id: string) {
    const res = await fetch(`/api/sourcing/${id}`)
    const updated = await res.json()
    setCampaigns(prev => prev.map((c: any) => c.id === id ? updated : c))
    if (selected?.id === id) setSelected(updated)
  }

  const activeJobs = jobs.filter((j: any) => j.status === 'active')

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Talent Sourcing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automated multi-platform candidate discovery</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Launch Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Campaigns', value: campaigns.filter((c:any) => c.status==='active').length, icon: Globe, color: 'text-blue-600 bg-blue-50' },
          { label: 'Total Reached',    value: campaigns.reduce((s:number,c:any)=>s+c.total_reached,0), icon: Users, color: 'text-purple-600 bg-purple-50' },
          { label: 'Interested',       value: campaigns.reduce((s:number,c:any)=>s+c.interested,0),    icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Response Rate',    value: campaigns.length ? Math.round(campaigns.reduce((s:number,c:any)=>s+(c.total_reached?c.responses/c.total_reached:0),0)/campaigns.length*100)+'%' : '0%', icon: CheckCircle, color: 'text-orange-600 bg-orange-50' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
              <s.icon size={20}/>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Campaign list */}
        <div className="col-span-1 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm mb-2">Campaigns ({campaigns.length})</h2>
          {campaigns.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <Globe size={32} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-sm text-gray-400">No campaigns yet. Launch your first AI sourcing campaign.</p>
            </div>
          ) : (
            campaigns.map((c: any) => (
              <div key={c.id}
                onClick={() => setSelected(c)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id === c.id ? 'border-red-500 shadow-md' : 'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm text-gray-900 truncate max-w-[160px]">{c.job_title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.status}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap mb-2">
                  {(c.platforms || []).map((p: string) => (
                    <span key={p} className={`text-xs px-1.5 py-0.5 rounded font-medium ${PLATFORM_COLORS[p] || 'bg-gray-100 text-gray-600'}`}>{p}</span>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="bg-gray-50 rounded p-1.5">
                    <div className="text-sm font-bold text-gray-800">{c.total_reached}</div>
                    <div className="text-xs text-gray-400">Reached</div>
                  </div>
                  <div className="bg-gray-50 rounded p-1.5">
                    <div className="text-sm font-bold text-gray-800">{c.responses}</div>
                    <div className="text-xs text-gray-400">Replied</div>
                  </div>
                  <div className="bg-green-50 rounded p-1.5">
                    <div className="text-sm font-bold text-green-700">{c.interested}</div>
                    <div className="text-xs text-green-500">Interested</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Campaign detail */}
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-gray-900">{selected.job_title}</h2>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {(selected.platforms || []).map((p: string) => (
                      <span key={p} className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[p] || 'bg-gray-100 text-gray-600'}`}>{p}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => refreshCampaign(selected.id)}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded transition">
                  <RefreshCw size={16}/>
                </button>
              </div>

              {/* AI Summary */}
              {selected.ai_summary && (
                <div className="mx-5 mt-4 flex gap-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-xl p-4">
                  <Zap size={18} className="text-purple-500 flex-shrink-0 mt-0.5"/>
                  <p className="text-sm text-gray-700">{selected.ai_summary}</p>
                </div>
              )}

              {/* Sourced candidates */}
              <div className="p-5">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">
                  Sourced Candidates ({(selected.sourced_candidates || []).length})
                </h3>
                {(selected.sourced_candidates || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No candidates sourced yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {(selected.sourced_candidates || [])
                      .sort((a: any, b: any) => b.match_score - a.match_score)
                      .map((c: any) => (
                        <div key={c.id} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
                          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                            {c.full_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-900">{c.full_name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PLATFORM_COLORS[c.platform] || 'bg-gray-100 text-gray-600'}`}>{c.platform}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                              <span className="flex items-center gap-1"><Building2 size={11}/>{c.current_company}</span>
                              <span className="flex items-center gap-1"><MapPin size={11}/>{c.location}</span>
                              <span>{c.experience_years}y exp</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-center">
                              <div className={`text-sm font-bold ${c.match_score >= 80 ? 'text-green-600' : c.match_score >= 65 ? 'text-yellow-600' : 'text-gray-500'}`}>
                                {c.match_score}%
                              </div>
                              <div className="text-xs text-gray-400">match</div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABELS[c.status] || c.status}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <Search size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select a campaign to view sourced candidates</p>
            </div>
          )}
        </div>
      </div>

      {/* Launch Campaign Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Launch AI Sourcing Campaign</h2>
              <p className="text-sm text-gray-500 mt-1">AI will automatically find and reach out to matching candidates</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Job Role</label>
                <select value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Select a job posting…</option>
                  {activeJobs.map((j: any) => (
                    <option key={j.id} value={j.id}>{j.title} — {j.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                <div className="flex gap-2 flex-wrap">
                  {['LinkedIn','Naukri','Indeed','Referral'].map(p => (
                    <button key={p} type="button"
                      onClick={() => togglePlatform(p)}
                      className={`text-sm px-3 py-1.5 rounded-full border font-medium transition ${form.platforms.includes(p) ? 'bg-red-700 text-white border-red-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                <Zap size={14} className="inline mr-1 mb-0.5"/>
                AI will scan profiles, match against JD requirements, and auto-reach out to top candidates.
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={launchCampaign} disabled={!form.job_id || form.platforms.length === 0 || launching}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                {launching ? 'Launching…' : 'Launch Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
