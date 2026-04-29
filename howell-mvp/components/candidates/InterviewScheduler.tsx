'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Calendar, Video, Users, Loader2 } from 'lucide-react'
import type { Application } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  application: Application
  onScheduled?: () => void
}

export default function InterviewScheduler({ open, onClose, application, onScheduled }: Props) {
  const { toast } = useToast()
  const candidate = application.candidate
  const job = application.job

  const tomorrow = new Date(Date.now() + 86400000)
  const defaultDate = tomorrow.toISOString().split('T')[0]

  const [form, setForm] = useState({
    date: defaultDate,
    time: '10:00',
    duration: 60,
    type: 'video' as 'video' | 'in_person' | 'phone',
    meeting_link: 'https://meet.google.com/new',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString()

    // Create interview
    await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application_id: application.id,
        scheduled_at,
        duration_minutes: form.duration,
        interview_type: form.type,
        meeting_link: form.type === 'video' ? form.meeting_link : null,
        candidate_name: candidate?.full_name,
        candidate_email: candidate?.email,
        candidate_phone: candidate?.phone,
        job_title: job?.title,
      }),
    })

    // Move application to interview_scheduled
    await fetch(`/api/applications/${application.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'interview_scheduled' }),
    })

    // Send notification
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_name: candidate?.full_name,
        recipient_email: candidate?.email,
        recipient_phone: candidate?.phone,
        channel: 'whatsapp',
        message: `Hi ${candidate?.full_name},\n\nYour interview for *${job?.title}* at Howell is confirmed!\n\n📅 Date: ${new Date(scheduled_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}\n⏰ Time: ${new Date(scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}\n${form.type === 'video' ? `🔗 Join: ${form.meeting_link}` : '📍 Venue: Howell Office'}\n\nPlease confirm your attendance.\n\nBest regards,\nHowell HR Team`,
      }),
    })

    setSaving(false)
    toast(`Interview scheduled with ${candidate?.full_name}!`)
    onClose()
    onScheduled?.()
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Interview">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Candidate + Job Summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="font-semibold text-gray-900 text-sm">{candidate?.full_name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{job?.title} · {job?.location}</div>
        </div>

        {/* Interview Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Interview Type</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'video',     label: 'Video Call', icon: Video },
              { value: 'in_person', label: 'In-Person',  icon: Users },
              { value: 'phone',     label: 'Phone',      icon: Calendar },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('type', opt.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition ${
                  form.type === opt.value
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <opt.icon size={18} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              min={defaultDate}
              onChange={e => set('date', e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={form.time}
              onChange={e => set('time', e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
          <select
            value={form.duration}
            onChange={e => set('duration', Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
          </select>
        </div>

        {/* Meeting Link (video only) */}
        {form.type === 'video' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
            <input
              value={form.meeting_link}
              onChange={e => set('meeting_link', e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes for Interviewer</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            placeholder="Focus areas, panel members…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>

        <div className="pt-2 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Scheduling…</> : 'Schedule & Notify'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
