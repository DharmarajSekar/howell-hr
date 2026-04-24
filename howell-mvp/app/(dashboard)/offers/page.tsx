'use client'
import { useState } from 'react'
import { Gift, Plus, CheckCircle, Clock, XCircle, Send, TrendingUp, DollarSign, FileText, UserCheck } from 'lucide-react'

const MOCK_OFFERS = [
  { id: '1', candidate: 'Neha Gupta',   role: 'Senior Site Engineer',    ctc: 18, status: 'accepted',  approvals: ['HR','Manager','Finance'], currentApproval: 3, sentDate: '2026-04-21', acceptedDate: '2026-04-22', benchmarkMin: 15, benchmarkMax: 20 },
  { id: '2', candidate: 'Amit Singh',   role: 'HR Business Partner',     ctc: 24, status: 'pending',   approvals: ['HR','Manager'], currentApproval: 1, sentDate: '2026-04-22', acceptedDate: null, benchmarkMin: 20, benchmarkMax: 28 },
  { id: '3', candidate: 'Rohit Sharma', role: 'Senior Site Engineer',    ctc: 16, status: 'draft',     approvals: ['HR','Manager','Finance'], currentApproval: 0, sentDate: null, acceptedDate: null, benchmarkMin: 15, benchmarkMax: 20 },
]

const STATUS_CFG: Record<string,{color:string;icon:any;label:string}> = {
  draft:    { color: 'bg-gray-100 text-gray-600',    icon: FileText,    label: 'Draft' },
  pending:  { color: 'bg-yellow-100 text-yellow-700', icon: Clock,       label: 'Pending Approval' },
  sent:     { color: 'bg-blue-100 text-blue-700',    icon: Send,        label: 'Sent to Candidate' },
  accepted: { color: 'bg-green-100 text-green-700',  icon: CheckCircle, label: 'Accepted' },
  declined: { color: 'bg-red-100 text-red-700',      icon: XCircle,     label: 'Declined' },
}

const APPROVAL_LEVELS = ['HR', 'Hiring Manager', 'Finance', 'CEO']

