'use client'
import { useState } from 'react'
import { Bot, Plus, Play, CheckCircle, Clock, Star, ChevronDown, ChevronUp, Zap, User, MessageSquare, Send } from 'lucide-react'

const REC_COLORS: Record<string, string> = {
  'Strong Hire':       'bg-green-100 text-green-700 border-green-200',
  'Consider':          'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Not Recommended':   'bg-red-100 text-red-700 border-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

// Role-based question bank
function getQuestions(jobTitle: string): string[] {
  const title = jobTitle.toLowerCase()
  if (title.includes('engineer') || title.includes('developer') || title.includes('software')) {
    return [
      'Can you briefly walk me through your technical background and the technologies you\'re most comfortable with?',
      'Describe a challenging technical problem you solved recently. What was your approach?',
      'How do you ensure code quality in your projects? Do you follow any specific practices?',
      'Tell me about your experience working in agile/scrum teams.',
      'What is your expected compensation range for this role?',
    ]
  }
  if (title.includes('manager') || title.includes('lead')) {
    return [
      'Tell me about your leadership experience and team size you have managed.',
      'How do you handle underperforming team members?',
      'Describe a situation where you had to manage conflicting priorities.',
      'What is your management style and how do you motivate your team?',
      'What are your salary expectations for this role?',
    ]
  }
  return [
    'Tell me a little about yourself and your professional background.',
    'Why are you interested in this particular role?',
    'What are your key strengths that make you a good fit?',
    'Describe a challenging situation at work and how you handled it.',
    'What are your salary expectations?',
  ]
}

// Mock AI scoring
function scoreAnswer(question: string, answer: string): { score: number; feedback: string } {
  if (!answer || answer.trim().length < 20) {
    return { score: 30, feedback: 'Response too brief. Please provide more detail.' }
  }
  const words = answer.trim().split(/\s+/).length
  const score = Math.min(95, 55 + Math.floor(words / 3) + Math.floor(Math.random() * 10))
  const feedbacks = [
    'Good structured response with relevant examples.',
    'Clear and concise answer demonstrating solid understanding.',
    'Strong answer with concrete examples and outcomes.',
    'Adequate response, could benefit from more specific metrics.',
    'Well-articulated response showing relevant experience.',
  ]
  return { score, feedback: feedbacks[Math.floor(Math.random() * feedbacks.length)] }
}

interface Props {
  sessions: any[]
  applications: any[]
}

export default function PreScreenClient({ sessions: initial, applications }: Props) {
  const [sessions, setSessions]       = useState<any[]>(initial)
  const [selected, setSelected]       = useState<any>(null)
  const [showNew, setShowNew]         = useState(false)
  const [formApp, setFormApp]         = useState('')
  const [creating, setCreating]       = useState(false)
  const [activeBot, setActiveBot]     = useState<any>(null)   // live bot session
  const [botStep, setBotStep]         = useState(0)
  const [botAnswers, setBotAnswers]   = useState<string[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [expandedId, setExpandedId]   = useState<string|null>(null)

  const questions = activeBot ? getQuestions(activeBot.job_title) : []

  async function createSession() {
    const app = applications.find((a: any) => a.id === formApp)
    if (!app) return
    setCreating(true)
    try {
      const res = await fetch('/api/pre-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: app.id,
          candidate_name: app.candidate?.full_name || 'Candidate',
          job_title: app.job?.title || 'Unknown Role',
        }),
      })
      const session = await res.json()
      setSessions(prev => [{ ...session, responses: [] }, ...prev])
      setShowNew(false)
      setFormApp('')
      // Auto start bot
      setActiveBot({ ...session, responses: [] })
      setBotStep(0)
      setBotAnswers([])
    } finally {
      setCreating(false)
    }
  }

  async function submitAnswer() {
    if (!currentAnswer.trim() || !activeBot) return
    setSubmitting(true)
    const newAnswers = [...botAnswers, currentAnswer]
    setBotAnswers(newAnswers)
    setCurrentAnswer('')

    if (botStep < questions.length - 1) {
      setBotStep(s => s + 1)
      setSubmitting(false)
    } else {
      // Last question — score and complete
      const scored = questions.map((q, i) => {
        const ans = newAnswers[i] || ''
        const { score, feedback } = scoreAnswer(q, ans)
        return { question: q, answer: ans, score, ai_feedback: feedback }
      })
      const res = await fetch(`/api/pre-screen/${activeBot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: scored, status: 'completed' }),
      })
      const completed = await res.json()
      setSessions(prev => prev.map((s: any) => s.id === completed.id ? completed : s))
      setSelected(completed)
      setActiveBot(null)
      setBotStep(0)
      setBotAnswers([])
      setSubmitting(false)
    }
  }

  const avgScore = (session: any) => {
    const r = session.responses || []
    if (!r.length) return 0
    return Math.round(r.reduce((s: number, x: any) => s + (x.score || 0), 0) / r.length)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Pre-Screen Bot</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automated interview screening with AI scoring</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Start Interview
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Sessions',  value: sessions.length },
          { label: 'Completed',       value: sessions.filter((s:any)=>s.status==='completed').length },
          { label: 'Strong Hires',    value: sessions.filter((s:any)=>s.ai_recommendation==='Strong Hire').length },
          { label: 'Avg Score',       value: sessions.length ? Math.round(sessions.filter((s:any)=>s.overall_score).reduce((a:number,s:any)=>a+s.overall_score,0) / (sessions.filter((s:any)=>s.overall_score).length||1)) + '%' : '—' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Session list */}
        <div className="col-span-2 space-y-2">
          <h2 className="font-semibold text-gray-900 text-sm mb-2">Sessions ({sessions.length})</h2>
          {sessions.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <Bot size={32} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-sm text-gray-400">No sessions yet. Start an AI pre-screen interview.</p>
            </div>
          ) : (
            sessions.map((s: any) => (
              <div key={s.id}
                onClick={() => setSelected(selected?.id === s.id ? null : s)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id === s.id ? 'border-red-500 shadow-md' : 'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="font-medium text-sm text-gray-900">{s.candidate_name}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">{s.job_title}</div>
                {s.status === 'completed' && (
                  <div className="flex items-center gap-2">
                    <div className={`text-xs px-2 py-0.5 rounded-full border font-medium ${REC_COLORS[s.ai_recommendation] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {s.ai_recommendation}
                    </div>
                    <div className="text-xs text-gray-500 ml-auto">{s.overall_score}% score</div>
                  </div>
                )}
                {s.status === 'pending' && (
                  <button
                    onClick={e => { e.stopPropagation(); setActiveBot(s); setBotStep(0); setBotAnswers([]); }}
                    className="flex items-center gap-1.5 text-xs text-red-700 hover:text-red-800 font-medium mt-1">
                    <Play size={12}/> Start Bot Interview
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Detail / Bot */}
        <div className="col-span-3">
          {activeBot ? (
            /* Live Bot Interview */
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col h-[580px]">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-red-700 to-red-800 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                    <Bot size={18} className="text-white"/>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">Howell AI Screener</div>
                    <div className="text-red-200 text-xs">Pre-screening {activeBot.candidate_name} for {activeBot.job_title}</div>
                  </div>
                  <div className="ml-auto text-white text-xs opacity-70">{botStep + 1} / {questions.length}</div>
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {botStep === 0 && botAnswers.length === 0 && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot size={16} className="text-red-700"/>
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm">
                      <p className="text-sm text-gray-700">Hi {activeBot.candidate_name}! I'm the Howell AI Screener. I'll ask you {questions.length} questions. Ready? Let's begin!</p>
                    </div>
                  </div>
                )}

                {questions.slice(0, botStep + 1).map((q, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot size={16} className="text-red-700"/>
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm">
                        <p className="text-sm text-gray-700"><span className="font-medium text-gray-500 text-xs block mb-1">Q{i+1}</span>{q}</p>
                      </div>
                    </div>
                    {botAnswers[i] && (
                      <div className="flex gap-3 justify-end">
                        <div className="bg-red-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-sm">
                          <p className="text-sm">{botAnswers[i]}</p>
                        </div>
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-gray-600"/>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input */}
              {botAnswers.length < questions.length && (
                <div className="p-4 border-t border-gray-100">
                  <div className="flex gap-2">
                    <textarea
                      value={currentAnswer}
                      onChange={e => setCurrentAnswer(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer() } }}
                      placeholder="Type your answer here…"
                      rows={2}
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button onClick={submitAnswer} disabled={!currentAnswer.trim() || submitting}
                      className="bg-red-700 hover:bg-red-800 text-white rounded-xl px-4 flex items-center justify-center transition disabled:opacity-50">
                      <Send size={16}/>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Press Enter to submit</p>
                </div>
              )}
            </div>
          ) : selected ? (
            /* Session Detail */
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900">{selected.candidate_name}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{selected.job_title}</p>
                  </div>
                  {selected.ai_recommendation && (
                    <div className={`text-sm px-3 py-1 rounded-full border font-semibold ${REC_COLORS[selected.ai_recommendation] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {selected.ai_recommendation}
                    </div>
                  )}
                </div>
                {selected.overall_score != null && (
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-red-600 h-2 rounded-full" style={{ width: `${selected.overall_score}%` }}/>
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-12 text-right">{selected.overall_score}%</span>
                  </div>
                )}
              </div>
              <div className="p-5 space-y-3 max-h-[460px] overflow-y-auto">
                {(selected.responses || []).map((r: any, i: number) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800 flex-1 pr-4">Q{i+1}: {r.question}</p>
                      {r.score != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${r.score >= 70 ? 'bg-green-100 text-green-700' : r.score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                          {r.score}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 bg-gray-50 rounded-lg p-2.5">{r.answer || '—'}</p>
                    {r.ai_feedback && (
                      <div className="flex items-start gap-1.5">
                        <Zap size={12} className="text-purple-500 flex-shrink-0 mt-0.5"/>
                        <p className="text-xs text-purple-700">{r.ai_feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <MessageSquare size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select a session to view results, or start a new bot interview</p>
            </div>
          )}
        </div>
      </div>

      {/* New Session Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Start Pre-Screen Interview</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Candidate / Application</label>
                <select value={formApp} onChange={e => setFormApp(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Select application…</option>
                  {applications.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.candidate?.full_name} — {a.job?.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                <Bot size={14} className="inline mr-1 mb-0.5"/>
                AI bot will ask role-specific questions and automatically score each response.
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowNew(false); setFormApp('') }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={createSession} disabled={!formApp || creating}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                {creating ? 'Creating…' : 'Start Interview'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
