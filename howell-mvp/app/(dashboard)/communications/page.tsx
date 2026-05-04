'use client'
import { useState, useEffect } from 'react'
import { MessageSquare, Send, Phone, Mail, MessageCircle, Plus, Search, Clock, CheckCheck, X, RefreshCw, Loader2, Bot, Zap } from 'lucide-react'

const CHANNELS = ['All', 'WhatsApp', 'Email', 'SMS']
const STAGES   = ['All Stages', 'Applied', 'Screening', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected']

const TEMPLATES = [
  { stage: 'Applied',     channel: 'WhatsApp', text: 'Hi {name}, we received your application for {role} at Howell. We will review and get back to you within 3 business days.' },
  { stage: 'Shortlisted', channel: 'WhatsApp', text: 'Hi {name}, great news! You have been shortlisted for {role}. Our team will contact you to schedule an interview.' },
  { stage: 'Interview',   channel: 'Email',    text: 'Dear {name}, your interview for {role} is scheduled on {date} at {time}. Meeting link: {link}. Please confirm your attendance.' },
  { stage: 'Offer',       channel: 'Email',    text: 'Dear {name}, we are delighted to extend an offer for the {role} position. Please find attached the offer letter for your review.' },
  { stage: 'Hired',       channel: 'WhatsApp', text: 'Welcome to Howell, {name}! We are excited to have you on board as {role}. Your joining date is {date}.' },
  { stage: 'Rejected',    channel: 'Email',    text: 'Dear {name}, thank you for your interest in {role} at Howell. After careful consideration, we will not be moving forward at this time.' },
]

const CHANNEL_COLORS: Record<string, string> = {
  WhatsApp: 'bg-green-100 text-green-700',
  Email:    'bg-blue-100 text-blue-700',
  SMS:      'bg-purple-100 text-purple-700',
}
const CHANNEL_ICONS: Record<string, any> = {
  WhatsApp: MessageCircle,
  Email:    Mail,
  SMS:      Phone,
}

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1)   return 'Just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  const diffH = Math.floor(diffMins / 60)
  if (diffH < 24)     return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1)    return 'Yesterday'
  return `${diffD} days ago`
}

