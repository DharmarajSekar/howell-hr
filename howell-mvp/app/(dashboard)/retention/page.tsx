'use client'
import { useState } from 'react'
import { TrendingDown, AlertTriangle, Zap, Bell, CheckCircle, Users, TrendingUp } from 'lucide-react'

const EMPLOYEES = [
  { id:'1', name:'Karan Malhotra', role:'Site Engineer',        site:'Mumbai',    riskScore: 78, riskLevel:'high',   reasons:['Low performance rating (3.1)','3 unresolved grievances','No promotion in 2 years'], lastEngagement: '2026-04-15', intervention: null },
  { id:'2', name:'Arjun Mehta',    role:'Project Manager',      site:'Delhi',     riskScore: 62, riskLevel:'high',   reasons:['2 grievances this quarter','Below-market salary','Work-life imbalance'],             lastEngagement: '2026-04-10', intervention: null },
  { id:'3', name:'Sneha Krishnan', role:'Data Analyst',         site:'Hyderabad', riskScore: 38, riskLevel:'medium', reasons:['No career growth plan','Skills underutilized'],                                      lastEngagement: '2026-04-20', intervention: 'Career discussion scheduled' },
  { id:'4', name:'Rohit Sharma',   role:'ELV Engineer',         site:'Mumbai',    riskScore: 25, riskLevel:'low',    reasons:['Recently shortlisted for promotion'],                                                lastEngagement: '2026-04-22', intervention: null },
  { id:'5', name:'Priya Nair',     role:'HR Manager',           site:'Bengaluru', riskScore: 15, riskLevel:'low',    reasons:['Strong performance','Good engagement scores'],                                       lastEngagement: '2026-04-21', intervention: null },
  { id:'6', name:'Amit Singh',     role:'HR Business Partner',  site:'Bengaluru', riskScore: 10, riskLevel:'low',    reasons:['Recently hired with competitive offer'],                                             lastEngagement: '2026-04-23', intervention: null },
]

const RISK_CFG: Record<string,{color:string;bg:string;bar:string}> = {
  high:   { color:'text-red-700',    bg:'bg-red-50 border-red-200',    bar:'bg-red-500' },
  medium: { color:'text-yellow-700', bg:'bg-yellow-50 border-yellow-200', bar:'bg-yellow-400' },
  low:    { color:'text-green-700',  bg:'bg-green-50 border-green-200', bar:'bg-green-400' },
}

export default function RetentionPage() {
  const [selected, setSelected]       = useState<any>(null)
  const [interventions, setInterv]    = useState<Record<string,string>>({})

  function triggerIntervention(empId: string) {
    const msg = `Manager 1-on-1 scheduled. HR pulse check initiated. Compensation review queued.`
    setInterv(prev => ({ ...prev, [empId]: msg }))
  }

  const highRisk   = EMPLOYEES.filter(e=>e.riskLevel==='high').length
  const mediumRisk = EMPLOYEES.filter(e=>e.riskLevel==='medium').length
  const avgRisk    = Math.round(EMPLOYEES.reduce((s,e)=>s+e.riskScore,0)/EMPLOYEES.length)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retention Risk Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-powered attrition prediction and early warning system</p>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded-xl text-sm font-medium">
          <Zap size={14}/> AI Monitoring Active
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'High Risk',        value: highRisk,   color: 'text-red-700 bg-red-50' },
          { label: 'Medium Risk',      value: mediumRisk, color: 'text-yellow-700 bg-yellow-50' },
          { label: 'Low Risk',         value: EMPLOYEES.filter(e=>e.riskLevel==='low').length, color: 'text-green-700 bg-green-50' },
          { label: 'Avg Risk Score',   value: avgRisk+'%', color: 'text-gray-700 bg-white' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* High risk alert banner */}
      {highRisk > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <div>
            <div className="text-sm font-bold text-red-800 mb-1">⚠ Early Warning — {highRisk} employees at high attrition risk</div>
            <p className="text-xs text-red-600">AI has detected risk signals in performance data, grievance history, and engagement scores. Immediate manager intervention recommended.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 space-y-2">
          {[...EMPLOYEES].sort((a,b)=>b.riskScore-a.riskScore).map(e => {
            const cfg = RISK_CFG[e.riskLevel]
            return (
              <div key={e.id} onClick={() => setSelected(e)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id===e.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-sm flex-shrink-0">{e.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">{e.name}</div>
                    <div className="text-xs text-gray-500">{e.role} · {e.site}</div>
                  </div>
                  <span className={`text-sm font-bold ${cfg.color}`}>{e.riskScore}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className={`${cfg.bar} h-1.5 rounded-full`} style={{ width: `${e.riskScore}%` }}/>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.color}`}>{e.riskLevel}</span>
                </div>
                {interventions[e.id] && <div className="mt-2 text-xs text-green-600 flex items-center gap-1"><CheckCircle size={11}/>Intervention triggered</div>}
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
                    <h2 className="font-bold text-gray-900">{selected.name}</h2>
                    <p className="text-sm text-gray-500">{selected.role} · {selected.site}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-black ${RISK_CFG[selected.riskLevel].color}`}>{selected.riskScore}%</div>
                    <div className="text-xs text-gray-500">attrition risk</div>
                  </div>
                </div>
                <div className="mt-3 bg-gray-100 rounded-full h-2.5">
                  <div className={`${RISK_CFG[selected.riskLevel].bar} h-2.5 rounded-full transition-all`} style={{ width:`${selected.riskScore}%` }}/>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1.5"><Zap size={12} className="text-purple-500"/> AI Risk Signals</h3>
                  <div className="space-y-1.5">
                    {selected.reasons.map((r: string, i: number) => (
                      <div key={i} className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-700">
                        <AlertTriangle size={13}/> {r}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-sm">
                  <div className="text-xs text-gray-500 mb-0.5">Last Engagement Check</div>
                  <div className="font-medium text-gray-800">{selected.lastEngagement}</div>
                </div>
                {interventions[selected.id] ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1"><CheckCircle size={16} className="text-green-500"/><span className="text-sm font-bold text-green-700">Intervention Triggered</span></div>
                    <p className="text-xs text-green-600">{interventions[selected.id]}</p>
                  </div>
                ) : (
                  <button onClick={() => triggerIntervention(selected.id)}
                    className="w-full bg-red-700 hover:bg-red-800 text-white py-3 rounded-xl text-sm font-semibold transition">
                    Trigger AI Retention Intervention
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <TrendingDown size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select an employee to view risk signals and trigger intervention</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
