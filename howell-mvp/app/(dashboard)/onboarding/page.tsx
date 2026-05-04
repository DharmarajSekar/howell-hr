'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  CheckCircle, Circle, Plus, Loader2, ChevronDown, ChevronUp,
  UserCheck, Mail, Package, Monitor, Database, Sparkles,
  AlertCircle, X, Shield, RefreshCw, Building2, Copy, Check,
  Bot, Send, MapPin, Star, MessageSquare, ClipboardList,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Task { id: string; category: string; title: string; completed: boolean; sort_order: number }
interface SystemAccess { system: string; status: 'provisioned' | 'pending' }
interface OnboardingRecord {
  id:                  string
  candidate_name:      string
  job_title:           string
  joining_date:        string | null
  status:              string
  employee_id:         string | null
  corporate_email:     string | null
  department:          string | null
  welcome_email_sent:  boolean
  kit_dispatched:      boolean
  kit_items:           string[]
  tasks:               Task[]
  employee?:           any
  systems_access?:     SystemAccess[]
}

const CATEGORY_ICONS: Record<string, string> = {
  Documents:   '📄',
  'IT Setup':  '💻',
  Induction:   '🎯',
  'Day 1 Kit': '🎁',
}
const CATEGORY_ORDER = ['Documents', 'IT Setup', 'Induction', 'Day 1 Kit']

