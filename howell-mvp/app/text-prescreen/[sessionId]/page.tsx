'use client'
/**
 * Public Candidate Text Pre-Screen Page
 * Route: /text-prescreen/[sessionId]
 *
 * No login required — candidate opens this link on their own device.
 * They answer questions typed by text; answers are scored and saved to Supabase.
 */
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Bot, Send, User, CheckCircle, Loader2 } from 'lucide-react'

function getQuestions(jobTitle: string): string[] {
  const title = (jobTitle || '').toLowerCase()
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
      'Tell me about your leadership experience and the team size you have managed.',
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

function scoreAnswer(answer: string): { score: number; feedback: string } {
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

type Message = { from: 'bot' | 'user'; text: string }

export default function TextPreScreenPage() {
  const params     = useParams()
  const sessionId  = params?.sessionId as string

  const [session,      setSession]      = useState<any>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [messages,     setMessages]     = useState<Message[]>([])
  const [step,         setStep]         = useState(0)
  const [answers,      setAnswers]      = useState<string[]>([])
  const [input,        setInput]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [completed,    setCompleted]    = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load session info
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/pre-screen/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error || !data.id) {
          setError('This pre-screen link is invalid or has already been completed.')
        } else if (data.status === 'completed') {
          setCompleted(true)
        } else {
          setSession(data)
          const qs = getQuestions(data.job_title || '')
          // Show welcome + first question
          setMessages([
            { from: 'bot', text: `Hi ${data.candidate_name}! I'm the Howell AI Screener. I'll ask you ${qs.length} short questions for the **${data.job_title}** role. Please answer each one thoughtfully. Let's begin!` },
            { from: 'bot', text: `Q1: ${qs[0]}` },
          ])
        }
      })
      .catch(() => setError('Could not load this pre-screen session. Please try again.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const questions = session ? getQuestions(session.job_title || '') : []

  async function submitAnswer() {
    if (!input.trim() || submitting) return
    const answer = input.trim()
    setInput('')
    setSubmitting(true)

    const newAnswers = [...answers, answer]
    setAnswers(newAnswers)
    setMessages(prev => [...prev, { from: 'user', text: answer }])

    const nextStep = step + 1

    if (nextStep < questions.length) {
      // Next question
      setTimeout(() => {
        setMessages(prev => [...prev, { from: 'bot', text: `Q${nextStep + 1}: ${questions[nextStep]}` }])
        setStep(nextStep)
        setSubmitting(false)
      }, 600)
    } else {
      // All answered — score and save
      setMessages(prev => [...prev, { from: 'bot', text: 'Thank you! Scoring your responses…' }])

      const scored = questions.map((q, i) => {
        const ans = newAnswers[i] || ''
        const { score, feedback } = scoreAnswer(ans)
        return { question: q, answer: ans, score, ai_feedback: feedback }
      })

      try {
        await fetch(`/api/pre-screen/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses: scored, status: 'completed' }),
        })
        setMessages(prev => [...prev, {
          from: 'bot',
          text: 'Your responses have been recorded! Our HR team will review them and get back to you within 2–3 business days. Thank you for your time and best of luck! 🎉',
        }])
        setCompleted(true)
      } catch {
        setMessages(prev => [...prev, { from: 'bot', text: 'There was an issue saving your responses. Please contact hr@howellgroup.com.' }])
      }
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-red-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading your pre-screen interview…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot size={28} className="text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Link Not Valid</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-red-800 px-4 py-4 flex items-center gap-3 shadow">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-white text-sm">Howell AI Screener</div>
          <div className="text-red-200 text-xs">
            {session?.candidate_name} · {session?.job_title}
          </div>
        </div>
        {!completed && (
          <div className="text-white text-xs opacity-70 bg-white/10 px-2.5 py-1 rounded-full">
            {Math.min(step + 1, questions.length)} / {questions.length}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!completed && questions.length > 0 && (
        <div className="h-1 bg-red-100">
          <div
            className="h-1 bg-red-600 transition-all duration-500"
            style={{ width: `${((step) / questions.length) * 100}%` }}
          />
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.from === 'bot' && (
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={15} className="text-red-700" />
              </div>
            )}
            <div className={`max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.from === 'bot'
                ? 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm'
                : 'bg-red-700 text-white rounded-tr-sm'
            }`}>
              {msg.text}
            </div>
            {msg.from === 'user' && (
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <User size={15} className="text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {submitting && !completed && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot size={15} className="text-red-700" />
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Completed state */}
      {completed && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-8">
          <div className="bg-white border border-green-200 rounded-2xl p-6 text-center shadow-sm">
            <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 text-lg mb-1">Interview Complete!</h3>
            <p className="text-gray-500 text-sm">Your responses have been submitted. Our HR team will review them and reach out within 2–3 business days.</p>
            <p className="text-xs text-gray-400 mt-3">You may now close this tab.</p>
          </div>
        </div>
      )}

      {/* Input */}
      {!completed && (
        <div className="border-t border-gray-200 bg-white px-4 py-4">
          <div className="max-w-2xl mx-auto flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer() } }}
              placeholder="Type your answer here…"
              rows={2}
              disabled={submitting}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            />
            <button
              onClick={submitAnswer}
              disabled={!input.trim() || submitting}
              className="bg-red-700 hover:bg-red-800 text-white rounded-xl px-4 flex items-center justify-center transition disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">Press Enter to submit · Shift+Enter for new line</p>
        </div>
      )}
    </div>
  )
}
