'use client'
import { useState } from 'react'
import { UserCog, FileText, Calendar, Download, CreditCard, Monitor, ArrowRightLeft, Home, Plus, CheckCircle, Clock, XCircle, Bot, Send } from 'lucide-react'

const TABS = ['Leave','Documents','IT & Access','Transfers','AI Assistant']

const LEAVE_TYPES = ['Annual Leave','Sick Leave','Casual Leave','Maternity/Paternity','Unpaid Leave','Emergency Leave']

const LEAVE_BALANCES = [
  { type: 'Annual Leave',    total: 18, used: 5, remaining: 13 },
  { type: 'Sick Leave',      total: 12, used: 2, remaining: 10 },
  { type: 'Casual Leave',    total: 6,  used: 1, remaining: 5 },
]

const MOCK_LEAVES = [
  { id: '1', type: 'Annual Leave',   from: '2026-05-10', to: '2026-05-12', days: 3, reason: 'Family vacation', status: 'approved' },
  { id: '2', type: 'Sick Leave',     from: '2026-04-15', to: '2026-04-16', days: 2, reason: 'Fever and rest', status: 'approved' },
  { id: '3', type: 'Casual Leave',   from: '2026-06-01', to: '2026-06-01', days: 1, reason: 'Personal work', status: 'pending' },
]

const MOCK_DOCS = [
  { id: '1', name: 'Offer Letter — HR Business Partner',    date: '2026-04-01', type: 'Offer Letter' },
  { id: '2', name: 'Payslip — March 2026',                  date: '2026-04-05', type: 'Payslip' },
  { id: '3', name: 'Payslip — February 2026',               date: '2026-03-05', type: 'Payslip' },
  { id: '4', name: 'Experience Letter',                     date: '2026-01-15', type: 'Letter' },
]

const IT_REQUESTS = [
  { id: '1', item: 'Laptop — Dell Latitude 5540',   status: 'completed', date: '2026-04-20' },
  { id: '2', item: 'Email Account Setup',            status: 'completed', date: '2026-04-20' },
  { id: '3', item: 'VPN Access',                     status: 'in_progress', date: '2026-04-22' },
  { id: '4', item: 'Slack & Teams Access',           status: 'pending',  date: '2026-04-23' },
]

const AI_QA = [
  { q: 'How many leave days do I have remaining?', a: 'You have 13 Annual Leave days, 10 Sick Leave days, and 5 Casual Leave days remaining for 2026.' },
  { q: 'When is my next salary credit?', a: 'Salaries are credited on the last working day of each month. Your next credit is on 30th April 2026.' },
  { q: 'How do I apply for a transfer?', a: 'Go to the Transfers tab in ESS and raise a transfer request. It will go to your manager and HR for approval.' },
  { q: 'What documents can I download?', a: 'You can download payslips, offer letters, experience letters, and Form 16 from the Documents tab.' },
]

