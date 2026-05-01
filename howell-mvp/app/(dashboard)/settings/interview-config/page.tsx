'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Bot, Users, Plus, Trash2, Save, ChevronDown, ChevronUp,
  Settings, Zap, Clock, Target, Shield, HelpCircle, CheckCircle,
  AlertCircle, GripVertical, Video, X, AlertTriangle
} from 'lucide-react'

interface Round {
  id?: string
  round_number: number
  name: string
  type: 'ai' | 'manual' | 'panel'
  duration_minutes: number
  pass_score_threshold: number
  auto_schedule: boolean
  score_trigger: number
  delay_hours: number
  requires_approval: boolean
  tavus_persona_id: string
  ai_questions: string[]
  ai_auto_generate_questions: boolean
  is_active?: boolean
}

interface Config {
  id?: string
  job_id: string
  name: string
  auto_schedule_enabled: boolean
}

const DEFAULT_ROUND: Round = {
  round_number: 1,
  name: '',
  type: 'manual',
  duration_minutes: 30,
  pass_score_threshold: 65,
  auto_schedule: false,
  score_trigger: 70,
  delay_hours: 24,
  requires_approval: true,
  tavus_persona_id: '',
  ai_questions: [],
  ai_auto_generate_questions: true,
}

const DEFAULT_AI_QUESTIONS = [
  'Tell me about yourself and your relevant experience.',
  'Why are you interested in this role?',
  'Describe a challenging project you worked on and how you handled it.',
  'What are your key technical strengths?',
  'Where do you see yourself in the next 2-3 years?',
]

