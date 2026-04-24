'use client'
import { useState } from 'react'
import { MessageSquare, Send, Phone, Mail, MessageCircle, Plus, Search, Bot, Clock, CheckCheck, Filter } from 'lucide-react'

const CHANNELS = ['All','WhatsApp','Email','SMS']
const STAGES   = ['All Stages','Applied','Screening','Shortlisted','Interview','Offer','Hired','Rejected']

const TEMPLATES = [
  { stage: 'Applied',      channel: 'WhatsApp', text: 'Hi {name}, we received your application for {role} at Howell. We will review and get back to you within 3 business days.' },
  { stage: 'Shortlisted',  channel: 'WhatsApp', text: 'Hi {name}, great news! You have been shortlisted for {role}. Our team will contact you to schedule an interview.' },
  { stage: 'Interview',    channel: 'Email',    text: 'Dear {name}, your interview for {role} is scheduled on {date} at {time}. Meeting link: {link}. Please confirm your attendance.' },
  { stage: 'Offer',        channel: 'Email',    text: 'Dear {name}, we are delighted to extend an offer for the {role} position. Please find attached the offer letter for your review.' },
  { stage: 'Hired',        channel: 'WhatsApp', text: 'Welcome to Howell, {name}! We are excited to have you on board as {role}. Your joining date is {date}.' },
  { stage: 'Rejected',     channel: 'Email',    text: 'Dear {name}, thank you for your interest in {role} at Howell. After careful consideration, we will not be moving forward at this time.' },
]

const MOCK_MESSAGES = [
  { id: '1', candidate: 'Rohit Sharma',  channel: 'WhatsApp', stage: 'Shortlisted', message: 'Hi Rohit, great news! You have been shortlisted for Senior Site Engineer.', time: '10:15 AM', status: 'read',      direction: 'out' },
  { id: '2', candidate: 'Rohit Sharma',  channel: 'WhatsApp', message: 'Thank you! I am available for the interview.', time: '10:32 AM', status: 'received',  direction: 'in', stage: '' },
  { id: '3', candidate: 'Priya Nair',    channel: 'Email',    stage: 'Interview',   message: 'Dear Priya, your interview is scheduled for 24 April at 10 AM.', time: '9:00 AM',  status: 'delivered', direction: 'out' },
  { id: '4', candidate: 'Amit Singh',    channel: 'Email',    stage: 'Offer',       message: 'Dear Amit, we are delighted to extend an offer for the HRBP position.', time: 'Yesterday', status: 'read', direction: 'out' },
  { id: '5', candidate: 'Neha Gupta',    channel: 'WhatsApp', stage: 'Hired',       message: 'Welcome to Howell, Neha! We are excited to have you on board.', time: 'Yesterday', status: 'read', direction: 'out' },
  { id: '6', candidate: 'Karan Malhotra',channel: 'SMS',      stage: 'Applied',     message: 'Hi Karan, we received your application for Senior Site Engineer.', time: '2 days ago', status: 'delivered', direction: 'out' },
]

const CHANNEL_COLORS: Record<string,string> = {
  WhatsApp: 'bg-green-100 text-green-700',
  Email:    'bg-blue-100 text-blue-700',
  SMS:      'bg-purple-100 text-purple-700',
}
const CHANNEL_ICONS: Record<string,any> = {
  WhatsApp: MessageCircle,
  Email:    Mail,
  SMS:      Phone,
}

export default function CommunicationsPage() {
  const [activeChannel, setActiveChannel] = useState('All')
  const [activeStage, setActiveStage]     = useState('All Stages')
  const [search, setSearch]               = useState('')
  const [showCompose, setShowCompose]     = useState(false)
  const [compose, setCompose]             = useState({ to: '', channel: 'WhatsApp', message: '', stage: '' })
  const [messages, setMessages]           = useState(MOCK_MESSAGES)
  const [activeTemplate, setActiveTemplate] = useState<any>(null)
  const [sent, setSent]                   = useState(false)

  const filtered = messages.filter(m => {
    const matchCh = activeChannel === 'All' || m.channel === activeChannel
    const matchSt = activeStage === 'All Stages' || m.stage === activeStage
    const matchSr = !search || m.candidate.toLowerCase().includes(search.toLowerCase())
    return matchCh && matchSt && matchSr
  })

  function useTemplate(t: any) {
    setCompose(c => ({ ...c, channel: t.channel, message: t.text, stage: t.stage }))
    setActiveTemplate(t)
  }

  function sendMessage() {
    const newMsg = {
      id: String(Date.now()),
      candidate: compose.to,
      channel: compose.channel,
      stage: compose.stage,
      message: compose.message,
      time: 'Just now',
      status: 'delivered',
      direction: 'out',
    }
    setMessages(prev => [newMsg, ...prev])
    setShowCompose(false)
    setCompose({ to: '', channel: 'WhatsApp', message: '', stage: '' })
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communications Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">Multi-channel messaging — WhatsApp, Email & SMS</p>
        </div>
        <button onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Send Message
        </button>
      </div>

      {sent && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2"><CheckCheck size={16}/> Message sent successfully!</div>}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Sent',     value: messages.filter(m=>m.direction==='out').length, color: 'text-gray-700' },
          { label: 'WhatsApp',       value: messages.filter(m=>m.channel==='WhatsApp').length, color: 'text-green-700' },
          { label: 'Email',          value: messages.filter(m=>m.channel==='Email').length, color: 'text-blue-700' },
          { label: 'SMS',            value: messages.filter(m=>m.channel==='SMS').length, color: 'text-purple-700' },
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
          <div className="flex gap-2 mb-4 flex-wrap">
            {CHANNELS.map(c => (
              <button key={c} onClick={() => setActiveChannel(c)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${activeChannel===c?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {c}
              </button>
            ))}
            <div className="ml-auto relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-red-500"/>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">No messages found.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(m => {
                  const Icon = CHANNEL_ICONS[m.channel] || MessageSquare
                  return (
                    <div key={m.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${CHANNEL_COLORS[m.channel]}`}>
                        <Icon size={16}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-gray-900">{m.candidate}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CHANNEL_COLORS[m.channel]}`}>{m.channel}</span>
                          {m.stage && <span className="text-xs text-gray-400">{m.stage}</span>}
                          <span className="text-xs text-gray-400 ml-auto">{m.time}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{m.direction==='in'?'→ ':''}{m.message}</p>
                      </div>
                      <div className="flex-shrink-0 text-xs text-gray-400">{m.status==='read'?<CheckCheck size={14} className="text-blue-500"/>:m.status==='delivered'?<CheckCheck size={14} className="text-gray-400"/>:<Clock size={14}/>}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Templates */}
        <div className="col-span-1">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Message Templates</h3>
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
                  <button onClick={() => { useTemplate(t); setShowCompose(true) }}
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">Send Message</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To (Candidate Name)</label>
                <input value={compose.to} onChange={e => setCompose(c=>({...c,to:e.target.value}))}
                  placeholder="e.g. Rohit Sharma"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                  <select value={compose.channel} onChange={e => setCompose(c=>({...c,channel:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option>WhatsApp</option><option>Email</option><option>SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select value={compose.stage} onChange={e => setCompose(c=>({...c,stage:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {STAGES.map(s => <option key={s} value={s==='All Stages'?'':s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={compose.message} onChange={e => setCompose(c=>({...c,message:e.target.value}))} rows={4}
                  placeholder="Type your message…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowCompose(false); setCompose({ to:'',channel:'WhatsApp',message:'',stage:'' }) }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={sendMessage} disabled={!compose.to || !compose.message}
                className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <Send size={14}/> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
