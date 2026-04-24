'use client'
import { useState } from 'react'
import { BookOpen, Plus, CheckCircle, Clock, AlertTriangle, Award, Zap, Users, TrendingUp, Shield } from 'lucide-react'

const CATEGORIES = ['Technical','Safety & Health','Compliance','Leadership','Soft Skills','HR & Policy','Other']

const COURSES = [
  { id:'CRS-001', title:'Fire Safety & Evacuation',      category:'Safety & Health', duration:'4 hrs',  mandatory: true,  completionRate: 92, dueDate:'2026-05-31', provider:'Internal',           description:'Fire safety protocols, emergency evacuation, and first aid basics for all site employees.' },
  { id:'CRS-002', title:'POSH Awareness Training',       category:'Compliance',      duration:'2 hrs',  mandatory: true,  completionRate: 88, dueDate:'2026-04-30', provider:'External - LexiCorp', description:'Prevention of Sexual Harassment at workplace — statutory requirement for all employees.' },
  { id:'CRS-003', title:'ELV Systems Fundamentals',      category:'Technical',       duration:'16 hrs', mandatory: false, completionRate: 45, dueDate:'2026-06-30', provider:'Honeywell Academy',   description:'Structured cabling, CCTV, access control, and BMS fundamentals for ELV engineers.' },
  { id:'CRS-004', title:'Leadership for New Managers',   category:'Leadership',      duration:'8 hrs',  mandatory: false, completionRate: 60, dueDate:'2026-07-15', provider:'Dale Carnegie',       description:'Transition from individual contributor to people manager — communication, delegation, feedback.' },
  { id:'CRS-005', title:'ISO 45001 — Occupational Safety',category:'Compliance',     duration:'6 hrs',  mandatory: true,  completionRate: 78, dueDate:'2026-05-15', provider:'Bureau Veritas',      description:'Occupational health and safety management systems awareness course.' },
  { id:'CRS-006', title:'Data Privacy & GDPR Basics',   category:'HR & Policy',     duration:'1.5 hrs',mandatory: true,  completionRate: 95, dueDate:'2026-04-30', provider:'Internal',            description:'Data handling, employee privacy rights, and GDPR obligations for HR and admin staff.' },
  { id:'CRS-007', title:'Advanced Excel & Power BI',    category:'Technical',       duration:'12 hrs', mandatory: false, completionRate: 30, dueDate:'2026-08-01', provider:'LinkedIn Learning',   description:'Data analysis, dashboards, and business intelligence for operations and HR staff.' },
]

const EMPLOYEES = [
  { id:'EMP-001', name:'Amit Singh',    role:'HR Business Partner',  completions: ['CRS-001','CRS-002','CRS-006'], pending: ['CRS-003'] },
  { id:'EMP-002', name:'Neha Gupta',    role:'Senior Site Engineer', completions: ['CRS-001','CRS-003','CRS-005'], pending: ['CRS-002','CRS-006'] },
  { id:'EMP-003', name:'Karan Malhotra',role:'Site Engineer',        completions: ['CRS-001'],                    pending: ['CRS-002','CRS-005','CRS-006'] },
  { id:'EMP-004', name:'Arjun Mehta',   role:'Project Manager',      completions: ['CRS-001','CRS-002','CRS-004','CRS-006'], pending: ['CRS-005'] },
  { id:'EMP-005', name:'Priya Nair',    role:'HR Manager',           completions: ['CRS-001','CRS-002','CRS-004','CRS-006','CRS-007'], pending: [] },
]

