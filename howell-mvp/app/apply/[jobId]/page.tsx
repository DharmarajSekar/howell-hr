'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Sparkles, CheckCircle, Upload, Bot, Send, X, MessageCircle, FileText, AlertCircle } from 'lucide-react'
import type { Job } from '@/types'

/* ── Candidate Chatbot Widget ──────────────────────────────────────────────── */
function CandidateChatbot({ jobTitle, candidateName }: { jobTitle: string; candidateName: string }) {
  const [open,     setOpen]    = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! 👋 I'm the Howell HR assistant. I can answer your questions about this ${jobTitle} role, the application process, and what to expect next. What would you like to know?` }
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef             = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const res = await fetch('/api/chatbot/candidate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:       userMsg,
          candidateName: candidateName || 'there',
          stage:         'Applied',
          history:       messages.slice(-6),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please email careers@howellgroup.com.' }])
    } finally {
      setLoading(false)
    }
  }

  const QUICK = ['What documents do I need?', 'How long does the process take?', 'Is this a remote role?']

  return (
    <>
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-red-700 hover:bg-red-800 text-white rounded-full shadow-lg flex items-center justify-center transition">
        {open ? <X size={20}/> : <MessageCircle size={22}/>}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col" style={{ height: '420px' }}>
          <div className="flex items-center gap-2 px-4 py-3 bg-red-700 rounded-t-2xl">
            <Bot size={16} className="text-white"/>
            <span className="text-white font-semibold text-sm">Howell HR Assistant</span>
            <span className="ml-auto text-xs text-red-200">● Online</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-red-700 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 size={12} className="animate-spin text-gray-400"/>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              {QUICK.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); setTimeout(send, 50) }}
                  className="text-[10px] border border-gray-200 rounded-full px-2 py-1 text-gray-500 hover:border-red-300 hover:text-red-600 transition">
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="px-3 pb-3 flex gap-2 border-t border-gray-100 pt-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask a question…"
              className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"/>
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-7 h-7 bg-red-700 text-white rounded-full flex items-center justify-center disabled:opacity-40">
              <Send size={11}/>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ── PDF.js text extraction (client-side, no server needed) ─────────────────── */
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

async function extractPdfText(file: File): Promise<string> {
  // Dynamically load PDF.js from CDN if not already loaded
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = PDFJS_CDN
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load PDF.js'))
      document.head.appendChild(script)
    })
  }

  const pdfjsLib = (window as any).pdfjsLib
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Join text items with spaces, preserve line breaks between blocks
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
    pageTexts.push(pageText)
  }

  return pageTexts.join('\n')
}

async function extractFileText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf' || file.type === 'application/pdf') {
    return extractPdfText(file)
  }

  // Plain text / fallback: read as UTF-8 text
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file, 'utf-8')
  })
}

/* ── Resume Upload / Drop Zone ─────────────────────────────────────────────── */
function ResumeDropZone({ onParsed, parsing, setParsing }: {
  onParsed: (data: any) => void
  parsing:  boolean
  setParsing: (v: boolean) => void
}) {
  const inputRef                = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)
  const [status,   setStatus]   = useState('')   // progress label

  async function processFile(file: File) {
    setError(null)
    setSuccess(false)
    setStatus('')

    if (!file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
      setError('Please upload a PDF, Word (.doc/.docx), or .txt file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large (max 10 MB).')
      return
    }

    setFileName(file.name)
    setParsing(true)

    try {
      // Step 1: extract text client-side (PDF.js for PDFs → clean text always)
      setStatus('Reading resume…')
      const resumeText = await extractFileText(file)

      if (!resumeText || resumeText.trim().length < 20) {
        throw new Error('Could not extract text from this file. Try a text-based PDF or a .txt file.')
      }

      // Step 2: send clean text to API for structured parsing
      setStatus('Parsing with AI…')
      const res  = await fetch('/api/ai/parse-resume', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resumeText }),
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      onParsed(data)
      setSuccess(true)
      setStatus('')
    } catch (err: any) {
      setError(err.message || 'Could not parse the resume. Please fill in your details manually.')
      setStatus('')
    } finally {
      setParsing(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="mb-6">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !parsing && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${dragging           ? 'border-red-500 bg-red-50'    : ''}
          ${success            ? 'border-green-400 bg-green-50' : ''}
          ${!dragging && !success ? 'border-gray-300 hover:border-red-400 hover:bg-red-50/30 bg-gray-50' : ''}
          ${parsing ? 'cursor-not-allowed opacity-70' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={onFileChange}
          disabled={parsing}
        />

        {parsing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-red-600"/>
            <p className="text-sm font-medium text-gray-700">{status || 'Processing…'}</p>
            <p className="text-xs text-gray-400">Extracting your details automatically</p>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle size={28} className="text-green-600"/>
            <p className="text-sm font-medium text-green-700">Resume parsed successfully!</p>
            <p className="text-xs text-gray-500 truncate max-w-xs">{fileName}</p>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setSuccess(false); setFileName(null); inputRef.current?.click() }}
              className="text-xs text-red-600 hover:underline mt-1"
            >
              Upload a different file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {fileName ? (
              <>
                <FileText size={28} className="text-gray-500"/>
                <p className="text-sm font-medium text-gray-700">{fileName}</p>
              </>
            ) : (
              <>
                <Upload size={28} className={dragging ? 'text-red-600' : 'text-gray-400'}/>
                <p className="text-sm font-semibold text-gray-700">
                  {dragging ? 'Drop your resume here' : 'Upload Resume'}
                </p>
                <p className="text-xs text-gray-400">
                  Drag &amp; drop or <span className="text-red-600 font-medium">click to browse</span>
                </p>
                <p className="text-xs text-gray-400">PDF, Word (.doc/.docx), or .txt · Max 10 MB</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0"/>
          {error}
        </div>
      )}

      {/* AI autofill hint */}
      {!success && !parsing && (
        <p className="mt-2 text-xs text-gray-400 text-center">
          <Sparkles size={11} className="inline mr-1 text-red-500"/>
          AI will auto-fill your details from the resume
        </p>
      )}
    </div>
  )
}

