'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, Circle, Plus, Loader2, ChevronDown, ChevronUp, UserCheck } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

const CATEGORY_ICONS: Record<string, string> = {
  Documents: '📄',
  'IT Setup': '💻',
  Induction: '🎯',
  'Day 1 Kit': '🎁',
}

const CATEGORY_ORDER = ['Documents', 'IT Setup', 'Induction', 'Day 1 Kit']

export default function OnboardingPage() {
  const { toast } = useToast()
  const [records, setRecords]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [updating, setUpdating]   = useState<string | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [addForm, setAddForm]     = useState({ candidate_name: '', job_title: '', joining_date: '' })
  const [adding, setAdding]       = useState(false)

  async function load() {
    const data = await fetch('/api/onboarding').then(r => r.json())
    setRecords(data)
    setLoading(false)
    if (data.length > 0 && !expanded) setExpanded(data[0].id)
  }

  useEffect(() => { load() }, [])

  async function toggleTask(recordId: string, taskId: string, current: boolean) {
    setUpdating(taskId)
    const res = await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recordId, task_id: taskId, completed: !current }),
    })
    const updated = await res.json()
    setRecords(prev => prev.map(r => r.id === recordId ? updated : r))
    setUpdating(null)
    if (!current) toast('Task marked complete!')
  }

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    const record = await res.json()
    setRecords(prev => [...prev, record])
    setExpanded(record.id)
    setAddForm({ candidate_name: '', job_title: '', joining_date: '' })
    setShowAdd(false)
    setAdding(false)
    toast(`Onboarding started for ${addForm.candidate_name}!`)
  }

  function progress(tasks: any[]) {
    const done = tasks.filter((t: any) => t.completed).length
    return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) }
  }

  function byCategory(tasks: any[]) {
    return CATEGORY_ORDER.reduce((acc, cat) => {
      acc[cat] = tasks.filter((t: any) => t.category === cat)
      return acc
    }, {} as Record<string, any[]>)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Onboarding</h1>
          <p className="text-gray-500 text-sm mt-1">{records.length} employee{records.length !== 1 ? 's' : ''} in onboarding</p>
        </div>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white border border-red-100 rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Start Onboarding</h2>
          <form onSubmit={addEmployee} className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Employee Name</label>
              <input value={addForm.candidate_name}
                onChange={e => setAddForm(f => ({ ...f, candidate_name: e.target.value }))}
                required placeholder="Full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <input value={addForm.job_title}
                onChange={e => setAddForm(f => ({ ...f, job_title: e.target.value }))}
                required placeholder="Job title"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Joining Date</label>
              <input type="date" value={addForm.joining_date}
                onChange={e => setAddForm(f => ({ ...f, joining_date: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="col-span-3 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowAdd(false)}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={adding}
                className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center gap-2">
                {adding ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : 'Start Onboarding'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : records.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-16 text-center">
          <UserCheck size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No employees in onboarding yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "Add Employee" to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(record => {
            const { done, total, pct } = progress(record.tasks)
            const cats = byCategory(record.tasks)
            const isOpen = expanded === record.id

            return (
              <div key={record.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpanded(isOpen ? null : record.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {record.candidate_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{record.candidate_name}</span>
                      {pct === 100 && (
                        <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Complete</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {record.job_title} · Joining {record.joining_date ? formatDate(record.joining_date) : '—'}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">{pct}%</div>
                      <div className="text-xs text-gray-400">{done}/{total} tasks</div>
                    </div>
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Task Checklist */}
                {isOpen && (
                  <div className="border-t border-gray-50 p-5">
                    <div className="grid grid-cols-2 gap-6">
                      {CATEGORY_ORDER.map(cat => {
                        const tasks = cats[cat] || []
                        if (!tasks.length) return null
                        const catDone = tasks.filter((t: any) => t.completed).length
                        return (
                          <div key={cat}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-base">{CATEGORY_ICONS[cat]}</span>
                              <span className="text-sm font-semibold text-gray-800">{cat}</span>
                              <span className="text-xs text-gray-400 ml-auto">{catDone}/{tasks.length}</span>
                            </div>
                            <div className="space-y-2">
                              {tasks.map((task: any) => (
                                <button
                                  key={task.id}
                                  onClick={() => toggleTask(record.id, task.id, task.completed)}
                                  disabled={updating === task.id}
                                  className="w-full flex items-center gap-2.5 text-left p-2.5 rounded-lg hover:bg-gray-50 transition group"
                                >
                                  {updating === task.id
                                    ? <Loader2 size={16} className="text-gray-400 animate-spin flex-shrink-0" />
                                    : task.completed
                                      ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                                      : <Circle size={16} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
                                  }
                                  <span className={`text-xs ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                    {task.title}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
