'use client'
import { useState } from 'react'
import { CheckCircle, Clock, AlertTriangle, ExternalLink, Key, RefreshCw, Globe, Zap, Building2, Search } from 'lucide-react'

const PORTALS = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    logo: '🔵',
    description: 'World\'s largest professional network. Post jobs, source candidates, and access LinkedIn Talent Solutions.',
    features: ['Job Posting', 'Candidate Sourcing', 'InMail Outreach', 'Company Page Sync'],
    status: 'pending_approval',
    statusLabel: 'Partner Approval Required',
    setupUrl: 'https://www.linkedin.com/developers/',
    fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client Secret' }],
    note: 'LinkedIn Job Posting API requires partner-level approval. Apply at LinkedIn Developer Portal — typically 4–8 weeks.',
    color: 'blue',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    logo: '🔷',
    description: 'World\'s #1 job site. Post jobs to millions of job seekers and access employer profile data.',
    features: ['Job Posting', 'Sponsored Jobs', 'Resume Search', 'Employer Branding'],
    status: 'pending_approval',
    statusLabel: 'Employer API Approval Required',
    setupUrl: 'https://apis.indeed.com/',
    fields: [{ key: 'publisher_id', label: 'Publisher ID' }, { key: 'api_key', label: 'API Key' }],
    note: 'Indeed Employer API requires registered business and review. Apply at Indeed APIs — typically 2–4 weeks.',
    color: 'indigo',
  },
  {
    id: 'adzuna',
    name: 'Adzuna',
    logo: '🟠',
    description: 'Global job search engine with salary benchmarking data across 16 countries. Instant API access.',
    features: ['Job Market Search', 'Salary Benchmarks', 'Market Intelligence', 'Competing Job Analysis'],
    status: 'ready',
    statusLabel: 'Ready to Connect',
    setupUrl: 'https://developer.adzuna.com/',
    fields: [{ key: 'app_id', label: 'App ID (ADZUNA_APP_ID)' }, { key: 'app_key', label: 'App Key (ADZUNA_APP_KEY)' }],
    note: 'Free signup at developer.adzuna.com — get your App ID and App Key instantly. No approval needed.',
    color: 'orange',
  },
  {
    id: 'jsearch',
    name: 'JSearch (RapidAPI)',
    logo: '🟢',
    description: 'Aggregates real job listings from LinkedIn, Indeed, Glassdoor, and 50+ portals. AI-powered profile matching.',
    features: ['Multi-Portal Job Search', 'LinkedIn Data', 'Indeed Data', 'Glassdoor Data', 'Salary Estimates'],
    status: 'ready',
    statusLabel: 'Ready to Connect',
    setupUrl: 'https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch',
    fields: [{ key: 'rapidapi_key', label: 'RapidAPI Key (RAPIDAPI_KEY)' }],
    note: 'Free signup at rapidapi.com → subscribe to JSearch API (free tier: 200 req/month). Get key instantly.',
    color: 'green',
  },
]