export default function InterviewConfigPage() {
  const [jobs, setJobs]           = useState<any[]>([])
  const [selectedJob, setSelectedJob] = useState('')
  const [config, setConfig]       = useState<Config | null>(null)
  const [rounds, setRounds]       = useState<Round[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [expandedRound, setExpandedRound] = useState<number | null>(0)
  const [autoSchedule, setAutoSchedule] = useState(false)
  const [pipelineName, setPipelineName] = useState('Standard Pipeline')

  // Screening thresholds
  const [shortlistThreshold, setShortlistThreshold] = useState(70)
  const [rejectThreshold,    setRejectThreshold]    = useState(40)

  // Knockout questions
  const [knockouts,       setKnockouts]       = useState<any[]>([])
  const [knockoutLoading, setKnockoutLoading] = useState(false)
  const [newKnockout, setNewKnockout] = useState({
    question: '', question_type: 'yes_no', pass_answer: 'yes',
    reject_message: 'You do not meet the minimum requirements for this role.',
  })

  // Load jobs on mount
  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : (d.jobs || [])
      setJobs(list)
      if (list.length > 0) setSelectedJob(list[0].id)
    })
  }, [])

  // Load config when job changes
  const loadConfig = useCallback(async (jobId: string) => {
    if (!jobId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/interviews/config?jobId=${jobId}`)
      const data = await res.json()
      if (data.config) {
        setConfig(data.config)
        setPipelineName(data.config.name || 'Standard Pipeline')
        setAutoSchedule(data.config.auto_schedule_enabled || false)
        setShortlistThreshold(data.config.auto_shortlist_threshold ?? 70)
        setRejectThreshold(data.config.auto_reject_below ?? 40)
        setRounds((data.rounds || []).map((r: any) => ({
          ...r,
          ai_questions: r.ai_questions || [],
          tavus_persona_id: r.tavus_persona_id || '',
          ai_auto_generate_questions: r.ai_auto_generate_questions !== false,
        })))
      } else {
        setConfig(null)
        setPipelineName('Standard Pipeline')
        setAutoSchedule(false)
        setRounds((data.defaults?.rounds || []).map((r: any, i: number) => ({
          ...r,
          round_number: i + 1,
          ai_questions: r.ai_questions || [],
          tavus_persona_id: r.tavus_persona_id || '',
          ai_auto_generate_questions: true,
        })))
      }
      setExpandedRound(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedJob) loadConfig(selectedJob)
  }, [selectedJob, loadConfig])

  function addRound() {
    const newRound: Round = {
      ...DEFAULT_ROUND,
      round_number: rounds.length + 1,
      name: `Round ${rounds.length + 1}`,
    }
    setRounds(prev => [...prev, newRound])
    setExpandedRound(rounds.length)
  }

  function removeRound(idx: number) {
    setRounds(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, round_number: i + 1 })))
    setExpandedRound(null)
  }

  function updateRound(idx: number, field: keyof Round, value: any) {
    setRounds(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function addQuestion(roundIdx: number) {
    setRounds(prev => prev.map((r, i) =>
      i === roundIdx ? { ...r, ai_questions: [...r.ai_questions, ''] } : r
    ))
  }

  function updateQuestion(roundIdx: number, qIdx: number, value: string) {
    setRounds(prev => prev.map((r, i) =>
      i === roundIdx
        ? { ...r, ai_questions: r.ai_questions.map((q, j) => j === qIdx ? value : q) }
        : r
    ))
  }

  function removeQuestion(roundIdx: number, qIdx: number) {
    setRounds(prev => prev.map((r, i) =>
      i === roundIdx
        ? { ...r, ai_questions: r.ai_questions.filter((_, j) => j !== qIdx) }
        : r
    ))
  }

  function loadDefaultQuestions(roundIdx: number) {
    setRounds(prev => prev.map((r, i) =>
      i === roundIdx ? { ...r, ai_questions: [...DEFAULT_AI_QUESTIONS] } : r
    ))
  }

  async function handleSave() {
    if (!selectedJob) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/interviews/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob,
          name: pipelineName,
          auto_schedule_enabled: autoSchedule,
          auto_shortlist_threshold: shortlistThreshold,
          auto_reject_below: rejectThreshold,
          rounds,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        await loadConfig(selectedJob)
      }
    } finally {
      setSaving(false)
    }
  }

  // Load knockout questions when job changes
  const loadKnockouts = useCallback(async (jobId: string) => {
    if (!jobId) return
    setKnockoutLoading(true)
    const res  = await fetch(`/api/screening/knockout-config?jobId=${jobId}`)
    const data = await res.json()
    setKnockouts(data.questions || [])
    setKnockoutLoading(false)
  }, [])

  useEffect(() => {
    if (selectedJob) loadKnockouts(selectedJob)
  }, [selectedJob, loadKnockouts])

  async function addKnockout() {
    if (!newKnockout.question.trim() || !selectedJob) return
    const res  = await fetch('/api/screening/knockout-config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...newKnockout, job_id: selectedJob, sort_order: knockouts.length }),
    })
    const data = await res.json()
    if (data.question) {
      setKnockouts(prev => [...prev, data.question])
      setNewKnockout({ question: '', question_type: 'yes_no', pass_answer: 'yes', reject_message: 'You do not meet the minimum requirements for this role.' })
    }
  }

  async function deleteKnockout(id: string) {
    await fetch(`/api/screening/knockout-config?id=${id}`, { method: 'DELETE' })
    setKnockouts(prev => prev.filter(q => q.id !== id))
  }

  const selectedJobObj = jobs.find(j => j.id === selectedJob)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-red-50 rounded-lg">
            <Settings size={20} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Interview Pipeline Config</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">
          Configure rounds, AI scheduling rules, and Tavus video settings per job role.
        </p>
      </div>

      {/* Job Selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Job Role</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
          value={selectedJob}
          onChange={e => setSelectedJob(e.target.value)}
        >
          <option value="">-- Select a job --</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title} {j.department ? `· ${j.department}` : ''}</option>
          ))}
        </select>
        {selectedJobObj && (
          <p className="text-xs text-gray-400 mt-1">{selectedJobObj.location || ''} {selectedJobObj.employment_type || ''}</p>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading pipeline config…</div>
      )}

      {!loading && selectedJob && (
        <>
          {/* Pipeline Settings */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Zap size={15} className="text-amber-500" /> Pipeline Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pipeline Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                  value={pipelineName}
                  onChange={e => setPipelineName(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setAutoSchedule(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${autoSchedule ? 'bg-red-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSchedule ? 'translate-x-5' : ''}`} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Auto-Schedule Enabled</div>
                    <div className="text-xs text-gray-400">Automatically queue interviews based on score thresholds</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Rounds */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Target size={15} className="text-red-500" /> Interview Rounds ({rounds.length})
            </h2>
            <button
              onClick={addRound}
              className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
            >
              <Plus size={13} /> Add Round
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {rounds.map((round, idx) => (
              <RoundCard
                key={idx}
                round={round}
                idx={idx}
                expanded={expandedRound === idx}
                onToggle={() => setExpandedRound(expandedRound === idx ? null : idx)}
                onUpdate={(field, val) => updateRound(idx, field, val)}
                onRemove={() => removeRound(idx)}
                onAddQuestion={() => addQuestion(idx)}
                onUpdateQuestion={(qIdx, val) => updateQuestion(idx, qIdx, val)}
                onRemoveQuestion={(qIdx) => removeQuestion(idx, qIdx)}
                onLoadDefaultQuestions={() => loadDefaultQuestions(idx)}
              />
            ))}

            {rounds.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                No rounds configured yet. Click "Add Round" to get started.
              </div>
            )}
          </div>

          {/* ── Screening Thresholds ────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Target size={16} className="text-red-600"/>
              <h2 className="font-semibold text-gray-900 text-sm">AI Screening Thresholds</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-green-600"/>
                  <span className="text-xs font-bold text-green-700">Auto-Shortlist Above</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={50} max={95} step={5} value={shortlistThreshold}
                    onChange={e => setShortlistThreshold(Number(e.target.value))}
                    className="flex-1 accent-green-600"/>
                  <span className="text-lg font-black text-green-700 w-12 text-right">{shortlistThreshold}%</span>
                </div>
                <p className="text-xs text-green-600 mt-1">Candidates scoring ≥ {shortlistThreshold}% are automatically shortlisted</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={14} className="text-red-600"/>
                  <span className="text-xs font-bold text-red-700">Auto-Reject Below</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={10} max={60} step={5} value={rejectThreshold}
                    onChange={e => setRejectThreshold(Number(e.target.value))}
                    className="flex-1 accent-red-600"/>
                  <span className="text-lg font-black text-red-700 w-12 text-right">{rejectThreshold}%</span>
                </div>
                <p className="text-xs text-red-600 mt-1">Candidates scoring &lt; {rejectThreshold}% are automatically rejected</p>
              </div>
            </div>
            <div className="mt-3 bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-500">
              Scores between <strong>{rejectThreshold}%</strong> and <strong>{shortlistThreshold}%</strong> go to <strong>Manual Review</strong> queue for HR decision
            </div>
          </div>

          {/* ── Knockout Questions ───────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500"/>
                <h2 className="font-semibold text-gray-900 text-sm">Knockout Questions</h2>
              </div>
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-medium">
                Candidates who fail any of these are auto-rejected immediately
              </span>
            </div>

            {knockoutLoading ? (
              <div className="text-center py-6 text-gray-400 text-xs">Loading…</div>
            ) : (
              <>
                {knockouts.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm mb-4">
                    No knockout questions set. Add one below.
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  {knockouts.map((kq: any) => (
                    <div key={kq.id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800">{kq.question}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Type: <strong>{kq.question_type}</strong> · Required answer: <strong>{kq.pass_answer}</strong>
                        </div>
                        <div className="text-xs text-red-600 mt-0.5 italic">Reject message: "{kq.reject_message}"</div>
                      </div>
                      <button onClick={() => deleteKnockout(kq.id)}
                        className="text-gray-400 hover:text-red-500 transition flex-shrink-0">
                        <X size={14}/>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new knockout question form */}
                <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase">Add Knockout Question</div>
                  <input
                    value={newKnockout.question}
                    onChange={e => setNewKnockout(n => ({...n, question: e.target.value}))}
                    placeholder="e.g. Do you have a valid UAE driving licence? / Minimum years of experience required?"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"/>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Question Type</label>
                      <select value={newKnockout.question_type}
                        onChange={e => setNewKnockout(n => ({...n, question_type: e.target.value, pass_answer: e.target.value === 'yes_no' ? 'yes' : ''}))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="yes_no">Yes / No</option>
                        <option value="min_value">Minimum Value (experience, salary)</option>
                        <option value="multiple_choice">Multiple Choice</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        {newKnockout.question_type === 'yes_no' ? 'Required Answer' : newKnockout.question_type === 'min_value' ? 'Minimum Value' : 'Accepted Answer'}
                      </label>
                      <input
                        value={newKnockout.pass_answer}
                        onChange={e => setNewKnockout(n => ({...n, pass_answer: e.target.value}))}
                        placeholder={newKnockout.question_type === 'yes_no' ? 'yes or no' : newKnockout.question_type === 'min_value' ? 'e.g. 5' : 'accepted answer'}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"/>
                    </div>
                  </div>
                  <input
                    value={newKnockout.reject_message}
                    onChange={e => setNewKnockout(n => ({...n, reject_message: e.target.value}))}
                    placeholder="Rejection message shown to candidate…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"/>
                  <button onClick={addKnockout}
                    disabled={!newKnockout.question.trim()}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50">
                    <Plus size={13}/> Add Knockout Question
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
            <div className="text-xs text-gray-500">
              {config ? 'Updating existing pipeline configuration' : 'Creating new pipeline configuration'}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !selectedJob}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition ${
                saved
                  ? 'bg-green-600 text-white'
                  : saving
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {saved ? <CheckCircle size={15} /> : saving ? null : <Save size={15} />}
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Pipeline'}
            </button>
          </div>
        </>
      )}

      {!loading && !selectedJob && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Select a job role above to configure its interview pipeline.
        </div>
      )}
    </div>
  )
}