export default function OffersPage() {
  const [offers, setOffers]     = useState(MOCK_OFFERS)
  const [selected, setSelected] = useState<any>(null)
  const [showNew, setShowNew]   = useState(false)
  const [form, setForm]         = useState({ candidate: '', role: '', ctc: '', notes: '' })

  function approve(offerId: string) {
    setOffers(prev => prev.map(o => {
      if (o.id !== offerId) return o
      const next = o.currentApproval + 1
      const done = next >= o.approvals.length
      return { ...o, currentApproval: next, status: done ? 'sent' : 'pending' }
    }))
    setSelected((s: any) => {
      if (!s || s.id !== offerId) return s
      const next = s.currentApproval + 1
      const done = next >= s.approvals.length
      return { ...s, currentApproval: next, status: done ? 'sent' : 'pending' }
    })
  }

  function addOffer() {
    const newOffer: any = {
      id: String(Date.now()),
      candidate: form.candidate,
      role: form.role,
      ctc: Number(form.ctc),
      status: 'draft',
      approvals: ['HR','Manager','Finance'],
      currentApproval: 0,
      sentDate: null,
      acceptedDate: null,
      benchmarkMin: Math.round(Number(form.ctc) * 0.85),
      benchmarkMax: Math.round(Number(form.ctc) * 1.15),
    }
    setOffers(prev => [newOffer, ...prev])
    setShowNew(false)
    setForm({ candidate: '', role: '', ctc: '', notes: '' })
  }

  const accepted = offers.filter(o => o.status === 'accepted').length
  const pending  = offers.filter(o => o.status === 'pending').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offers & Negotiation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage offer letters, approvals, and salary benchmarks</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Create Offer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Offers', value: offers.length },
          { label: 'Pending Approval', value: pending },
          { label: 'Accepted', value: accepted },
          { label: 'Acceptance Rate', value: offers.filter(o=>o.status!=='draft').length ? Math.round(accepted/offers.filter(o=>o.status!=='draft').length*100)+'%' : '—' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 space-y-2">
          {offers.map(o => {
            const cfg = STATUS_CFG[o.status] || STATUS_CFG.draft
            return (
              <div key={o.id} onClick={() => setSelected(o)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id===o.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="font-medium text-sm text-gray-900">{o.candidate}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">{o.role}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-gray-900">₹{o.ctc} LPA</span>
                  <span className="text-gray-400">Benchmark: ₹{o.benchmarkMin}–{o.benchmarkMax} LPA</span>
                </div>
                {/* Approval progress */}
                <div className="flex gap-1 mt-2">
                  {o.approvals.map((a, i) => (
                    <div key={a} className={`flex-1 h-1 rounded-full ${i < o.currentApproval ? 'bg-green-500' : i === o.currentApproval && o.status === 'pending' ? 'bg-yellow-400' : 'bg-gray-200'}`}/>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="col-span-3">
          {selected ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900">{selected.candidate}</h2>
                    <p className="text-sm text-gray-500">{selected.role}</p>
                  </div>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_CFG[selected.status]?.color}`}>
                    {STATUS_CFG[selected.status]?.label}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Salary benchmark */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-green-600"/>
                    <span className="text-sm font-semibold text-gray-900">AI Salary Benchmark</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-0.5">Market Min</div>
                      <div className="text-lg font-bold text-gray-700">₹{selected.benchmarkMin} LPA</div>
                    </div>
                    <div className="flex-1 relative h-3 bg-gray-200 rounded-full">
                      <div className="absolute inset-y-0 left-0 bg-green-400 rounded-full" style={{ width: '100%' }}/>
                      <div className="absolute inset-y-0 bg-red-500 rounded-full w-2 h-3" style={{ left: `${Math.min(95,((selected.ctc - selected.benchmarkMin)/(selected.benchmarkMax - selected.benchmarkMin))*100)}%` }}/>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-0.5">Market Max</div>
                      <div className="text-lg font-bold text-gray-700">₹{selected.benchmarkMax} LPA</div>
                    </div>
                  </div>
                  <div className="text-center mt-2 text-sm font-bold text-red-700">Offered: ₹{selected.ctc} LPA
                    <span className={`ml-2 text-xs font-normal ${selected.ctc <= selected.benchmarkMax ? 'text-green-600' : 'text-red-500'}`}>
                      {selected.ctc <= selected.benchmarkMax ? '✓ Within range' : '⚠ Above market'}
                    </span>
                  </div>
                </div>

                {/* Approval workflow */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Approval Workflow</h3>
                  <div className="space-y-2">
                    {selected.approvals.map((a: string, i: number) => (
                      <div key={a} className={`flex items-center gap-3 p-3 rounded-xl border ${i < selected.currentApproval ? 'bg-green-50 border-green-100' : i === selected.currentApproval ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${i < selected.currentApproval ? 'bg-green-500' : i === selected.currentApproval ? 'bg-yellow-500' : 'bg-gray-300'}`}>
                          {i < selected.currentApproval ? <CheckCircle size={14} className="text-white"/> : <span className="text-white text-xs font-bold">{i+1}</span>}
                        </div>
                        <span className="text-sm font-medium text-gray-700 flex-1">{a}</span>
                        <span className={`text-xs font-medium ${i < selected.currentApproval ? 'text-green-600' : i === selected.currentApproval ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {i < selected.currentApproval ? 'Approved' : i === selected.currentApproval ? 'Pending' : 'Waiting'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {selected.status === 'pending' && (
                    <button onClick={() => approve(selected.id)}
                      className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                      ✓ Approve — {selected.approvals[selected.currentApproval]}
                    </button>
                  )}
                  {selected.status === 'draft' && (
                    <button onClick={() => { setOffers(prev => prev.map(o => o.id===selected.id?{...o,status:'pending'}:o)); setSelected((s:any)=>({...s,status:'pending'})) }}
                      className="w-full mt-3 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                      Submit for Approval
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <Gift size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select an offer to view details and manage approvals</p>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create Offer Letter</h2>
            <div className="space-y-3">
              {[['Candidate Name','candidate','text'],['Job Role','role','text'],['Offered CTC (LPA)','ctc','number']].map(([label,key,type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({...f,notes:e.target.value}))} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={addOffer} disabled={!form.candidate || !form.role || !form.ctc} className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">Create Offer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
