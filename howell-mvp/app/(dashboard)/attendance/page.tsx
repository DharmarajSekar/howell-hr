'use client'
import { useState } from 'react'
import { Activity, AlertTriangle, CheckCircle, Clock, Users, TrendingUp, Calendar, Filter, Zap } from 'lucide-react'

const EMPLOYEES = [
  { id:'1', name:'Amit Singh',    role:'HR Business Partner',   site:'Bengaluru HQ',  present: true,  checkin:'09:02',checkout:'18:45', anomaly: null },
  { id:'2', name:'Neha Gupta',    role:'Senior Site Engineer',  site:'Mumbai Site A', present: true,  checkin:'08:55',checkout:'17:30', anomaly: null },
  { id:'3', name:'Rohit Sharma',  role:'ELV Engineer',          site:'Mumbai Site A', present: false, checkin: null,  checkout: null,   anomaly: 'missing_punch' },
  { id:'4', name:'Priya Nair',    role:'HR Manager',            site:'Bengaluru HQ',  present: true,  checkin:'09:30',checkout:null,    anomaly: null },
  { id:'5', name:'Karan Malhotra',role:'Site Engineer',         site:'Pune Site B',   present: true,  checkin:'07:45',checkout:'20:00', anomaly: 'overtime' },
  { id:'6', name:'Arjun Mehta',   role:'Project Manager',       site:'Delhi Site C',  present: false, checkin:null,   checkout:null,    anomaly: 'absent' },
  { id:'7', name:'Sneha Krishnan',role:'Data Analyst',          site:'Hyderabad HQ',  present: true,  checkin:'09:15',checkout:'18:00', anomaly: null },
  { id:'8', name:'Vikram Rajan',  role:'ELV Engineer',          site:'Mumbai Site A', present: true,  checkin:'08:30',checkout:'17:00', anomaly: null },
]

const ANOMALY_CFG: Record<string,{label:string;color:string;icon:any}> = {
  missing_punch: { label: 'Missing Punch',    color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  overtime:      { label: 'Overtime Alert',   color: 'bg-orange-100 text-orange-700', icon: Clock },
  absent:        { label: 'Unplanned Absent', color: 'bg-red-100 text-red-600',       icon: AlertTriangle },
}

export default function AttendancePage() {
  const [filter, setFilter] = useState('all')
  const [today] = useState(new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))

  const shown = EMPLOYEES.filter(e =>
    filter === 'all' ? true :
    filter === 'present' ? e.present :
    filter === 'absent' ? !e.present :
    filter === 'anomaly' ? !!e.anomaly : true
  )

  const presentCount = EMPLOYEES.filter(e=>e.present).length
  const absentCount  = EMPLOYEES.filter(e=>!e.present).length
  const anomalyCount = EMPLOYEES.filter(e=>e.anomaly).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today} · Real-time attendance with AI anomaly detection</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-sm font-medium">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
          Live Tracking Active
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Present Today',   value: presentCount, pct: Math.round(presentCount/EMPLOYEES.length*100)+'%', color: 'text-green-700 bg-green-50' },
          { label: 'Absent',          value: absentCount,  pct: Math.round(absentCount/EMPLOYEES.length*100)+'%',  color: 'text-red-700 bg-red-50' },
          { label: 'Anomalies',       value: anomalyCount, pct: 'Needs attention', color: 'text-orange-700 bg-orange-50' },
          { label: 'On-time Arrival', value: '85%', pct: 'of present employees', color: 'text-blue-700 bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{s.pct}</div>
          </div>
        ))}
      </div>

      {/* Anomaly alerts */}
      {anomalyCount > 0 && (
        <div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-orange-500"/>
            <span className="text-sm font-semibold text-orange-800">AI Anomaly Alerts ({anomalyCount})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EMPLOYEES.filter(e=>e.anomaly).map(e => {
              const cfg = ANOMALY_CFG[e.anomaly!]
              return (
                <div key={e.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${cfg.color}`}>
                  <cfg.icon size={13}/> {e.name} — {cfg.label}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[['all','All Employees'],['present','Present'],['absent','Absent'],['anomaly','Anomalies']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${filter===k?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Attendance table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{['Employee','Role','Site','Status','Check-In','Check-Out','Hours','Anomaly'].map(h=>(
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shown.map(e => {
              const hours = e.checkin && e.checkout
                ? (new Date(`2026-01-01T${e.checkout}`).getTime()-new Date(`2026-01-01T${e.checkin}`).getTime())/3600000
                : null
              const anomalyCfg = e.anomaly ? ANOMALY_CFG[e.anomaly] : null
              return (
                <tr key={e.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${e.present?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                        {e.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{e.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{e.role}</td>
                  <td className="px-4 py-3 text-gray-500">{e.site}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.present?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                      {e.present?'Present':'Absent'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.checkin||'—'}</td>
                  <td className="px-4 py-3 text-gray-600">{e.checkout||'—'}</td>
                  <td className="px-4 py-3 text-gray-600">{hours ? `${hours.toFixed(1)}h` : '—'}</td>
                  <td className="px-4 py-3">
                    {anomalyCfg ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${anomalyCfg.color}`}>{anomalyCfg.label}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