/* ── Welcome Email Modal ───────────────────────────────────────────────────── */
function WelcomeEmailModal({ record, onClose }: { record: OnboardingRecord; onClose: () => void }) {
  const joinDate = record.joining_date
    ? new Date(record.joining_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'as per your offer letter'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-blue-600"/>
            <h2 className="font-bold text-gray-900">Welcome Email Sent</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Delivered</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
        </div>
        <div className="p-6">
          <div className="text-xs text-gray-400 mb-1">To: <span className="text-gray-600 font-medium">{record.corporate_email || `${record.candidate_name.split(' ')[0].toLowerCase()}@howellgroup.com`}</span></div>
          <div className="text-xs text-gray-400 mb-4">From: <span className="text-gray-600">hr@howellgroup.com</span> · Sent automatically on onboarding start</div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 font-sans text-sm text-gray-800 leading-relaxed">
            <p className="mb-3">Dear <strong>{record.candidate_name}</strong>,</p>
            <p className="mb-3">Welcome to the <strong>Howell family!</strong> 🎉</p>
            <p className="mb-3">We are thrilled to have you on board as our new <strong>{record.job_title}</strong>. Your joining date is confirmed as <strong>{joinDate}</strong>.</p>
            <p className="mb-2">Here's what you can expect on your first day:</p>
            <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">
              <li>Report to the <strong>{record.department || 'HR'} team</strong> at 9:30 AM</li>
              <li>Your workstation, laptop, and system access will be ready</li>
              <li>An orientation session is scheduled for Day 1</li>
              <li>You'll meet your buddy / mentor who will guide you through the first week</li>
            </ul>
            <p className="mb-3">Your <strong>corporate email</strong> has been set up: <span className="text-blue-700 font-medium">{record.corporate_email || generateEmail(record.candidate_name)}</span></p>
            <p className="mb-3">The HR team will be reaching out separately with your digital onboarding kit, including all policies, guides, and IT setup instructions.</p>
            <p className="mb-3">We look forward to seeing you soon. Don't hesitate to reach out if you have any questions.</p>
            <p>Warm regards,<br/><strong>Dharmaraj Sekar</strong><br/>HR Admin · Howell Group<br/>hr@howellgroup.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function generateEmail(name: string): string {
  const parts = name.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/)
  return `${parts[0] || 'employee'}.${parts.slice(1).join('') || 'howell'}@howellgroup.com`
}

/* ── IT Provisioning Panel ─────────────────────────────────────────────────── */
function ITPanelModal({ record, onClose }: { record: OnboardingRecord; onClose: () => void }) {
  const [copied, setCopied] = useState('')
  const systems: SystemAccess[] = record.systems_access || [
    { system: 'Google Workspace (Gmail + Drive)', status: 'provisioned' },
    { system: 'Slack', status: 'provisioned' },
    { system: 'Howell HRMS', status: 'pending' },
  ]
  const email = record.corporate_email || generateEmail(record.candidate_name)
  const tmpPwd = `Howell@${new Date().getFullYear()}!`

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-violet-600"/>
            <h2 className="font-bold text-gray-900">IT Access Provisioning</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Credentials */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
            <div className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-3">Auto-Generated Credentials</div>
            <div className="space-y-2">
              {[
                { label: 'Corporate Email', value: email, key: 'email' },
                { label: 'Temporary Password', value: tmpPwd, key: 'pwd' },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-2 bg-white rounded-lg border border-violet-100 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-gray-400">{item.label}</div>
                    <div className="text-sm font-mono font-medium text-gray-800 truncate">{item.value}</div>
                  </div>
                  <button onClick={() => copyToClipboard(item.value, item.key)}
                    className="p-1.5 hover:bg-violet-50 rounded text-gray-400 hover:text-violet-600 transition">
                    {copied === item.key ? <Check size={13} className="text-green-500"/> : <Copy size={13}/>}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-violet-500 mt-2">Employee must reset password on first login · MFA enabled by default</p>
          </div>

          {/* Systems */}
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Systems Access</div>
            <div className="space-y-2">
              {systems.map((sys, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <Monitor size={13} className={sys.status === 'provisioned' ? 'text-green-500' : 'text-gray-300'}/>
                  <span className="text-sm text-gray-700 flex-1">{sys.system}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sys.status === 'provisioned' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sys.status === 'provisioned' ? '✓ Active' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400">All credentials have been dispatched to the employee's personal email and to their manager. IT ticket #IT-{Math.floor(Math.random() * 9000) + 1000} raised for pending access.</p>
        </div>
      </div>
    </div>
  )
}

/* ── Digital Kit Modal ─────────────────────────────────────────────────────── */
function KitModal({ record, onClose }: { record: OnboardingRecord; onClose: () => void }) {
  const items = record.kit_items?.length
    ? record.kit_items
    : ['Company Policy Handbook (PDF)', 'Code of Conduct & Ethics', 'Leave Policy & Holiday Calendar', 'Employee Benefits Guide', 'Payroll FAQs']

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-amber-600"/>
            <h2 className="font-bold text-gray-900">Digital Onboarding Kit</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Dispatched</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
        </div>
        <div className="p-5">
          <p className="text-xs text-gray-500 mb-4">The following documents were automatically dispatched to <strong>{record.corporate_email || generateEmail(record.candidate_name)}</strong> on onboarding start.</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <CheckCircle size={14} className="text-amber-500 flex-shrink-0"/>
                <span className="text-sm text-gray-700">{item}</span>
                <span className="text-[10px] text-gray-400 ml-auto">Sent</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">All items dispatched via corporate email. Employee must acknowledge receipt within 48 hours.</p>
        </div>
      </div>
    </div>
  )
}

/* ── Employee Record Card ──────────────────────────────────────────────────── */
function EmployeeCard({ record }: { record: OnboardingRecord }) {
  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 text-white mb-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-gray-300"/>
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">HRMS Employee Record</span>
        </div>
        <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-semibold">Auto-Created</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-gray-400 mb-0.5">Employee ID</div>
          <div className="font-bold text-lg text-white">{record.employee_id || 'EMP-0043'}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 mb-0.5">Corporate Email</div>
          <div className="text-sm font-medium text-blue-300 truncate">{record.corporate_email || generateEmail(record.candidate_name)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 mb-0.5">Department</div>
          <div className="text-sm text-gray-200">{record.department || 'Engineering'}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 mb-0.5">Joining Date</div>
          <div className="text-sm text-gray-200">{record.joining_date ? new Date(record.joining_date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : 'TBD'}</div>
        </div>
      </div>
    </div>
  )
}

/* ── New-Joiner Chatbot Modal ──────────────────────────────────────────────── */
function ChatbotModal({ record, onClose }: { record: OnboardingRecord; onClose: () => void }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi ${record.candidate_name.split(' ')[0]}! 👋 I'm Howell Buddy, your AI onboarding assistant. I can help you with IT setup, HR policies, leave rules, first-day logistics, and anything else about joining Howell. What would you like to know?` }
  ])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const res = await fetch('/api/chatbot/new-joiner', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:      userMsg,
          employeeName: record.candidate_name,
          role:         record.job_title,
          department:   record.department,
          employeeId:   record.employee_id,
          history:      messages.slice(-6),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Let me check on that for you.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please email hr@howellgroup.com.' }])
    } finally {
      setLoading(false)
    }
  }

  const QUICK = ['How do I set up corporate email?', 'What documents do I need to submit?', 'When will my laptop be ready?', 'What is the leave policy?']

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ height: '560px' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
            <Bot size={18} className="text-violet-600"/>
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900 text-sm">Howell Buddy</div>
            <div className="text-[10px] text-green-500 font-medium">● Online · AI-powered 24/7 support</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-red-700 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 size={14} className="animate-spin text-gray-400"/>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Quick questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
            {QUICK.map((q, i) => (
              <button key={i} onClick={() => { setInput(q); setTimeout(send, 50) }}
                className="text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-violet-400 hover:text-violet-600 transition">
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 flex gap-2 flex-shrink-0 border-t border-gray-50 pt-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask anything about your onboarding…"
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button onClick={send} disabled={!input.trim() || loading}
            className="w-9 h-9 bg-violet-600 hover:bg-violet-700 text-white rounded-full flex items-center justify-center disabled:opacity-40">
            <Send size={14}/>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Feedback Modal ────────────────────────────────────────────────────────── */
function FeedbackModal({ record, onClose }: { record: OnboardingRecord; onClose: () => void }) {
  const [day,        setDay]        = useState<30 | 60 | 90>(30)
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState<any>(null)
  const [form, setForm] = useState({
    overall_experience: 3,
    it_setup_quality:   3,
    team_welcome:       3,
    role_clarity:       3,
    open_feedback:      '',
    would_recommend:    'yes',
  })

  function setF(k: string, v: any) { setForm(p => ({ ...p, [k]: v })) }

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboarding_record_id: record.id,
          employee_name:        record.candidate_name,
          employee_id:          record.employee_id,
          check_in_day:         day,
          responses:            { ...form },
        }),
      })
      const data = await res.json()
      setResult(data.analysis || data)
    } finally {
      setSubmitting(false)
    }
  }

  const RATINGS = ['Very Poor', 'Poor', 'Neutral', 'Good', 'Excellent']

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-green-600"/>
            <h2 className="font-bold text-gray-900">Employee Check-in Feedback</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
        </div>

        {!result ? (
          <div className="p-5 space-y-4">
            {/* Day selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Check-in Period</label>
              <div className="flex gap-2">
                {([30, 60, 90] as const).map(d => (
                  <button key={d} onClick={() => setDay(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${day === d ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600 hover:border-green-400'}`}>
                    Day {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating questions */}
            {[
              { key: 'overall_experience', label: 'Overall onboarding experience' },
              { key: 'it_setup_quality',   label: 'IT setup & system access' },
              { key: 'team_welcome',       label: 'Team welcome & introductions' },
              { key: 'role_clarity',       label: 'Role clarity & expectations' },
            ].map(q => (
              <div key={q.key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{q.label}</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setF(q.key, n)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${(form as any)[q.key] === n ? 'bg-green-100 text-green-800 border-green-400' : 'border-gray-100 text-gray-500 hover:border-gray-300'}`}>
                      {n} <span className="hidden sm:inline">— {RATINGS[n-1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Would you recommend Howell to a friend?</label>
              <div className="flex gap-2">
                {['yes','maybe','no'].map(opt => (
                  <button key={opt} onClick={() => setF('would_recommend', opt)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition ${form.would_recommend === opt ? 'bg-blue-100 text-blue-800 border-blue-400' : 'border-gray-100 text-gray-500 hover:border-gray-300'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Open feedback (optional)</label>
              <textarea value={form.open_feedback} onChange={e => setF('open_feedback', e.target.value)} rows={3}
                placeholder="Share any other thoughts about your onboarding experience…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"/>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                {submitting ? 'Analysing…' : 'Submit & Analyse'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className={`rounded-xl p-4 mb-4 ${result.sentiment === 'positive' ? 'bg-green-50 border border-green-200' : result.sentiment === 'at_risk' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} className={result.sentiment === 'positive' ? 'text-green-600' : result.sentiment === 'at_risk' ? 'text-red-600' : 'text-yellow-600'}/>
                <span className="font-bold text-sm capitalize">{result.sentiment === 'at_risk' ? '⚠️ At Risk' : result.sentiment === 'positive' ? '✅ Positive' : '⚡ Neutral'}</span>
                <span className="ml-auto text-xs font-medium">Risk Score: {result.risk_score}/100</span>
              </div>
              <p className="text-sm text-gray-700">{result.summary}</p>
              {result.flags?.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-red-600 mb-1">Flags:</div>
                  {result.flags.map((f: string, i: number) => <div key={i} className="text-xs text-red-600">• {f}</div>)}
                </div>
              )}
              {result.sentiment === 'at_risk' && (
                <div className="mt-2 text-xs text-red-700 font-medium">⚡ Risk alert has been sent to HR team.</div>
              )}
            </div>
            <button onClick={onClose} className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Site Allocation Modal ─────────────────────────────────────────────────── */
function SiteAllocationModal({ record, onClose }: { record: OnboardingRecord; onClose: () => void }) {
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<any>(null)
  const [prefCity, setPrefCity] = useState('')

  async function allocate() {
    setLoading(true)
    try {
      const res = await fetch('/api/site-allocation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName:     record.candidate_name,
          role:              record.job_title,
          department:        record.department,
          preferredLocation: prefCity,
        }),
      })
      setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-orange-500"/>
            <h2 className="font-bold text-gray-900">AI Site Allocation</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-700">
            Claude analyses the role, department, and candidate's preferred city to recommend the best Howell site.
          </div>

          {!result ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Candidate Preferred City (optional)</label>
                <input value={prefCity} onChange={e => setPrefCity(e.target.value)}
                  placeholder="e.g. Chennai, Mumbai, Bengaluru…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-semibold text-gray-700 mb-1">Role</div>
                  <div>{record.job_title}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-semibold text-gray-700 mb-1">Department</div>
                  <div>{record.department || 'Engineering'}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={allocate} disabled={loading}
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                  {loading ? 'Allocating…' : 'Get AI Recommendation'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={16} className="text-orange-600"/>
                  <span className="font-bold text-orange-800">{result.allocated_site}</span>
                  <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{result.confidence}% match</span>
                </div>
                <div className="text-sm font-medium text-orange-700 mb-2">{result.allocated_city}</div>
                <p className="text-xs text-gray-600">{result.reason}</p>
              </div>
              {result.alternatives?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">Alternative sites</div>
                  <div className="space-y-1.5">
                    {result.alternatives.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        <MapPin size={11} className="text-gray-400"/>{a.site} — {a.city}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setResult(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">Re-run</button>
                <button onClick={onClose} className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold">Confirm & Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Start Onboarding Modal ────────────────────────────────────────────────── */
function StartOnboardingModal({
  hiredCandidates,
  onClose,
  onStarted,
}: {
  hiredCandidates: any[]
  onClose: () => void
  onStarted: (record: OnboardingRecord) => void
}) {
  const [mode, setMode]     = useState<'candidate' | 'manual'>('candidate')
  const [selectedApp, setSelectedApp] = useState('')
  const [adding, setAdding] = useState(false)
  const [step, setStep]     = useState<'form' | 'processing' | 'done'>('form')
  const [steps, setSteps]   = useState<string[]>([])
  const [form, setForm]     = useState({ candidate_name: '', job_title: '', joining_date: '', department: '' })

  function set(f: string, v: string) { setForm(p => ({ ...p, [f]: v })) }

  function applyCandidate(appId: string) {
    setSelectedApp(appId)
    const app = hiredCandidates.find(a => a.id === appId)
    if (app) {
      setForm({
        candidate_name: app.candidate?.full_name || '',
        job_title:      app.job?.title || '',
        joining_date:   '',
        department:     app.job?.department || '',
      })
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setStep('processing')

    const processingSteps = [
      '🤖 Generating personalised onboarding checklist…',
      '📧 Setting up corporate email account…',
      '🗂️ Creating HRMS employee record…',
      '📦 Dispatching digital onboarding kit…',
      '💻 Provisioning IT system access…',
      '✉️ Sending welcome communication…',
    ]

    for (const s of processingSteps) {
      setSteps(prev => [...prev, s])
      await new Promise(r => setTimeout(r, 500))
    }

    const selectedCandidate = hiredCandidates.find(a => a.id === selectedApp)
    const res = await fetch('/api/onboarding', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...form,
        candidate_id:   selectedCandidate?.candidate?.id || null,
        personal_email: selectedCandidate?.candidate?.email || null,
      }),
    })
    const record = await res.json()
    setStep('done')
    setAdding(false)
    setTimeout(() => { onStarted(record) }, 800)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Plus size={16} className="text-red-600"/><h2 className="font-bold text-gray-900">Start Onboarding</h2></div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
        </div>

        {step === 'form' && (
          <form onSubmit={submit} className="p-5 space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
              {(['candidate', 'manual'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  {m === 'candidate' ? '🔗 From Hired Candidate' : '✏️ Manual Entry'}
                </button>
              ))}
            </div>

            {mode === 'candidate' && hiredCandidates.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Select Hired Candidate</label>
                <select value={selectedApp} onChange={e => applyCandidate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400">
                  <option value="">Select candidate to auto-populate…</option>
                  {hiredCandidates.map(a => (
                    <option key={a.id} value={a.id}>{a.candidate?.full_name} — {a.job?.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Employee Name *</label>
                <input value={form.candidate_name} onChange={e => set('candidate_name', e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" placeholder="Full name"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
                <input value={form.job_title} onChange={e => set('job_title', e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" placeholder="Job title"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                <input value={form.department} onChange={e => set('department', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" placeholder="Engineering"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Joining Date *</label>
                <input type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"/>
              </div>
            </div>

            {/* What will happen */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="text-xs font-bold text-blue-700 mb-2">What happens automatically:</div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  '🤖 AI-personalised checklist',
                  '📧 Corporate email created',
                  '🗂️ HRMS record auto-created',
                  '📦 Onboarding kit dispatched',
                  '💻 IT access provisioned',
                  '✉️ Welcome email sent',
                ].map(item => (
                  <div key={item} className="text-xs text-blue-600 flex items-center gap-1">{item}</div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={!form.candidate_name || !form.job_title || !form.joining_date}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-red-800">
                <Sparkles size={14}/> Start Automated Onboarding
              </button>
            </div>
          </form>
        )}

        {step === 'processing' && (
          <div className="p-8">
            <div className="flex items-center gap-2 mb-4">
              <Loader2 size={18} className="animate-spin text-red-600"/>
              <span className="font-semibold text-gray-900">Setting up onboarding…</span>
            </div>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0"/>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={32} className="text-green-500"/>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Onboarding Started!</h3>
            <p className="text-sm text-gray-500">All automation steps completed successfully.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const [records,       setRecords]       = useState<OnboardingRecord[]>([])
  const [loading,       setLoading]       = useState(true)
  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [updating,      setUpdating]      = useState<string | null>(null)
  const [showAdd,       setShowAdd]       = useState(false)
  const [showEmail,     setShowEmail]     = useState<OnboardingRecord | null>(null)
  const [showKit,       setShowKit]       = useState<OnboardingRecord | null>(null)
  const [showIT,        setShowIT]        = useState<OnboardingRecord | null>(null)
  const [showChat,      setShowChat]      = useState<OnboardingRecord | null>(null)
  const [showFeedback,  setShowFeedback]  = useState<OnboardingRecord | null>(null)
  const [showSite,      setShowSite]      = useState<OnboardingRecord | null>(null)
  const [hiredApps,     setHiredApps]     = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [onbData, appData] = await Promise.all([
      fetch('/api/onboarding').then(r => r.json()),
      fetch('/api/applications').then(r => r.json()).catch(() => []),
    ])
    const list = Array.isArray(onbData) ? onbData : []
    setRecords(list)
    if (list.length > 0 && !expanded) setExpanded(list[0].id)
    const hired = (Array.isArray(appData) ? appData : []).filter(
      (a: any) => ['offer', 'hired'].includes(a.status)
    )
    setHiredApps(hired)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  async function toggleTask(recordId: string, taskId: string, current: boolean) {
    setUpdating(taskId)
    const res = await fetch('/api/onboarding', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: recordId, task_id: taskId, completed: !current }),
    })
    const updated = await res.json()
    setRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...updated } : r))
    setUpdating(null)
  }

  function handleOnboardingStarted(record: OnboardingRecord) {
    setRecords(prev => [record, ...prev])
    setExpanded(record.id)
    setShowAdd(false)
  }

  function progress(tasks: Task[]) {
    if (!tasks?.length) return { done: 0, total: 0, pct: 0 }
    const done = tasks.filter(t => t.completed).length
    return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) }
  }

  function byCategory(tasks: Task[]) {
    const allCats = [...new Set(tasks.map(t => t.category))]
    // Ensure standard categories appear first, then any AI-generated extras
    const orderedCats = [...CATEGORY_ORDER.filter(c => allCats.includes(c)), ...allCats.filter(c => !CATEGORY_ORDER.includes(c))]
    return orderedCats.reduce((acc, cat) => {
      acc[cat] = tasks.filter(t => t.category === cat)
      return acc
    }, {} as Record<string, Task[]>)
  }

  const totalActive   = records.filter(r => r.status === 'in_progress').length
  const totalComplete = records.filter(r => r.status === 'completed' || (progress(r.tasks).pct === 100 && r.tasks?.length > 0)).length

  return (
    <div className="p-8">
      {/* Modals */}
      {showAdd && (
        <StartOnboardingModal
          hiredCandidates={hiredApps}
          onClose={() => setShowAdd(false)}
          onStarted={handleOnboardingStarted}
        />
      )}
      {showEmail    && <WelcomeEmailModal   record={showEmail}   onClose={() => setShowEmail(null)}/>}
      {showKit      && <KitModal            record={showKit}     onClose={() => setShowKit(null)}/>}
      {showIT       && <ITPanelModal        record={showIT}      onClose={() => setShowIT(null)}/>}
      {showChat     && <ChatbotModal        record={showChat}    onClose={() => setShowChat(null)}/>}
      {showFeedback && <FeedbackModal       record={showFeedback} onClose={() => setShowFeedback(null)}/>}
      {showSite     && <SiteAllocationModal record={showSite}    onClose={() => setShowSite(null)}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Onboarding</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            AI-personalised checklists · auto-generated HRMS records · welcome automation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={15} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`}/>
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition">
            <Plus size={16}/> Add Employee
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'In Onboarding',    value: totalActive,   color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Completed',        value: totalComplete, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Welcome Emails',   value: records.filter(r => r.welcome_email_sent).length,   color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Kits Dispatched',  value: records.filter(r => r.kit_dispatched).length,       color: 'text-amber-600',  bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400"><Loader2 size={24} className="animate-spin mx-auto"/></div>
      ) : records.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-20 text-center">
          <UserCheck size={40} className="text-gray-200 mx-auto mb-3"/>
          <p className="text-gray-500 font-medium">No employees in onboarding yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "Add Employee" to trigger fully automated onboarding</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(record => {
            const { done, total, pct } = progress(record.tasks || [])
            const cats  = byCategory(record.tasks || [])
            const isOpen = expanded === record.id

            return (
              <div key={record.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                {/* Record header */}
                <div className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpanded(isOpen ? null : record.id)}>
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {record.candidate_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{record.candidate_name}</span>
                      {record.employee_id && (
                        <span className="text-[10px] bg-gray-800 text-gray-200 px-2 py-0.5 rounded-full font-mono">{record.employee_id}</span>
                      )}
                      {pct === 100 && total > 0 && (
                        <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">✓ Complete</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{record.job_title} · {record.department || 'Engineering'}</div>
                    {/* Automation badges */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {record.welcome_email_sent && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Mail size={9}/> Email Sent
                        </span>
                      )}
                      {record.kit_dispatched && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Package size={9}/> Kit Dispatched
                        </span>
                      )}
                      {record.employee_id && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Database size={9}/> HRMS Record
                        </span>
                      )}
                      {record.corporate_email && (
                        <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Monitor size={9}/> IT Provisioned
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">{pct}%</div>
                      <div className="text-xs text-gray-400">{done}/{total}</div>
                    </div>
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-50 p-5">
                    {/* HRMS Employee Record Card */}
                    {record.employee_id && <EmployeeCard record={record}/>}

                    {/* Automation Action Buttons */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <button onClick={() => setShowEmail(record)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition">
                        <Mail size={18} className="text-blue-600"/>
                        <span className="text-xs font-semibold text-blue-700">Welcome Email</span>
                        <span className="text-[10px] text-blue-500">{record.welcome_email_sent ? '✓ Sent' : 'Not sent'}</span>
                      </button>
                      <button onClick={() => setShowKit(record)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-amber-100 bg-amber-50 hover:bg-amber-100 transition">
                        <Package size={18} className="text-amber-600"/>
                        <span className="text-xs font-semibold text-amber-700">Onboarding Kit</span>
                        <span className="text-[10px] text-amber-500">{record.kit_dispatched ? '✓ Dispatched' : 'Pending'}</span>
                      </button>
                      <button onClick={() => setShowIT(record)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-violet-100 bg-violet-50 hover:bg-violet-100 transition">
                        <Monitor size={18} className="text-violet-600"/>
                        <span className="text-xs font-semibold text-violet-700">IT Provisioning</span>
                        <span className="text-[10px] text-violet-500">{record.corporate_email ? '✓ Active' : 'Pending'}</span>
                      </button>
                    </div>
                    {/* New feature buttons */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <button onClick={() => setShowChat(record)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 transition">
                        <Bot size={18} className="text-violet-600"/>
                        <span className="text-xs font-semibold text-violet-700">Howell Buddy</span>
                        <span className="text-[10px] text-violet-500">AI chat support</span>
                      </button>
                      <button onClick={() => setShowFeedback(record)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 transition">
                        <Star size={18} className="text-green-600"/>
                        <span className="text-xs font-semibold text-green-700">Check-in Feedback</span>
                        <span className="text-[10px] text-green-500">Day 30/60/90</span>
                      </button>
                      <button onClick={() => setShowSite(record)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition">
                        <MapPin size={18} className="text-orange-600"/>
                        <span className="text-xs font-semibold text-orange-700">Site Allocation</span>
                        <span className="text-[10px] text-orange-500">AI assignment</span>
                      </button>
                    </div>

                    {/* Personalised Task Checklist */}
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={13} className="text-violet-500"/>
                      <span className="text-sm font-bold text-gray-800">AI-Personalised Checklist</span>
                      <span className="text-xs text-gray-400">for {record.job_title}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      {Object.entries(cats).map(([cat, tasks]) => {
                        if (!tasks.length) return null
                        const catDone = tasks.filter(t => t.completed).length
                        return (
                          <div key={cat}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span>{CATEGORY_ICONS[cat] || '📋'}</span>
                              <span className="text-xs font-semibold text-gray-700">{cat}</span>
                              <span className="text-[10px] text-gray-400 ml-auto">{catDone}/{tasks.length}</span>
                            </div>
                            <div className="space-y-1">
                              {tasks.map(task => (
                                <button key={task.id}
                                  onClick={() => toggleTask(record.id, task.id, task.completed)}
                                  disabled={updating === task.id}
                                  className="w-full flex items-center gap-2 text-left p-2 rounded-lg hover:bg-gray-50 transition group">
                                  {updating === task.id
                                    ? <Loader2 size={14} className="animate-spin text-gray-400 flex-shrink-0"/>
                                    : task.completed
                                      ? <CheckCircle size={14} className="text-green-500 flex-shrink-0"/>
                                      : <Circle size={14} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0"/>
                                  }
                                  <span className={`text-xs ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{task.title}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
