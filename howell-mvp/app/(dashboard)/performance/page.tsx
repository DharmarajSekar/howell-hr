'use client'
import { useState } from 'react'
import { Star, Plus, Zap, TrendingUp, Target, BookOpen, ChevronRight } from 'lucide-react'

const EMPLOYEES = [
  { id:'1', name:'Amit Singh',    role:'HR Business Partner',  rating: 4.5, goals: 8, completed: 7, skills: ['HRBP','Workday','Analytics'],    gaps: ['Data Science','Compensation Benchmarking'], risk: 'low' },
  { id:'2', name:'Neha Gupta',    role:'Senior Site Engineer', rating: 4.2, goals: 6, completed: 5, skills: ['ELV','BMS','PMP'],                gaps: ['Leadership','Budget Management'],          risk: 'low' },
  { id:'3', name:'Karan Malhotra',role:'Site Engineer',        rating: 3.1, goals: 5, completed: 2, skills: ['CCTV','AutoCAD'],                  gaps: ['BMS','Access Control','Communication'],    risk: 'high' },
  { id:'4', name:'Arjun Mehta',   role:'Project Manager',      rating: 3.8, goals: 7, completed: 5, skills: ['MS Project','Client Management'], gaps: ['ELV Certification','Agile'],               risk: 'medium' },
  { id:'5', name:'Sneha Krishnan',role:'Data Analyst',         rating: 4.0, goals: 5, completed: 4, skills: ['SQL','Power BI','Python'],          gaps: ['Machine Learning','Airflow'],              risk: 'low' },
]

const TRAINING_RECS: Record<string,string[]> = {
  'Data Science':              ['Coursera: Data Science Specialization','Udemy: Python for Data Science'],
  'Compensation Benchmarking': ['SHRM: Compensation & Benefits','LinkedIn Learning: Total Rewards'],
  'Leadership':                ['LinkedIn Learning: Leadership Foundations','Dale Carnegie Leadership'],
  'Budget Management':         ['PMBOK: Cost Management','Coursera: Financial Acumen'],
  'BMS':                       ['Honeywell BMS Certification','Siemens Desigo CC Training'],
  'Access Control':            ['Lenel OnGuard Certification','Bosch Access Control Training'],
  'Communication':             ['Dale Carnegie: Communication Skills','Toastmasters Program'],
  'ELV Certification':         ['BICSI Technician Certification','ASIS Physical Security'],
  'Agile':                     ['Scrum Master Certification (CSM)','PMI-ACP Certification'],
  'Machine Learning':          ['Coursera: ML Specialization','Fast.ai Deep Learning'],
  'Airflow':                   ['Astronomer: Airflow Certification','DataTalks.club DE Course'],
}

export default function PerformancePage() {
  const [selected, setSelected] = useState<any>(null)
  const [showReview, setShowReview] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: '4', comments: '', goals: '' })

  const avgRating = (EMPLOYEES.reduce((s,e)=>s+e.rating,0)/EMPLOYEES.length).toFixed(1)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Appraisals, skill gaps, and AI-powered training recommendations</p>
        </div>
        <button onClick={() => setShowReview(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Start Review Cycle
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Team Members',   value: EMPLOYEES.length },
          { label: 'Avg Rating',     value: avgRating + '/5' },
          { label: 'High Performers',value: EMPLOYEES.filter(e=>e.rating>=4).length },
          { label: 'At Risk',        value: EMPLOYEES.filter(e=>e.risk==='high').length },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 space-y-2">
          {EMPLOYEES.map(e => (
            <div key={e.id} onClick={() => setSelected(e)}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id===e.id?'border-red-500 shadow-md':'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">{e.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">{e.name}</div>
                  <div className="text-xs text-gray-500">{e.role}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Star size={13} className="text-yellow-400 fill-yellow-400"/>
                  <span className="text-sm font-bold text-gray-700">{e.rating}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(e.completed/e.goals)*100}%` }}/>
                </div>
                <span className="text-xs text-gray-500">{e.completed}/{e.goals} goals</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.risk==='high'?'bg-red-100 text-red-700':e.risk==='medium'?'bg-yellow-100 text-yellow-700':'bg-green-100 text-green-700'}`}>{e.risk} risk</span>
              </div>
            </div>
          ))}
        </div>

        <div className="col-span-3">
          {selected ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-xl flex-shrink-0">{selected.name.charAt(0)}</div>
                  <div className="flex-1">
                    <h2 className="font-bold text-gray-900">{selected.name}</h2>
                    <p className="text-sm text-gray-500">{selected.role}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {[1,2,3,4,5].map(s => <Star key={s} size={16} className={s<=Math.floor(selected.rating)?'text-yellow-400 fill-yellow-400':'text-gray-200 fill-gray-200'}/>)}
                      <span className="text-sm font-bold text-gray-700 ml-1">{selected.rating}/5</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {/* Goals */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Goal Progress</h3>
                  <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-4">
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-gray-900">{selected.completed}</div>
                      <div className="text-xs text-gray-500">Completed</div>
                    </div>
                    <div className="w-px h-10 bg-gray-200"/>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-gray-500">{selected.goals - selected.completed}</div>
                      <div className="text-xs text-gray-500">Pending</div>
                    </div>
                    <div className="w-px h-10 bg-gray-200"/>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-blue-600">{Math.round(selected.completed/selected.goals*100)}%</div>
                      <div className="text-xs text-gray-500">Completion</div>
                    </div>
                  </div>
                </div>
                {/* Skills */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Current Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.skills.map((s:string) => <span key={s} className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded-lg">{s}</span>)}
                  </div>
                </div>
                {/* Skill Gaps + AI Recommendations */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase">AI Skill Gap Analysis</h3>
                    <Zap size={12} className="text-purple-500"/>
                  </div>
                  <div className="space-y-2">
                    {selected.gaps.map((g:string) => (
                      <div key={g} className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-medium text-gray-800">{g}</span>
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded">Gap</span>
                        </div>
                        <div className="space-y-1">
                          {(TRAINING_RECS[g]||['Relevant online certification course']).map((r:string,i:number) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-purple-700">
                              <BookOpen size={11}/>
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <Star size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select an employee to view performance details and AI recommendations</p>
            </div>
          )}
        </div>
      </div>

      {showReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Start Review Cycle — Q2 2026</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Overall Rating (1-5)</label>
                <input type="number" min="1" max="5" step="0.1" value={reviewForm.rating} onChange={e=>setReviewForm(f=>({...f,rating:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Performance Comments</label>
                <textarea value={reviewForm.comments} onChange={e=>setReviewForm(f=>({...f,comments:e.target.value}))} rows={3} placeholder="Key achievements and areas for improvement…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Goals for Next Quarter</label>
                <textarea value={reviewForm.goals} onChange={e=>setReviewForm(f=>({...f,goals:e.target.value}))} rows={2} placeholder="Set 3-5 measurable goals…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowReview(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={()=>setShowReview(false)} className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold">Submit Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
