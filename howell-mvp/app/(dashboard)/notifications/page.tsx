'use client'
import { useEffect, useState } from 'react'
import { Mail, MessageCircle, CheckCircle, Clock } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Notification } from '@/types'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', channel: 'email', subject: '', message: '' })

  useEffect(() => {
    fetch('/api/notifications').then(r => r.json()).then(d => { setNotifications(d); setLoading(false) })
  }, [])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_name: form.name, recipient_email: form.email,
        recipient_phone: form.phone, channel: form.channel,
        subject: form.subject, message: form.message,
      }),
    })
    const notif = await res.json()
    setNotifications(prev => [notif, ...prev])
    setForm({ name: '', email: '', phone: '', channel: 'email', subject: '', message: '' })
    setSending(false)
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 text-sm mt-1">Send emails or WhatsApp messages to candidates</p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Compose */}
        <div className="col-span-2">
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Compose</h2>
            <form onSubmit={send} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Recipient Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Candidate name" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
                <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              {form.channel === 'email' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    type="email" placeholder="candidate@email.com" required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 98000 00000" required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              )}
              {form.channel === 'email' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Interview Invitation — Howell"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={5} placeholder="Hi {name}, …" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>
              <button type="submit" disabled={sending}
                className="w-full bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-60">
                {sending ? 'Sending…' : `Send via ${form.channel === 'email' ? 'Email' : 'WhatsApp'}`}
              </button>
            </form>
          </div>
        </div>

        {/* Log */}
        <div className="col-span-3">
          <h2 className="font-semibold text-gray-900 mb-3">Sent Messages ({notifications.length})</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
          ) : (
            <div className="space-y-3">
              {notifications.map(n => (
                <div key={n.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${n.channel === 'whatsapp' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                      {n.channel === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-gray-900">{n.recipient_name}</span>
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle size={11} /> Sent
                        </span>
                      </div>
                      {n.subject && <div className="text-xs text-gray-500 mt-0.5">{n.subject}</div>}
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2 whitespace-pre-wrap">{n.message}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                        <Clock size={10} />
                        {n.sent_at ? formatDateTime(n.sent_at) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No messages sent yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
