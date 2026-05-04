'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Gift, Plus, CheckCircle, Clock, XCircle, Send, TrendingUp,
  FileText, Loader2, Sparkles, PenLine, Download, X, AlertTriangle,
  ChevronRight, RefreshCw, ThumbsUp,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface ApprovalStep {
  step:          number
  role:          string
  approver_name: string
  status:        'pending' | 'approved' | 'rejected' | 'waiting'
  approved_at:   string | null
  comments:      string
}

interface Offer {
  id:                 string
  candidate_name:     string
  candidate_email:    string | null
  role:               string
  department:         string
  location:           string
  joining_date:       string | null
  ctc_annual:         number
  ctc_breakdown:      Record<string, number>
  benchmark_min:      number | null
  benchmark_max:      number | null
  benchmark_median:   number | null
  ai_benchmark_notes: string | null
  approval_chain:     ApprovalStep[]
  current_step:       number
  status:             string
  sent_at:            string | null
  accepted_at:        string | null
  candidate_signature: string | null
  signed_at:          string | null
  notes:              string | null
  created_at:         string
}

/* ── Status config ─────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { color: string; label: string; dot: string }> = {
  draft:            { color: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400',    label: 'Draft' },
  pending_approval: { color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500',  label: 'Pending Approval' },
  approved:         { color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    label: 'Approved' },
  sent:             { color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500',  label: 'Sent to Candidate' },
  accepted:         { color: 'bg-green-100 text-green-700',   dot: 'bg-green-500',   label: 'Accepted' },
  declined:         { color: 'bg-red-100 text-red-700',       dot: 'bg-red-500',     label: 'Declined' },
  expired:          { color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500',  label: 'Expired' },
}

/* ── Signature Pad ─────────────────────────────────────────────────────────── */
function SignaturePad({ onSign, onClose }: { onSign: (data: string) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    drawing.current = true
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e, canvas)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827'
    ctx.lineTo(x, y); ctx.stroke()
    setIsEmpty(false)
  }

  function endDraw() { drawing.current = false }

  function clear() {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }

  function confirm() {
    if (isEmpty || !canvasRef.current) return
    onSign(canvasRef.current.toDataURL('image/png'))
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PenLine size={18} className="text-violet-600"/>
            <h2 className="text-base font-bold text-gray-900">Digital Signature</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16}/></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-3">Sign in the box below using your mouse or touch to accept this offer.</p>
          <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden relative">
            <canvas
              ref={canvasRef} width={560} height={200}
              className="w-full cursor-crosshair touch-none block"
              style={{ background: 'transparent' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
            />
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-300 text-sm">Sign here…</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
            <button onClick={clear} className="text-sm text-gray-500 hover:text-gray-700 underline">Clear</button>
            <div className="flex gap-3">
              <button onClick={onClose} className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={confirm} disabled={isEmpty}
                className="flex items-center gap-2 text-sm px-5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-semibold">
                <CheckCircle size={14}/> Confirm Signature
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Offer Letter Preview Modal ────────────────────────────────────────────── */
function OfferLetterModal({ offerId, candidateName, onClose }: { offerId: string; candidateName: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [html, setHtml]       = useState('')

  useEffect(() => {
    fetch(`/api/offers/${offerId}/generate-letter`)
      .then(r => r.text())
      .then(t => { setHtml(t); setLoading(false) })
      .catch(() => setLoading(false))
  }, [offerId])

  function printLetter() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-red-600"/>
            <h2 className="text-base font-bold text-gray-900">Offer Letter — {candidateName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printLetter} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-medium">
              <Download size={14}/> Download / Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={24} className="animate-spin text-gray-400"/>
            </div>
          ) : (
            <iframe
              srcDoc={html}
              className="w-full rounded-xl border border-gray-200 shadow-sm bg-white"
              style={{ height: '600px' }}
              title="Offer Letter Preview"
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Create Offer Modal ────────────────────────────────────────────────────── */
function CreateOfferModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving,    setSaving]    = useState(false)
  const [fetching,  setFetching]  = useState(false)
  const [benchmark, setBenchmark] = useState<any>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [form, setForm] = useState({
    candidate_name: '', candidate_email: '', role: '', department: 'Engineering',
    location: 'Chennai, India', joining_date: '', ctc_annual: '',
    notes: '',
  })

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function fetchBenchmark() {
    if (!form.role) { setError('Enter a role first to get benchmark'); return }
    setFetching(true); setError(null)
    try {
      const res  = await fetch('/api/offers/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: form.role, location: form.location, ctc_offered: Number(form.ctc_annual) || undefined }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setBenchmark(data)
    } catch (e: any) { setError(e.message) }
    finally { setFetching(false) }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.candidate_name || !form.role || !form.ctc_annual) {
      setError('Name, role, and CTC are required'); return
    }
    setSaving(true); setError(null)
    try {
      const ctc = Number(form.ctc_annual)
      // Build simple CTC breakdown from annual figure
      const breakdown = {
        basic:              Math.round(ctc * 0.40 * 100) / 100,
        hra:                Math.round(ctc * 0.20 * 100) / 100,
        special_allowance:  Math.round(ctc * 0.25 * 100) / 100,
        performance_bonus:  Math.round(ctc * 0.10 * 100) / 100,
        pf_employer:        Math.round(ctc * 0.03 * 100) / 100,
        gratuity:           Math.round(ctc * 0.02 * 100) / 100,
      }
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ctc_annual:         ctc,
          ctc_breakdown:      breakdown,
          benchmark_min:      benchmark?.min      || null,
          benchmark_max:      benchmark?.max      || null,
          benchmark_median:   benchmark?.median   || null,
          ai_benchmark_notes: benchmark?.notes    || null,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      onCreated()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Plus size={16} className="text-red-600"/><h2 className="font-bold text-gray-900">Create Offer</h2></div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={15}/></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Candidate Name *', 'candidate_name', 'text'],
              ['Email', 'candidate_email', 'email'],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                <input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"/>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Job Role *</label>
              <input value={form.role} onChange={e => set('role', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="Senior Site Engineer"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
              <input value={form.department} onChange={e => set('department', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Joining Date</label>
              <input type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"/>
            </div>
          </div>

          {/* CTC + AI Benchmark */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Offered CTC (LPA) *</label>
            <div className="flex gap-2">
              <input type="number" min={1} step={0.5} value={form.ctc_annual} onChange={e => set('ctc_annual', e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="18"/>
              <button type="button" onClick={fetchBenchmark} disabled={fetching}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-violet-50 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-100 transition whitespace-nowrap disabled:opacity-60">
                {fetching ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                AI Benchmark
              </button>
            </div>
          </div>

          {/* Benchmark result */}
          {benchmark && (
            <div className="bg-gradient-to-r from-green-50 to-violet-50 border border-green-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} className="text-violet-600"/>
                <span className="text-xs font-bold text-gray-700">AI Market Benchmark</span>
              </div>
              <div className="flex items-center gap-4 text-sm mb-2">
                <div className="text-center"><div className="text-xs text-gray-400">Min</div><div className="font-bold text-gray-700">₹{benchmark.min} LPA</div></div>
                <div className="flex-1 h-2 bg-gray-200 rounded-full relative">
                  <div className="absolute inset-y-0 bg-green-300 rounded-full" style={{ width: '100%' }}/>
                  {form.ctc_annual && (
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow"
                      style={{ left: `${Math.min(95, Math.max(5, ((Number(form.ctc_annual) - benchmark.min) / (benchmark.max - benchmark.min)) * 100))}%` }}/>
                  )}
                </div>
                <div className="text-center"><div className="text-xs text-gray-400">Max</div><div className="font-bold text-gray-700">₹{benchmark.max} LPA</div></div>
              </div>
              <p className="text-xs text-gray-600">{benchmark.notes}</p>
              {benchmark.optimisation_tips?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {benchmark.optimisation_tips.map((tip: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="text-violet-400 mt-0.5">•</span>{tip}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400"/>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-red-800">
              {saving ? <><Loader2 size={14} className="animate-spin"/> Creating…</> : 'Create & Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────────────────────── */
export default function OffersPage() {
  const [offers,        setOffers]        = useState<Offer[]>([])
  const [loading,       setLoading]       = useState(true)
  const [selected,      setSelected]      = useState<Offer | null>(null)
  const [showCreate,    setShowCreate]    = useState(false)
  const [showLetter,    setShowLetter]    = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [approving,     setApproving]     = useState(false)
  const [signing,       setSigning]       = useState(false)
  const [sendingOffer,  setSendingOffer]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/offers')
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setOffers(list)
      // Refresh selected if present
      if (selected) {
        const updated = list.find((o: Offer) => o.id === selected.id)
        if (updated) setSelected(updated)
      }
    } catch {}
    finally { setLoading(false) }
  }, [selected?.id])

  useEffect(() => { load() }, [])

  async function approveStep(offerId: string, comments = 'Approved') {
    setApproving(true)
    try {
      const res  = await fetch(`/api/offers/${offerId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      })
      const data = await res.json()
      if (data.offer) {
        setOffers(prev => prev.map(o => o.id === offerId ? data.offer : o))
        setSelected(data.offer)
      }
    } catch {}
    finally { setApproving(false) }
  }

  async function markSent(offerId: string) {
    setSendingOffer(true)
    try {
      const res  = await fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
      })
      const data = await res.json()
      if (data.id) {
        setOffers(prev => prev.map(o => o.id === offerId ? data : o))
        setSelected(data)
      }
    } catch {}
    finally { setSendingOffer(false) }
  }

  async function saveSignature(signatureData: string) {
    if (!selected) return
    setSigning(true)
    try {
      const res  = await fetch(`/api/offers/${selected.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data: signatureData }),
      })
      const data = await res.json()
      if (data.offer) {
        setOffers(prev => prev.map(o => o.id === selected.id ? data.offer : o))
        setSelected(data.offer)
      }
      setShowSignature(false)
    } catch {}
    finally { setSigning(false) }
  }

  const accepted = offers.filter(o => o.status === 'accepted').length
  const pending  = offers.filter(o => o.status === 'pending_approval').length
  const approved = offers.filter(o => o.status === 'approved').length

  // Pending approval step label for selected offer
  const pendingStep = selected?.approval_chain?.find(s => s.status === 'pending')

  return (
    <div className="p-8">
      {/* Modals */}
      {showCreate    && <CreateOfferModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }}/>}
      {showLetter && selected && <OfferLetterModal offerId={selected.id} candidateName={selected.candidate_name} onClose={() => setShowLetter(false)}/>}
      {showSignature && <SignaturePad onSign={saveSignature} onClose={() => setShowSignature(false)}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offers & Negotiation</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI salary benchmarks · auto-generated letters · digital signatures</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Refresh">
            <RefreshCw size={15} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`}/>
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
            <Plus size={15}/> Create Offer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Offers',     value: offers.length,   color: 'text-gray-900' },
          { label: 'Pending Approval', value: pending,         color: 'text-yellow-600' },
          { label: 'Approved / Sent',  value: approved,        color: 'text-blue-600' },
          { label: 'Accepted',         value: accepted,        color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Offer List */}
        <div className="col-span-2 space-y-2">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin text-gray-300"/>
            </div>
          )}
          {!loading && offers.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <Gift size={32} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-gray-400 text-sm">No offers yet</p>
            </div>
          )}
          {!loading && offers.map(o => {
            const cfg      = STATUS_CFG[o.status] || STATUS_CFG.draft
            const allSteps = o.approval_chain || []
            const approved = allSteps.filter(s => s.status === 'approved').length
            return (
              <div key={o.id} onClick={() => setSelected(o)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id === o.id ? 'border-red-500 shadow-md' : 'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="font-semibold text-sm text-gray-900 truncate pr-2">{o.candidate_name}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex items-center gap-1 ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-2 truncate">{o.role}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-900">₹{o.ctc_annual} LPA</span>
                  {o.benchmark_min && o.benchmark_max && (
                    <span className="text-gray-400">Mkt: ₹{o.benchmark_min}–{o.benchmark_max} LPA</span>
                  )}
                </div>
                {/* Approval progress bar */}
                <div className="flex gap-1 mt-2.5">
                  {allSteps.map((s, i) => (
                    <div key={i} title={`${s.role}: ${s.status}`}
                      className={`flex-1 h-1.5 rounded-full ${s.status === 'approved' ? 'bg-green-500' : s.status === 'pending' ? 'bg-yellow-400' : 'bg-gray-200'}`}/>
                  ))}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">{approved}/{allSteps.length} approvals</div>
              </div>
            )
          })}
        </div>

        {/* Detail Panel */}
        <div className="col-span-3">
          {!selected ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
              <Gift size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select an offer to view details</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              {/* Offer header */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">{selected.candidate_name}</h2>
                    <p className="text-sm text-gray-500">{selected.role} · {selected.department}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{selected.location} · Join: {selected.joining_date ? new Date(selected.joining_date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : 'TBD'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUS_CFG[selected.status]?.color}`}>
                      {STATUS_CFG[selected.status]?.label}
                    </span>
                    <div className="flex gap-2">
                      {/* Generate letter */}
                      <button onClick={() => setShowLetter(true)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:border-red-300 hover:text-red-700 transition font-medium">
                        <FileText size={12}/> View Letter
                      </button>
                      {/* Send to candidate (when approved) */}
                      {selected.status === 'approved' && (
                        <button onClick={() => markSent(selected.id)} disabled={sendingOffer}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-60">
                          {sendingOffer ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>} Send to Candidate
                        </button>
                      )}
                      {/* Sign (when sent) */}
                      {selected.status === 'sent' && !selected.candidate_signature && (
                        <button onClick={() => setShowSignature(true)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition font-medium">
                          <PenLine size={12}/> Sign Offer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">

                {/* AI Salary Benchmark */}
                {selected.benchmark_min && selected.benchmark_max ? (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={15} className="text-violet-600"/>
                      <span className="text-sm font-bold text-gray-900">AI Salary Benchmark</span>
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-xs text-gray-400 mb-0.5">Market Min</div>
                        <div className="text-base font-bold text-gray-700">₹{selected.benchmark_min} LPA</div>
                      </div>
                      <div className="flex-1 relative h-3 bg-gray-200 rounded-full">
                        <div className="absolute inset-y-0 bg-green-300 rounded-full" style={{ width: '100%' }}/>
                        {selected.benchmark_median && (
                          <div className="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-blue-400 rounded"
                            style={{ left: `${((selected.benchmark_median - selected.benchmark_min) / (selected.benchmark_max - selected.benchmark_min)) * 100}%` }}/>
                        )}
                        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow"
                          style={{ left: `${Math.min(95, Math.max(5, ((selected.ctc_annual - selected.benchmark_min) / (selected.benchmark_max - selected.benchmark_min)) * 100))}%` }}/>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400 mb-0.5">Market Max</div>
                        <div className="text-base font-bold text-gray-700">₹{selected.benchmark_max} LPA</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3 text-xs mb-2">
                      <span className="text-gray-600">Offered: <strong className="text-gray-900">₹{selected.ctc_annual} LPA</strong></span>
                      {selected.ctc_annual <= selected.benchmark_max && selected.ctc_annual >= selected.benchmark_min ? (
                        <span className="text-green-600 font-semibold">✓ Within market range</span>
                      ) : selected.ctc_annual > selected.benchmark_max ? (
                        <span className="text-orange-500 font-semibold">⚠ Above market rate</span>
                      ) : (
                        <span className="text-red-500 font-semibold">⚠ Below market rate</span>
                      )}
                    </div>
                    {selected.ai_benchmark_notes && (
                      <p className="text-xs text-gray-600 border-t border-green-100 pt-2 mt-2">{selected.ai_benchmark_notes}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                    <Sparkles size={18} className="mx-auto text-gray-300 mb-1"/>
                    <p className="text-xs text-gray-400">No AI benchmark — use the Create Offer flow to generate one</p>
                  </div>
                )}

                {/* CTC Breakdown */}
                {Object.keys(selected.ctc_breakdown || {}).length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">CTC Breakdown</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(selected.ctc_breakdown).map(([key, val]) => (
                        <div key={key} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                          <div className="text-[10px] text-gray-400 capitalize">{key.replace(/_/g, ' ')}</div>
                          <div className="font-bold text-sm text-gray-800">₹{val} LPA</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approval Workflow */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Approval Workflow</h3>
                  <div className="space-y-2">
                    {(selected.approval_chain || []).map((step, i) => {
                      const isApproved = step.status === 'approved'
                      const isPending  = step.status === 'pending'
                      const isWaiting  = step.status === 'waiting'
                      return (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${isApproved ? 'bg-green-50 border-green-100' : isPending ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white ${isApproved ? 'bg-green-500' : isPending ? 'bg-yellow-500' : 'bg-gray-300'}`}>
                            {isApproved ? <CheckCircle size={14}/> : <span className="text-xs font-bold">{i + 1}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-800">{step.role}</div>
                            <div className="text-xs text-gray-500">{step.approver_name}</div>
                            {isApproved && step.comments && (
                              <div className="text-[10px] text-green-600 mt-0.5">"{step.comments}"</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isApproved && step.approved_at && (
                              <span className="text-[10px] text-gray-400">{new Date(step.approved_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}</span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isApproved ? 'text-green-700 bg-green-100' : isPending ? 'text-yellow-700 bg-yellow-100' : 'text-gray-400 bg-gray-100'}`}>
                              {isApproved ? 'Approved' : isPending ? 'Pending' : 'Waiting'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Approve CTA */}
                  {pendingStep && (
                    <button onClick={() => approveStep(selected.id)} disabled={approving}
                      className="w-full mt-3 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60">
                      {approving ? <Loader2 size={14} className="animate-spin"/> : <ThumbsUp size={14}/>}
                      Approve — {pendingStep.role}
                    </button>
                  )}

                  {selected.status === 'approved' && (
                    <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                      <CheckCircle size={16} className="text-blue-500"/>
                      <span className="text-sm text-blue-700 font-medium">All approvals complete — ready to send to candidate</span>
                      <ChevronRight size={14} className="text-blue-400 ml-auto"/>
                    </div>
                  )}
                </div>

                {/* Digital Signature status */}
                {selected.candidate_signature ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <PenLine size={15} className="text-green-600"/>
                      <span className="text-sm font-bold text-green-700">Digitally Signed</span>
                      {selected.signed_at && (
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(selected.signed_at).toLocaleString('en-IN', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                        </span>
                      )}
                    </div>
                    <img src={selected.candidate_signature} alt="Candidate Signature" className="max-h-16 bg-white rounded border border-green-100 p-1"/>
                  </div>
                ) : selected.status === 'sent' ? (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PenLine size={15} className="text-violet-500"/>
                      <span className="text-sm text-violet-700">Awaiting candidate signature</span>
                    </div>
                    <button onClick={() => setShowSignature(true)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-semibold">
                      {signing ? <Loader2 size={11} className="animate-spin"/> : <PenLine size={11}/>} Sign Now
                    </button>
                  </div>
                ) : null}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