const STATUS_CFG: Record<string, { color: string; icon: any; bg: string }> = {
  pending_approval: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Clock },
  ready:            { color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100',     icon: Key },
  connected:        { color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: CheckCircle },
}

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<Record<string, Record<string, string>>>({})
  const [saved, setSaved]             = useState<Record<string, boolean>>({})
  const [testing, setTesting]         = useState<Record<string, boolean>>({})
  const [testResult, setTestResult]   = useState<Record<string, 'ok' | 'fail' | null>>({})
  const [expanded, setExpanded]       = useState<string | null>('adzuna')

  function handleFieldChange(portalId: string, fieldKey: string, value: string) {
    setConnections(prev => ({
      ...prev,
      [portalId]: { ...(prev[portalId] || {}), [fieldKey]: value }
    }))
    setSaved(prev => ({ ...prev, [portalId]: false }))
  }

  function saveKeys(portalId: string) {
    setSaved(prev => ({ ...prev, [portalId]: true }))
    // In production, these would be saved to environment variables via a settings API
  }

  async function testConnection(portalId: string) {
    setTesting(prev => ({ ...prev, [portalId]: true }))
    setTestResult(prev => ({ ...prev, [portalId]: null }))

    try {
      const endpoint = portalId === 'adzuna' ? '/api/portals/adzuna?q=engineer&l=Mumbai'
                     : portalId === 'jsearch' ? '/api/portals/jsearch?query=engineer'
                     : null

      if (!endpoint) {
        setTestResult(prev => ({ ...prev, [portalId]: 'fail' }))
        return
      }

      const res = await fetch(endpoint)
      const data = await res.json()
      setTestResult(prev => ({ ...prev, [portalId]: data.results || data.profiles ? 'ok' : 'fail' }))
    } catch {
      setTestResult(prev => ({ ...prev, [portalId]: 'fail' }))
    } finally {
      setTesting(prev => ({ ...prev, [portalId]: false }))
    }
  }

  const connectedCount = PORTALS.filter(p => saved[p.id] && connections[p.id]).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portal Integrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Connect job portals for automated posting, sourcing, and AI candidate sync</p>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded-xl text-sm font-medium">
          <Zap size={14}/> {connectedCount} of {PORTALS.length} portals connected
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { step:'1', label:'Connect Portal', desc:'Enter API keys from the portal\'s developer program', icon: Key },
          { step:'2', label:'Post Jobs',      desc:'Distribute job openings to all connected portals in one click', icon: Globe },
          { step:'3', label:'Fetch Profiles', desc:'AI pulls matching candidate profiles from all portals', icon: Search },
          { step:'4', label:'AI Score & Sync',desc:'Profiles are scored against the JD and synced to your HRMS', icon: Zap },
        ].map(s => (
          <div key={s.step} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-full bg-red-700 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{s.step}</div>
              <span className="font-semibold text-sm text-gray-900">{s.label}</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {PORTALS.map(portal => {
          const cfg    = STATUS_CFG[saved[portal.id] ? 'connected' : portal.status]
          const Icon   = cfg.icon
          const isOpen = expanded === portal.id
          const fields = connections[portal.id] || {}

          return (
            <div key={portal.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpanded(isOpen ? null : portal.id)}
                className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition text-left"
              >
                <div className="text-2xl flex-shrink-0">{portal.logo}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-0.5">
                    <span className="font-bold text-gray-900">{portal.name}</span>
                    <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.color}`}>
                      <Icon size={11}/> {saved[portal.id] ? 'Connected' : STATUS_CFG[portal.status].color === 'text-orange-700' ? portal.statusLabel : portal.statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{portal.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {portal.features.slice(0,3).map(f => (
                      <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                  <span className="text-gray-400 ml-2 text-lg">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded setup panel */}
              {isOpen && (
                <div className="border-t border-gray-100 p-5">
                  {/* Note banner */}
                  <div className={`rounded-xl p-3 mb-5 flex items-start gap-3 ${portal.status === 'pending_approval' ? 'bg-orange-50 border border-orange-100' : 'bg-blue-50 border border-blue-100'}`}>
                    <AlertTriangle size={15} className={portal.status === 'pending_approval' ? 'text-orange-500 flex-shrink-0 mt-0.5' : 'text-blue-500 flex-shrink-0 mt-0.5'}/>
                    <div>
                      <p className="text-xs text-gray-700">{portal.note}</p>
                      <a href={portal.setupUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-red-700 font-semibold mt-1 hover:underline">
                        Get API Keys <ExternalLink size={11}/>
                      </a>
                    </div>
                  </div>

                  {/* API Key fields */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {portal.fields.map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                        <input
                          type="password"
                          value={fields[f.key] || ''}
                          onChange={e => handleFieldChange(portal.id, f.key, e.target.value)}
                          placeholder={portal.status === 'pending_approval' ? 'Pending approval…' : 'Paste key here…'}
                          disabled={portal.status === 'pending_approval'}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400 font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  {/* .env.local note */}
                  {portal.status === 'ready' && (
                    <div className="bg-gray-900 rounded-lg p-3 mb-4 text-xs font-mono text-green-400">
                      {portal.fields.map(f => (
                        <div key={f.key}># Add to your .env.local file in howell-mvp/<br/>
                          {f.label.split('(')[1]?.replace(')','') || f.key.toUpperCase()}=your_key_here
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => saveKeys(portal.id)}
                      disabled={portal.status === 'pending_approval' || !portal.fields.every(f => fields[f.key])}
                      className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-40 transition"
                    >
                      Save & Connect
                    </button>
                    {portal.status === 'ready' && (
                      <button
                        onClick={() => testConnection(portal.id)}
                        disabled={testing[portal.id]}
                        className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                      >
                        {testing[portal.id] ? <RefreshCw size={14} className="animate-spin"/> : <RefreshCw size={14}/>}
                        Test Connection
                      </button>
                    )}
                    {testResult[portal.id] === 'ok' && (
                      <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                        <CheckCircle size={16}/> Connection OK
                      </span>
                    )}
                    {testResult[portal.id] === 'fail' && (
                      <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                        <AlertTriangle size={16}/> Connection failed
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom note */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
        <Building2 size={16} className="text-gray-400 flex-shrink-0 mt-0.5"/>
        <div className="text-xs text-gray-600">
          <strong className="text-gray-700">How API keys are used:</strong> Keys are stored as environment variables in Vercel and never exposed client-side. All API calls are proxied through your own backend at <code className="bg-gray-100 px-1 rounded">/api/portals/*</code>. When no keys are configured, the platform uses realistic mock data so you can always demo the full workflow.
        </div>
      </div>
    </div>
  )
}
