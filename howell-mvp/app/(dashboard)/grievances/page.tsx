'use client'
import { useState } from 'react'
import { AlertCircle, Plus, Zap, Clock, CheckCircle, AlertTriangle, XCircle, Flag } from 'lucide-react'

const CATEGORIES = ['Salary & Compensation','Accommodation','Supervisor Behaviour','Safety & Health','Leave & Attendance','Harassment / POSH','Career Growth','Other']
const PRIORITIES  = ['Low','Medium','High','Critical']

const MOCK_TICKETS = [
  { id: 'GRV-001', employee: 'Karan Malhotra', category: 'Salary & Compensation', title: 'Salary not credited for March 2026', priority: 'High',     status: 'open',        anonymous: false, created: '2026-04-20', sla: '2026-04-22', aiFlag: false },
  { id: 'GRV-002', employee: 'Anonymous',       category: 'Harassment / POSH',    title: 'Inappropriate behaviour by supervisor', priority: 'Critical', status: 'escalated',   anonymous: true,  created: '2026-04-19', sla: '2026-04-21', aiFlag: true },
  { id: 'GRV-003', employee: 'Arjun Mehta',     category: 'Accommodation',        title: 'Unhygienic conditions at Pune Site B', priority: 'Medium',   status: 'in_progress', anonymous: false, created: '2026-04-18', sla: '2026-04-25', aiFlag: false },
  { id: 'GRV-004', employee: 'Vikram Rajan',    category: 'Safety & Health',      title: 'Missing safety equipment on site', priority: 'High',     status: 'resolved',    anonymous: false, created: '2026-04-15', sla: '2026-04-17', aiFlag: false },
  { id: 'GRV-005', employee: 'Anonymous',       category: 'Supervisor Behaviour', title: 'Verbal abuse from project manager', priority: 'High',     status: 'open',        anonymous: true,  created: '2026-04-21', sla: '2026-04-23', aiFlag: true },
]

const STATUS_CFG: Record<string,{color:string;label:string}> = {
  open:        { color: 'bg-blue-100 text-blue-700',   label: 'Open' },
  in_progress: { color: 'bg-yellow-100 text-yellow-700', label: 'In Progress' },
  escalated:   { color: 'bg-red-100 text-red-700',     label: 'Escalated' },
  resolved:    { color: 'bg-green-100 text-green-700', label: 'Resolved' },
  closed:      { color: 'bg-gray-100 text-gray-600',   label: 'Closed' },
}

const PRIORITY_COLORS: Record<string,string> = {
  Low: 'bg-gray-100 text-gray-600', Medium: 'bg-yellow-100 text-yellow-700', High: 'bg-orange-100 text-orange-700', Critical: 'bg-red-100 text-red-700',
}

export default function GrievancesPage() {
  const [tickets, setTickets]   = useState(MOCK_TICKETS)
  const [selected, setSelected] = useState<any>(null)
  const [showNew, setShowNew]   = useState(false)
  const [form, setForm]         = useState({ category: CATEGORIES[0], title: '', description: '', priority: 'Medium', anonymous: false })

  function submitTicket() {
    const id = 'GRV-' + String(tickets.length + 1).padStart(3,'0')
    const aiFlag = form.category === 'Harassment / POSH' || form.priority === 'Critical'
    setTickets(prev => [{
      id, employee: form.anonymous ? 'Anonymous' : 'Current User',
      category: form.category, title: form.title, priority: form.priority,
      status: aiFlag ? 'escalated' : 'open', anonymous: form.anonymous,
      created: new Date().toISOString().split('T')[0],
      sla: new Date(Date.now()+172800000).toISOString().split('T')[0],
      aiFlag,
    }, ...prev])
    setShowNew(false)
    setForm({ category: CATEGORIES[0], title:'', description:'', priority:'Medium', anonymous:false })
  }

  const openCount     = tickets.filter(t=>t.status==='open'||t.status==='in_progress').length
  const criticalCount = tickets.filter(t=>t.priority==='Critical').length
  const flaggedCount  = tickets.filter(t=>t.aiFlag).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grievance Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-prioritized complaint tracking with SLA monitoring</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Raise Ticket
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open Tickets',    value: openCount,     color: 'text-blue-700 bg-blue-50' },
          { label: 'Critical',        value: criticalCount, color: 'text-red-700 bg-red-50' },
          { label: 'AI Flagged',      value: flaggedCount,  color: 'text-orange-700 bg-orange-50' },
          { label: 'Resolved',        value: tickets.filter(t=>t.status==='resolved').length, color: 'text-green-700 bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 space-y-2">
          {tickets.map(t => (
            <div key={t.id} onClick={() => setSelected(t)}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id===t.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">{t.id}</span>
                  {t.aiFlag && <Zap size={13} className="text-orange-500"/>}
                  {t.anonymous && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 rounded">Anon</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CFG[t.status]?.color}`}>{STATUS_CFG[t.status]?.label}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">{t.title}</p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                <span className="text-gray-400">{t.category}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">SLA: {t.sla}</div>
            </div>
          ))}
        </div>

        <div className="col-span-3">
          {selected ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{selected.id}</span>
                      {selected.aiFlag && <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium"><Zap size={11}/> AI Flagged</span>}
                    </div>
                    <h2 className="font-bold text-gray-900">{selected.title}</h2>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_CFG[selected.status]?.color}`}>{STATUS_CFG[selected.status]?.label}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[selected.priority]}`}>{selected.priority} Priority</span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{selected.category}</span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">by {selected.employee}</span>
                  <span className="text-gray-400 ml-auto">Raised: {selected.created}</span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {selected.aiFlag && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                    <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>
                    <div>
                      <div className="text-sm font-bold text-red-700 mb-0.5">AI Auto-Escalated</div>
                      <p className="text-xs text-red-600">This ticket involves sensitive content (harassment/POSH or critical priority). Auto-escalated to HR Head and Legal team. Confidential handling activated.</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-0.5">SLA Deadline</div>
                    <div className="text-sm font-bold text-gray-900">{selected.sla}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-0.5">Category</div>
                    <div className="text-sm font-bold text-gray-900">{selected.category}</div>
                  </div>
                </div>
                {selected.status !== 'resolved' && (
                  <div className="flex gap-2">
                    {selected.status === 'open' && (
                      <button onClick={() => setTickets(prev=>prev.map(t=>t.id===selected.id?{...t,status:'in_progress'}:t))}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Mark In Progress</button>
                    )}
                    <button onClick={() => { setTickets(prev=>prev.map(t=>t.id===selected.id?{...t,status:'resolved'}:t)); setSelected((s:any)=>({...s,status:'resolved'})) }}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">Mark Resolved</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <AlertCircle size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select a ticket to view details and take action</p>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Raise Grievance Ticket</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                </select></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.anonymous} onChange={e=>setForm(f=>({...f,anonymous:e.target.checked}))} className="rounded text-red-700"/>
                <span className="text-sm text-gray-700">Submit anonymously (POSH support)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNew(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={submitTicket} disabled={!form.title} className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">Submit Ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