/* ── Round Card ─────────────────────────────────────────────────────────────── */
function RoundCard({
  round, idx, expanded, onToggle, onUpdate, onRemove,
  onAddQuestion, onUpdateQuestion, onRemoveQuestion, onLoadDefaultQuestions
}: {
  round: Round
  idx: number
  expanded: boolean
  onToggle: () => void
  onUpdate: (field: keyof Round, value: any) => void
  onRemove: () => void
  onAddQuestion: () => void
  onUpdateQuestion: (qIdx: number, val: string) => void
  onRemoveQuestion: (qIdx: number) => void
  onLoadDefaultQuestions: () => void
  // ai_auto_generate_questions handled via onUpdate
}) {
  const isAI = round.type === 'ai'

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${isAI ? 'border-violet-200' : 'border-gray-200'}`}>
      {/* Round Header */}
      <div
        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition ${isAI ? 'bg-violet-50 hover:bg-violet-100' : 'bg-gray-50 hover:bg-gray-100'}`}
        onClick={onToggle}
      >
        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isAI ? 'bg-violet-600 text-white' : 'bg-gray-600 text-white'}`}>
          {idx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 truncate">
              {round.name || `Round ${idx + 1}`}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
              isAI ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isAI ? '🤖 AI' : round.type === 'panel' ? '👥 Panel' : '👤 Manual'}
            </span>
            {round.auto_schedule && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex-shrink-0">
                ⚡ Auto
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {round.duration_minutes} min · Pass: {round.pass_score_threshold}+ · Trigger: {round.score_trigger}+
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="p-1 text-gray-400 hover:text-red-500 transition rounded"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Round Body */}
      {expanded && (
        <div className="px-5 py-5 border-t border-gray-100 space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Round Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                placeholder="e.g. AI Screening Round"
                value={round.name}
                onChange={e => onUpdate('name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Round Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                value={round.type}
                onChange={e => onUpdate('type', e.target.value)}
              >
                <option value="ai">🤖 AI (Tavus)</option>
                <option value="manual">👤 Manual</option>
                <option value="panel">👥 Panel</option>
              </select>
            </div>
          </div>

          {/* Scoring */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Clock size={11} /> Duration (min)
              </label>
              <input
                type="number" min="5" max="180"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                value={round.duration_minutes}
                onChange={e => onUpdate('duration_minutes', parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Target size={11} /> Pass Score
                <span className="text-gray-400 text-[10px]">(0-100)</span>
              </label>
              <input
                type="number" min="0" max="100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                value={round.pass_score_threshold}
                onChange={e => onUpdate('pass_score_threshold', parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Zap size={11} className="text-amber-500" /> Score Trigger
                <span className="text-gray-400 text-[10px]">(auto)</span>
              </label>
              <input
                type="number" min="0" max="100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                value={round.score_trigger}
                onChange={e => onUpdate('score_trigger', parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Clock size={11} /> Delay (hours)
              </label>
              <input
                type="number" min="0" max="168"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                value={round.delay_hours}
                onChange={e => onUpdate('delay_hours', parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-6 py-2">
            <ToggleField
              label="Auto-Schedule"
              desc="Automatically queue when score threshold met"
              value={round.auto_schedule}
              onChange={v => onUpdate('auto_schedule', v)}
              color="amber"
            />
            <ToggleField
              label="Requires HR Approval"
              desc="HR must approve before candidate is notified"
              value={round.requires_approval}
              onChange={v => onUpdate('requires_approval', v)}
              color="blue"
            />
          </div>

          {/* AI-specific settings */}
          {isAI && (
            <div className="border border-violet-100 bg-violet-50 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
                <Video size={12} /> Tavus AI Settings
              </h3>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tavus Persona / Replica ID
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 font-mono"
                  placeholder="e.g. p5317866ba7 or r3a4c5e6..."
                  value={round.tavus_persona_id}
                  onChange={e => onUpdate('tavus_persona_id', e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Find this in your <a href="https://platform.tavus.io" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Tavus dashboard</a> under Personas or Replicas.
                </p>
              </div>

              {/* AI Auto-Generate Questions Toggle */}
              <div className={`rounded-xl border p-4 transition-colors ${round.ai_auto_generate_questions ? 'bg-violet-100 border-violet-300' : 'bg-white border-gray-200'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div
                    onClick={() => onUpdate('ai_auto_generate_questions', !round.ai_auto_generate_questions)}
                    className={`relative mt-0.5 w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${round.ai_auto_generate_questions ? 'bg-violet-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${round.ai_auto_generate_questions ? 'translate-x-5' : ''}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      🤖 AI Auto-Generate Questions
                      {round.ai_auto_generate_questions && (
                        <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-bold">ON</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {round.ai_auto_generate_questions
                        ? 'Questions are generated dynamically per candidate — tailored to their resume, skills, experience level, and identified gaps.'
                        : 'Use the fixed questions below for all candidates in this round.'}
                    </div>
                  </div>
                </label>

                {round.ai_auto_generate_questions && (
                  <div className="mt-3 pl-14">
                    <div className="bg-white border border-violet-200 rounded-lg px-3 py-2.5 space-y-1.5">
                      <p className="text-xs font-medium text-violet-700">What AI considers per candidate:</p>
                      {[
                        '📄 Resume skills & experience years',
                        '🎯 Job description & requirements',
                        '🔍 AI-identified skill gaps from screening',
                        '📊 Seniority level (junior / mid / senior)',
                        '🏢 Current company & role context',
                      ].map((item, i) => (
                        <p key={i} className="text-xs text-gray-600">{item}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fallback / Manual Questions (shown when auto-generate is OFF, or as backup) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <HelpCircle size={12} className="text-violet-500" />
                    {round.ai_auto_generate_questions ? 'Fallback Questions (if AI unavailable)' : 'Interview Questions'}
                    <span className="text-gray-400">({round.ai_questions.length})</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={onLoadDefaultQuestions}
                      className="text-xs text-violet-600 hover:text-violet-800 underline"
                    >
                      Load defaults
                    </button>
                    <button
                      onClick={onAddQuestion}
                      className="flex items-center gap-1 text-xs bg-violet-600 text-white px-2 py-1 rounded hover:bg-violet-700"
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {round.ai_questions.map((q, qIdx) => (
                    <div key={qIdx} className="flex items-start gap-2">
                      <span className="text-xs text-violet-400 font-mono mt-2 flex-shrink-0 w-5 text-right">{qIdx + 1}.</span>
                      <input
                        type="text"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-500"
                        placeholder="Enter interview question…"
                        value={q}
                        onChange={e => onUpdateQuestion(qIdx, e.target.value)}
                      />
                      <button
                        onClick={() => onRemoveQuestion(qIdx)}
                        className="mt-1 p-1 text-gray-400 hover:text-red-500 transition rounded flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {round.ai_questions.length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2 pl-7">
                      {round.ai_auto_generate_questions
                        ? 'No fallback questions — AI generation will be used.'
                        : 'No questions yet. Add questions or load defaults above.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info box for scoring logic */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
            <AlertCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              <strong>Score Trigger ({round.score_trigger}+):</strong> Candidates whose AI match score meets this threshold will be auto-queued for this round (if auto-schedule is on).
              {' '}<strong>Pass Score ({round.pass_score_threshold}+):</strong> Score needed in this round to progress to the next.
              {round.delay_hours > 0 && ` Interview is sent ${round.delay_hours}h after trigger.`}
              {round.requires_approval && ' HR approval required before candidate is notified.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleField({ label, desc, value, onChange, color }: {
  label: string; desc: string; value: boolean;
  onChange: (v: boolean) => void; color: string
}) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-500',
    blue:  'bg-blue-500',
    green: 'bg-green-500',
    red:   'bg-red-600',
  }
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!value)}
        className={`relative mt-0.5 w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${value ? colors[color] || 'bg-red-600' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </div>
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="text-xs text-gray-400">{desc}</div>
      </div>
    </label>
  )
}