const STATUS_CFG: Record<string,{color:string;icon:any}> = {
  approved:    { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending:     { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  rejected:    { color: 'bg-red-100 text-red-700', icon: XCircle },
  completed:   { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  in_progress: { color: 'bg-blue-100 text-blue-700', icon: Clock },
}

export default function ESSPage() {
  const [activeTab, setActiveTab]   = useState('Leave')
  const [showLeave, setShowLeave]   = useState(false)
  const [leaveForm, setLeaveForm]   = useState({ type: LEAVE_TYPES[0], from: '', to: '', reason: '' })
  const [leaves, setLeaves]         = useState(MOCK_LEAVES)
  const [chatInput, setChatInput]   = useState('')
  const [chatHistory, setChatHistory] = useState<{q:string;a:string}[]>([])
  const [itItems, setItItems]       = useState(IT_REQUESTS)
  const [newIt, setNewIt]           = useState('')

  function submitLeave() {
    const days = leaveForm.from && leaveForm.to
      ? Math.ceil((new Date(leaveForm.to).getTime()-new Date(leaveForm.from).getTime())/(86400000))+1 : 1
    setLeaves(prev => [{ id: String(Date.now()), ...leaveForm, days, status: 'pending' }, ...prev])
    setShowLeave(false)
    setLeaveForm({ type: LEAVE_TYPES[0], from:'', to:'', reason:'' })
  }

  function askAI() {
    const q = chatInput.trim(); if (!q) return
    const known = AI_QA.find(x => x.q.toLowerCase().includes(q.toLowerCase().split(' ').find(w=>w.length>4)||q))
    const a = known?.a || 'I will raise a support ticket for this query. Our HR team will respond within 24 hours. Ticket #' + Math.floor(Math.random()*9000+1000) + ' created.'
    setChatHistory(h => [...h, { q, a }])
    setChatInput('')
  }

  function addItRequest() {
    if (!newIt) return
    setItItems(prev => [{ id: String(Date.now()), item: newIt, status: 'pending', date: new Date().toISOString().split('T')[0] }, ...prev])
    setNewIt('')
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employee Self-Service</h1>
        <p className="text-sm text-gray-500 mt-0.5">Leave, documents, IT access, transfers and AI assistant — all in one place</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${activeTab===t?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Leave Tab */}
      {activeTab === 'Leave' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {LEAVE_BALANCES.map(b => (
              <div key={b.type} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{b.type}</span>
                  <span className="text-xs text-gray-400">{b.used}/{b.total} used</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{b.remaining}</div>
                <div className="bg-gray-200 rounded-full h-1.5">
                  <div className="bg-red-600 h-1.5 rounded-full" style={{ width: `${(b.used/b.total)*100}%` }}/>
                </div>
                <div className="text-xs text-gray-400 mt-1">days remaining</div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Leave History</h3>
            <button onClick={() => setShowLeave(true)} className="flex items-center gap-2 bg-red-700 text-white text-sm px-3 py-2 rounded-lg hover:bg-red-800 transition">
              <Plus size={14}/> Apply Leave
            </button>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Type','From','To','Days','Reason','Status'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leaves.map(l => {
                  const cfg = STATUS_CFG[l.status]
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{l.type}</td>
                      <td className="px-4 py-3 text-gray-600">{l.from}</td>
                      <td className="px-4 py-3 text-gray-600">{l.to}</td>
                      <td className="px-4 py-3 text-gray-600">{l.days}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{l.reason}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.color}`}>{l.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'Documents' && (
        <div className="space-y-3">
          {MOCK_DOCS.map(d => (
            <div key={d.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0"><FileText size={20} className="text-blue-600"/></div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">{d.name}</div>
                <div className="text-xs text-gray-500">{d.type} · {d.date}</div>
              </div>
              <button className="flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">
                <Download size={14}/> Download
              </button>
            </div>
          ))}
        </div>
      )}

      {/* IT & Access Tab */}
      {activeTab === 'IT & Access' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={newIt} onChange={e => setNewIt(e.target.value)} placeholder="Request new IT access or asset…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
            <button onClick={addItRequest} disabled={!newIt} className="bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">Request</button>
          </div>
          <div className="space-y-2">
            {itItems.map(r => {
              const cfg = STATUS_CFG[r.status]
              return (
                <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.color}`}><cfg.icon size={16}/></div>
                  <div className="flex-1"><div className="font-medium text-sm text-gray-900">{r.item}</div><div className="text-xs text-gray-500">{r.date}</div></div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>{r.status.replace('_',' ')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === 'Transfers' && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 shadow-sm text-center">
          <ArrowRightLeft size={48} className="mx-auto text-gray-300 mb-4"/>
          <h3 className="font-semibold text-gray-900 mb-2">Transfer & Relocation Requests</h3>
          <p className="text-sm text-gray-500 mb-4">Submit requests for site transfer, location change, or accommodation updates. Requests go to your manager and HR for approval.</p>
          <button className="bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-red-800 transition">Raise Transfer Request</button>
        </div>
      )}

      {/* AI Assistant Tab */}
      {activeTab === 'AI Assistant' && (
        <div className="max-w-2xl">
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col h-[480px]">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-red-700 to-red-800 rounded-t-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><Bot size={16} className="text-white"/></div>
              <div><div className="font-semibold text-white text-sm">Howell HR Assistant</div><div className="text-red-200 text-xs">Always-on support for employee queries</div></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"><Bot size={14} className="text-red-700"/></div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm text-sm text-gray-700">Hi! I'm your HR Assistant. Ask me anything about leaves, payroll, documents, policies, or raise a request.</div>
              </div>
              {chatHistory.map((c,i) => (
                <div key={i} className="space-y-3">
                  <div className="flex gap-3 justify-end">
                    <div className="bg-red-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-sm text-sm">{c.q}</div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"><Bot size={14} className="text-red-700"/></div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm text-sm text-gray-700">{c.a}</div>
                  </div>
                </div>
              ))}
              {/* Quick questions */}
              {chatHistory.length === 0 && (
                <div className="space-y-2">
                  {AI_QA.slice(0,3).map((qa,i) => (
                    <button key={i} onClick={() => { setChatHistory([{q:qa.q,a:qa.a}]) }}
                      className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2 border border-gray-100 transition">
                      {qa.q}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key==='Enter' && askAI()}
                placeholder="Ask anything about HR, leaves, payroll…"
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
              <button onClick={askAI} className="bg-red-700 text-white rounded-xl px-4 flex items-center justify-center hover:bg-red-800">
                <Send size={16}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Apply Leave</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select value={leaveForm.type} onChange={e => setLeaveForm(f=>({...f,type:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {LEAVE_TYPES.map(l=><option key={l}>{l}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(f=>({...f,from:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(f=>({...f,to:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea value={leaveForm.reason} onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowLeave(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={submitLeave} disabled={!leaveForm.from||!leaveForm.to} className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