export default function TrainingPage() {
  const [selected, setSelected]     = useState<any>(null)
  const [activeTab, setActiveTab]   = useState<'catalog'|'compliance'>('catalog')
  const [showNew, setShowNew]       = useState(false)
  const [courses, setCourses]       = useState(COURSES)
  const [filterCat, setFilterCat]   = useState('All')
  const [form, setForm]             = useState({ title:'', category: CATEGORIES[0], duration:'', provider:'', mandatory: false, dueDate:'', description:'' })

  const overallCompletion = Math.round(COURSES.reduce((s,c)=>s+c.completionRate,0)/COURSES.length)
  const mandatoryGap = EMPLOYEES.filter(e => {
    const mandatoryCourses = COURSES.filter(c=>c.mandatory).map(c=>c.id)
    return mandatoryCourses.some(id => !e.completions.includes(id))
  }).length

  const filteredCourses = filterCat === 'All' ? courses : courses.filter(c => c.category === filterCat)

  function submitCourse() {
    const id = 'CRS-' + String(courses.length + 1).padStart(3,'0')
    setCourses(prev => [{ id, ...form, completionRate: 0 }, ...prev])
    setShowNew(false)
    setForm({ title:'', category: CATEGORIES[0], duration:'', provider:'', mandatory: false, dueDate:'', description:'' })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training & Compliance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Course catalog, certification tracking, and compliance monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            <Plus size={16}/> Add Course
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Courses',       value: courses.length,                          color: 'bg-white' },
          { label: 'Avg Completion',      value: overallCompletion + '%',                 color: 'bg-green-50 text-green-700' },
          { label: 'Mandatory Courses',   value: courses.filter(c=>c.mandatory).length,   color: 'bg-red-50 text-red-700' },
          { label: 'Compliance Gap',      value: mandatoryGap + ' employees',             color: 'bg-orange-50 text-orange-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {mandatoryGap > 0 && (
        <div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5"/>
          <div>
            <div className="text-sm font-bold text-orange-800 mb-1">⚠ {mandatoryGap} employees have incomplete mandatory training</div>
            <p className="text-xs text-orange-600">POSH and safety certifications are statutory requirements. Automatic reminders have been queued.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {[['catalog','Course Catalog'],['compliance','Compliance Tracker']].map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab===k?'border-red-700 text-red-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {activeTab === 'catalog' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {['All', ...CATEGORIES].map(c => (
              <button key={c} onClick={() => setFilterCat(c)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${filterCat===c?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-3">
              {filteredCourses.map(c => (
                <div key={c.id} onClick={() => setSelected(c)}
                  className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id===c.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-gray-900">{c.title}</span>
                        {c.mandatory && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Mandatory</span>}
                      </div>
                      <div className="text-xs text-gray-500">{c.provider} · {c.duration} · Due: {c.dueDate}</div>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-3 flex-shrink-0">{c.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${c.completionRate>=80?'bg-green-500':c.completionRate>=50?'bg-yellow-400':'bg-red-400'}`}
                        style={{ width:`${c.completionRate}%` }}/>
                    </div>
                    <span className="text-xs font-medium text-gray-600">{c.completionRate}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              {selected ? (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={18} className="text-red-700"/>
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{selected.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{selected.provider}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className="text-xs text-gray-600 leading-relaxed">{selected.description}</p>
                    {[
                      ['Duration',    selected.duration],
                      ['Category',    selected.category],
                      ['Due Date',    selected.dueDate],
                      ['Mandatory',   selected.mandatory ? 'Yes' : 'No'],
                      ['Completion',  selected.completionRate + '%'],
                    ].map(([k,v]) => (
                      <div key={k} className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{k}</span>
                        <span className="text-xs font-medium text-gray-800">{v}</span>
                      </div>
                    ))}
                    <div className="bg-gray-100 rounded-full h-2 mt-1">
                      <div className={`h-2 rounded-full ${selected.completionRate>=80?'bg-green-500':selected.completionRate>=50?'bg-yellow-400':'bg-red-400'}`}
                        style={{ width:`${selected.completionRate}%` }}/>
                    </div>
                    <button className="w-full bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-red-800 transition mt-2">
                      Send Reminder to Pending
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
                  <BookOpen size={36} className="mx-auto text-gray-300 mb-3"/>
                  <p className="text-gray-400 text-sm">Select a course to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'compliance' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Employee</th>
                {COURSES.filter(c=>c.mandatory).map(c=>(
                  <th key={c.id} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 max-w-[80px]">
                    <div className="truncate">{c.title.split(' ').slice(0,2).join(' ')}</div>
                    <div className="text-orange-500 font-normal">{c.dueDate}</div>
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {EMPLOYEES.map(e => {
                const mandatory = COURSES.filter(c=>c.mandatory)
                const done = mandatory.filter(c=>e.completions.includes(c.id)).length
                const pct = Math.round(done/mandatory.length*100)
                return (
                  <tr key={e.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{e.name}</div>
                      <div className="text-xs text-gray-500">{e.role}</div>
                    </td>
                    {mandatory.map(c => (
                      <td key={c.id} className="px-3 py-3 text-center">
                        {e.completions.includes(c.id)
                          ? <CheckCircle size={16} className="text-green-500 mx-auto"/>
                          : <Clock size={16} className="text-orange-400 mx-auto"/>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct===100?'bg-green-100 text-green-700':pct>=50?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-600'}`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Training Course</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Course Title</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <input value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} placeholder="e.g. 4 hrs"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              </div>
              {[['Provider / Vendor','provider'],['Due Date','dueDate']].map(([l,k]) => (
                <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input type={k==='dueDate'?'date':'text'} value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              ))}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.mandatory} onChange={e=>setForm(f=>({...f,mandatory:e.target.checked}))} className="rounded text-red-700"/>
                <span className="text-sm text-gray-700">Mark as Mandatory</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNew(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={submitCourse} disabled={!form.title} className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">Add Course</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
