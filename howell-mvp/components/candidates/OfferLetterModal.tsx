'use client'
import { useState, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Loader2, Printer, Send, Sparkles } from 'lucide-react'
import type { Application } from '@/types'
import { formatDate } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  application: Application
}

export default function OfferLetterModal({ open, onClose, application }: Props) {
  const { toast } = useToast()
  const candidate = application.candidate
  const job = application.job
  const printRef = useRef<HTMLDivElement>(null)

  const startDate = new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const [form, setForm] = useState({
    ctc: job?.salary_max ? String(job.salary_max) : '12',
    start_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    designation: job?.title || '',
    department: job?.department || '',
    location: job?.location || '',
    probation: '3',
  })
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated]   = useState(false)
  const [sending, setSending]       = useState(false)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function generate() {
    setGenerating(true)
    await new Promise(r => setTimeout(r, 1000)) // AI feel
    setGenerating(false)
    setGenerated(true)
  }

  function printLetter() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>Offer Letter — ${candidate?.full_name}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 750px; margin: 40px auto; color: #1a1a1a; line-height: 1.7; }
        h1 { color: #b91c1c; } table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        td { padding: 6px 12px; border: 1px solid #e5e7eb; font-size: 14px; }
        td:first-child { background: #f9fafb; font-weight: 600; width: 40%; }
        .signature { margin-top: 60px; }
        @media print { body { margin: 20px; } }
      </style></head>
      <body>${content}</body></html>
    `)
    w.document.close()
    w.print()
  }

  async function sendViaEmail() {
    setSending(true)
    const joiningDate = new Date(form.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_name: candidate?.full_name,
        recipient_email: candidate?.email,
        channel: 'email',
        subject: `Offer Letter — ${form.designation} | Howell`,
        message: `Dear ${candidate?.full_name},\n\nWe are delighted to offer you the position of ${form.designation} at Howell.\n\nOffer Details:\n• Role: ${form.designation}\n• Department: ${form.department}\n• Location: ${form.location}\n• CTC: ₹${form.ctc} LPA\n• Start Date: ${joiningDate}\n• Probation Period: ${form.probation} months\n\nPlease log in to the HR portal to review and sign your offer letter.\n\nWelcome to the Howell family!\n\nBest regards,\nHowell HR Team`,
      }),
    })
    // Update application status to offer
    await fetch(`/api/applications/${application.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'offer' }),
    })
    setSending(false)
    toast(`Offer letter sent to ${candidate?.full_name}!`)
    onClose()
  }

  const joiningDate = new Date(form.start_date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  const todayStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Modal open={open} onClose={onClose} title="Offer Letter Generator" width="max-w-3xl">
      <div className="p-6 space-y-5">
        {/* Configuration */}
        {!generated ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                <input value={form.designation} onChange={e => set('designation', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <input value={form.department} onChange={e => set('department', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">CTC (LPA)</label>
                <input type="number" value={form.ctc} onChange={e => set('ctc', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Joining Date</label>
                <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <input value={form.location} onChange={e => set('location', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Probation (months)</label>
                <select value={form.probation} onChange={e => set('probation', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                </select>
              </div>
            </div>

            <button onClick={generate} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-60">
              {generating
                ? <><Loader2 size={16} className="animate-spin" /> Generating Letter…</>
                : <><Sparkles size={16} /> Generate Offer Letter with AI</>}
            </button>
          </>
        ) : (
          <>
            {/* Letter Preview */}
            <div ref={printRef} className="border border-gray-200 rounded-xl p-8 bg-white text-sm font-serif leading-relaxed">
              {/* Letterhead */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <div className="text-2xl font-black text-red-700 tracking-wide">HOWELL</div>
                  <div className="text-xs text-gray-500 mt-0.5">AI-Enabled HR Platform</div>
                  <div className="text-xs text-gray-400">Mumbai · Delhi · Bengaluru</div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>Date: {todayStr}</div>
                  <div>Ref: HOW/OFR/{new Date().getFullYear()}/{Math.floor(Math.random() * 9000) + 1000}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="font-bold">{candidate?.full_name}</div>
                <div className="text-gray-600">{candidate?.current_title} — {candidate?.current_company}</div>
                <div className="text-gray-600">{candidate?.location}</div>
              </div>

              <h1 className="text-lg font-bold text-gray-900 mb-4">Letter of Offer — {form.designation}</h1>

              <p className="mb-4">Dear <strong>{candidate?.full_name?.split(' ')[0]}</strong>,</p>

              <p className="mb-4">
                We are delighted to extend this offer of employment to you for the position of <strong>{form.designation}</strong> in our <strong>{form.department}</strong> team, based at <strong>{form.location}</strong>. This offer is subject to the terms and conditions outlined below.
              </p>

              <table className="w-full border-collapse mb-6">
                <tbody>
                  {[
                    ['Designation',       form.designation],
                    ['Department',        form.department],
                    ['Location',          form.location],
                    ['Date of Joining',   joiningDate],
                    ['Annual CTC',        `₹${form.ctc} Lakhs Per Annum`],
                    ['Employment Type',   job?.employment_type || 'Full-Time, Permanent'],
                    ['Probation Period',  `${form.probation} months from date of joining`],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td className="border border-gray-200 px-4 py-2 bg-gray-50 font-semibold text-xs w-2/5">{label}</td>
                      <td className="border border-gray-200 px-4 py-2 text-xs">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mb-4">
                This offer is contingent upon satisfactory completion of reference and background verification. Please confirm your acceptance by signing and returning this letter by <strong>{new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              </p>

              <p className="mb-8">
                We look forward to welcoming you to the Howell family. Should you have any questions, please contact us at <strong>hr@howell.com</strong>.
              </p>

              <div className="grid grid-cols-2 gap-12 mt-12">
                <div>
                  <div className="border-t border-gray-400 pt-2 text-xs text-gray-600">
                    <div className="font-semibold">Dharmaraj Sekar</div>
                    <div>HR Admin · Howell</div>
                  </div>
                </div>
                <div>
                  <div className="border-t border-gray-400 pt-2 text-xs text-gray-600">
                    <div className="font-semibold">{candidate?.full_name}</div>
                    <div>Candidate Signature & Date</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setGenerated(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                ← Edit Details
              </button>
              <button onClick={printLetter}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                <Printer size={15} /> Print / Save PDF
              </button>
              <button onClick={sendViaEmail} disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60">
                {sending ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send to Candidate</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