export default function CommunicationsPage() {
  const [messages, setMessages]       = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeChannel, setActiveChannel] = useState('All')
  const [activeStage, setActiveStage]     = useState('All Stages')
  const [search, setSearch]               = useState('')
  const [showCompose, setShowCompose]     = useState(false)
  const [compose, setCompose]             = useState({ to: '', channel: 'WhatsApp', message: '', stage: '' })
  const [sending, setSending]             = useState(false)
  const [toast, setToast]                 = useState('')

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeChannel !== 'All')        params.set('channel', activeChannel)
      if (activeStage !== 'All Stages')   params.set('stage', activeStage)
      if (search)                         params.set('candidate', search)
      const res  = await fetch(`/api/communications?${params}`)
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeChannel, activeStage])

  function useTemplate(t: any) {
    setCompose(c => ({ ...c, channel: t.channel, message: t.text, stage: t.stage }))
    setShowCompose(true)
  }

  async function sendMessage() {
    if (!compose.to || !compose.message) return
    setSending(true)
    try {
      const res = await fetch('/api/communications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name:  compose.to,
          channel:         compose.channel,
          stage:           compose.stage || null,
          message:         compose.message,
          direction:       'out',
          auto_triggered:  false,
        }),
      })
      if (res.ok) {
        setShowCompose(false)
        setCompose({ to: '', channel: 'WhatsApp', message: '', stage: '' })
        setToast('Message sent successfully!')
        setTimeout(() => setToast(''), 3000)
        load()
      }
    } finally {
      setSending(false)
    }
  }

  // Client-side search filter (in addition to server-side)
  const filtered = messages.filter(m => {
    if (!search) return true
    return m.candidate_name?.toLowerCase().includes(search.toLowerCase())
  })

  const totalSent  = messages.filter(m => m.direction === 'out').length
  const whatsappCt = messages.filter(m => m.channel === 'WhatsApp').length
  const emailCt    = messages.filter(m => m.channel === 'Email').length
  const smsCt      = messages.filter(m => m.channel === 'SMS').length
  const autoCt     = messages.filter(m => m.auto_triggered).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communications Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">Multi-channel messaging — WhatsApp, Email & SMS</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            <RefreshCw size={15}/>
          </button>
          <button onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            <Plus size={16}/> Send Message
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CheckCheck size={16}/> {toast}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Sent',      value: totalSent,   color: 'text-gray-700' },
          { label: 'WhatsApp',        value: whatsappCt,  color: 'text-green-700' },
          { label: 'Email',           value: emailCt,     color: 'text-blue-700' },
          { label: 'SMS',             value: smsCt,       color: 'text-purple-700' },
          { label: 'Auto-triggered',  value: autoCt,      color: 'text-red-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Message list */}
        <div className="col-span-2">
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            {CHANNELS.map(c => (
              <button key={c} onClick={() => setActiveChannel(c)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${activeChannel === c ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {c}
              </button>
            ))}
            <select value={activeStage} onChange={e => setActiveStage(e.target.value)}
              className="text-xs border border-gray-200 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-600">
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="ml-auto relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidate…"
                className="pl-7 pr-7 py-1.5 border border-gray-200 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-40"/>
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12}/>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">
                <Loader2 size={20} className="animate-spin mx-auto mb-2"/><div className="text-sm">Loading messages…</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                No messages yet. Send the first one using a template →
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((m: any) => {
                  const Icon = CHANNEL_ICONS[m.channel] || MessageSquare
                  return (
                    <div key={m.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${CHANNEL_COLORS[m.channel] || 'bg-gray-100 text-gray-600'}`}>
                        <Icon size={16}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">{m.candidate_name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CHANNEL_COLORS[m.channel] || 'bg-gray-100 text-gray-600'}`}>{m.channel}</span>
                          {m.stage && <span className="text-xs text-gray-400">{m.stage}</span>}
                          {m.auto_triggered && (
                            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <Zap size={9}/> Auto
                            </span>
                          )}
                          <span className="text-xs text-gray-400 ml-auto">{formatTime(m.sent_at)}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{m.direction === 'in' ? '↩ ' : ''}{m.message}</p>
                      </div>
                      <div className="flex-shrink-0 text-xs text-gray-400">
                        {m.status === 'read'      ? <CheckCheck size={14} className="text-blue-500"/> :
                         m.status === 'delivered' ? <CheckCheck size={14} className="text-gray-400"/> :
                                                    <Clock size={14}/>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Templates + auto-trigger info */}
        <div className="col-span-1 space-y-4">
          {/* Auto-trigger notice */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bot size={15} className="text-red-700"/>
              <span className="text-sm font-semibold text-red-800">Auto-triggered messages</span>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              Messages are automatically sent when a candidate's pipeline stage changes — shortlisted, interview scheduled, offer extended, hired, or rejected.
            </p>
          </div>

          <h3 className="font-semibold text-gray-900 text-sm">Message Templates</h3>
          <div className="space-y-2">
            {TEMPLATES.map((t, i) => {
              const Icon = CHANNEL_ICONS[t.channel] || MessageSquare
              return (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-700">{t.stage}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ml-auto ${CHANNEL_COLORS[t.channel]}`}>{t.channel}</span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{t.text}</p>
                  <button onClick={() => useTemplate(t)}
                    className="w-full text-xs text-red-700 hover:text-red-800 font-medium border border-red-200 rounded-lg py-1.5 hover:bg-red-50 transition">
                    Use Template
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Send Message</h2>
              <button onClick={() => setShowCompose(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To (Candidate Name)</label>
                <input value={compose.to} onChange={e => setCompose(c => ({ ...c, to: e.target.value }))}
                  placeholder="e.g. Rohit Sharma"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                  <select value={compose.channel} onChange={e => setCompose(c => ({ ...c, channel: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option>WhatsApp</option><option>Email</option><option>SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select value={compose.stage} onChange={e => setCompose(c => ({ ...c, stage: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {STAGES.map(s => <option key={s} value={s === 'All Stages' ? '' : s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={compose.message} onChange={e => setCompose(c => ({ ...c, message: e.target.value }))} rows={4}
                  placeholder="Type your message…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCompose(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={sendMessage} disabled={!compose.to || !compose.message || sending}
                className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {sending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