/* ── Main Apply Page ───────────────────────────────────────────────────────── */
export default function ApplyPage() {
  const { jobId } = useParams()
  const [job, setJob]         = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [parsing,  setParsing]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', current_title: '',
    current_company: '', experience_years: '', location: '', salary_expectation: '', summary: '',
    skills: '',
  })

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`).then(r => r.json()).then(d => { setJob(d); setLoading(false) })
  }, [jobId])

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  /** Called when resume is successfully parsed */
  function handleParsed(data: any) {
    setForm({
      full_name:          data.full_name          || '',
      email:              data.email              || '',
      phone:              data.phone              || '',
      current_title:      data.current_title      || '',
      current_company:    data.current_company    || '',
      experience_years:   String(data.experience_years || ''),
      location:           data.location           || '',
      salary_expectation: String(data.salary_expectation || ''),
      summary:            data.summary            || '',
      skills:             Array.isArray(data.skills) ? data.skills.join(', ') : (data.skills || ''),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const candRes = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        experience_years:   Number(form.experience_years),
        salary_expectation: Number(form.salary_expectation),
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        source: 'apply_link',
      }),
    })
    const candidate = await candRes.json()

    const scoreRes = await fetch('/api/ai/score-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle: job?.title, candidateName: form.full_name }),
    })
    const score = await scoreRes.json()

    await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id:           jobId,
        candidate_id:     candidate.id,
        status:           'applied',
        ai_match_score:   score.score,
        ai_match_summary: score.summary,
        ai_strengths:     score.strengths,
        ai_gaps:          score.gaps,
      }),
    })

    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  )

  if (!job) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">Job not found.</div>
  )

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
        <p className="text-gray-500 text-sm">
          Thank you for applying to <strong>{job.title}</strong> at Howell. Our team will review your profile and be in touch soon.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4">

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-black">H</span>
            </div>
            <div>
              <div className="font-bold text-gray-900">Howell</div>
              <div className="text-xs text-gray-400">AI-Enabled HR Platform</div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>{job.department}</span>
            <span>·</span>
            <span>{job.location}</span>
            <span>·</span>
            <span>{job.experience_min}–{job.experience_max} yrs</span>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Your Application</h2>

          {/* ── Resume upload zone ── */}
          <ResumeDropZone onParsed={handleParsed} parsing={parsing} setParsing={setParsing}/>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"/></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">or fill in manually</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current Title</label>
                <input value={form.current_title} onChange={e => set('current_title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current Company</label>
                <input value={form.current_company} onChange={e => set('current_company', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Years of Experience</label>
                <input type="number" value={form.experience_years} onChange={e => set('experience_years', e.target.value)}
                  min={0} max={40}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expected CTC (LPA)</label>
                <input type="number" value={form.salary_expectation} onChange={e => set('salary_expectation', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
              <input value={form.skills} onChange={e => set('skills', e.target.value)}
                placeholder="e.g. Java, Spring Boot, AWS"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Professional Summary</label>
              <textarea value={form.summary} onChange={e => set('summary', e.target.value)}
                rows={4} placeholder="Brief overview of your background…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
            </div>

            <button
              type="submit"
              disabled={submitting || parsing}
              className="w-full bg-red-700 hover:bg-red-800 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting & Scoring…</> : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>

      <CandidateChatbot jobTitle={job.title} candidateName={form.full_name}/>
    </div>
  )
}
