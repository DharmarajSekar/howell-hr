'use client'
import { useState } from 'react'
import { DoorOpen, Plus, TrendingDown, BarChart2, AlertCircle, CheckCircle, Clock } from 'lucide-react'

const EXIT_REASONS = ['Better Opportunity','Higher Salary','Work-Life Balance','Manager Issues','Career Growth','Relocation','Personal Reasons','Site Conditions','Other']

const MOCK_EXITS = [
  { id:'1', name:'Divya Iyer',   role:'HR Analyst',      site:'Bengaluru', reason:'Better Opportunity', status:'completed', noticePeriod:'30 days', lastDay:'2026-04-30', assetsReturned: true,  clearance: true,  exitScore: 3.2, feedback:'Great work culture but limited growth opportunities in analytics.' },
  { id:'2', name:'Suresh Rajan', role:'ELV Engineer',    site:'Mumbai',    reason:'Higher Salary',       status:'in_progress', noticePeriod:'30 days', lastDay:'2026-05-15', assetsReturned: false, clearance: false, exitScore: null, feedback:'' },
  { id:'3', name:'Prerna Nair',  role:'Site Supervisor', site:'Pune',      reason:'Site Conditions',     status:'initiated',   noticePeriod:'15 days', lastDay:'2026-05-05', assetsReturned: false, clearance: false, exitScore: null, feedback:'' },
]

const ATTRITION_BY_REASON = [
  { reason: 'Better Opportunity', count: 8 },
  { reason: 'Higher Salary',      count: 6 },
  { reason: 'Work-Life Balance',  count: 4 },
  { reason: 'Site Conditions',    count: 3 },
  { reason: 'Manager Issues',     count: 2 },
  { reason: 'Other',              count: 3 },
]

const STATUS_CFG: Record<string,{color:string;label:string}> = {
  initiated:   { color: 'bg-gray-100 text-gray-600',    label: 'Initiated' },
  in_progress: { color: 'bg-yellow-100 text-yellow-700', label: 'In Progress' },
  completed:   { color: 'bg-green-100 text-green-700',  label: 'Completed' },
}

export default function ExitPage() {
  const [exits, setExits]       = useState(MOCK_EXITS)
  const [selected, setSelected] = useState<any>(null)
  const [showNew, setShowNew]   = useState(false)
  const [form, setForm]         = useState({ name:'', role:'', site:'', reason: EXIT_REASONS[0], noticePeriod:'30 days', lastDay:'' })
  const maxCount = Math.max(...ATTRITION_BY_REASON.map(r=>r.count))

  function submitExit() {
    setExits(prev => [{ id:String(Date.now()), ...form, status:'initiated', assetsReturned:false, clearance:false, exitScore:null, feedback:'' }, ...prev])
    setShowNew(false)
    setForm({ name:'', role:'', site:'', reason:EXIT_REASONS[0], noticePeriod:'30 days', lastDay:'' })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exit Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">End-to-end exit lifecycle, analytics, and attrition insights</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Record Exit
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Exits (YTD)', value: exits.length + 23 },
          { label: 'In Progress',       value: exits.filter(e=>e.status!=='completed').length },
          { label: 'Attrition Rate',    value: '12.4%' },
          { label: 'Avg Tenure',        value: '2.8 yrs' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Exit list */}
        <div className="col-span-2">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Active Exit Cases</h3>
          <div className="space-y-2">
            {exits.map(e => (
              <div key={e.id} onClick={() => setSelected(e)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id===e.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{e.name}</div>
                    <div className="text-xs text-gray-500">{e.role} · {e.site}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CFG[e.status]?.color}`}>{STATUS_CFG[e.status]?.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">{e.reason}</span>
                  <span>Last day: {e.lastDay}</span>
                  <span className={e.assetsReturned?'text-green-600':'text-red-500'}>{e.assetsReturned?'✓ Assets':'⚠ Assets pending'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attrition chart */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 text-sm mb-4">Attrition by Reason</h3>
          <div className="space-y-2.5">
            {ATTRITION_BY_REASON.map(r => (
              <div key={r.reason}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{r.reason}</span>
                  <span className="font-medium">{r.count}</span>
                </div>
                <div className="bg-gray-100 rounded-full h-1.5">
                  <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${(r.count/maxCount)*100}%` }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected detail */}
      {selected && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Exit Clearance Checklist — {selected.name}</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Knowledge Transfer',  done: selected.status !== 'initiated' },
              { label: 'Assets Returned',     done: selected.assetsReturned },
              { label: 'Final Clearance',     done: selected.clearance },
              { label: 'Exit Interview',      done: !!selected.exitScore },
              { label: 'Full & Final Payout', done: selected.status === 'completed' },
              { label: 'Experience Letter',   done: selected.status === 'completed' },
            ].map(c => (
              <div key={c.label} className={`flex items-center gap-2.5 p-3 rounded-xl border ${c.done?'bg-green-50 border-green-200':'bg-gray-50 border-gray-100'}`}>
                {c.done ? <CheckCircle size={16} className="text-green-500"/> : <Clock size={16} className="text-gray-400"/>}
                <span className={`text-sm font-medium ${c.done?'text-green-700':'text-gray-500'}`}>{c.label}</span>
              </div>
            ))}
          </div>
          {selected.feedback && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="text-xs font-semibold text-blue-700 mb-1">Exit Interview Feedback</div>
              <p className="text-sm text-gray-700">{selected.feedback}</p>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Record Employee Exit</h2>
            <div className="space-y-3">
              {[['Employee Name','name'],['Job Role','role'],['Site / Location','site']].map(([l,k]) => (
                <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              ))}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Exit Reason</label>
                <select value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {EXIT_REASONS.map(r=><option key={r}>{r}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Working Day</label>
                <input type="date" value={form.lastDay} onChange={e=>setForm(f=>({...f,lastDay:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNew(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={submitExit} disabled={!form.name||!form.lastDay} className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">Record Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
