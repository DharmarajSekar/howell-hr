'use client'
import { useState } from 'react'
import { ShieldCheck, Plus, AlertTriangle, CheckCircle, Clock, XCircle, FileText, Upload, Zap, RefreshCw } from 'lucide-react'

const CHECK_LABELS: Record<string, string> = {
  identity_check:   'Identity Verification',
  education_check:  'Education Check',
  employment_check: 'Employment History',
  address_check:    'Address Verification',
  criminal_check:   'Criminal Record',
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  pending:   { icon: Clock,        color: 'text-gray-500',  bg: 'bg-gray-100' },
  in_review: { icon: Clock,        color: 'text-blue-600',  bg: 'bg-blue-100' },
  verified:  { icon: CheckCircle,  color: 'text-green-600', bg: 'bg-green-100' },
  failed:    { icon: XCircle,      color: 'text-red-600',   bg: 'bg-red-100' },
  flagged:   { icon: AlertTriangle,color: 'text-orange-600',bg: 'bg-orange-100' },
}

const BGV_STATUS_COLORS: Record<string, string> = {
  initiated:   'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  flagged:     'bg-red-100 text-red-700',
}

const DOC_TYPES = [
  'Aadhaar Card', 'PAN Card', 'Passport', 'Driving License',
  'Degree Certificate', '10th Marksheet', '12th Marksheet',
  'Offer Letter (Previous)', 'Relieving Letter', 'Payslips (Last 3 months)',
  'Bank Statement', 'Police Clearance Certificate',
]

interface Props {
  records: any[]
  applications: any[]
}

export default function BGVClient({ records: initial, applications }: Props) {
  const [records, setRecords]     = useState<any[]>(initial)
  const [selected, setSelected]   = useState<any>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [formApp, setFormApp]     = useState('')
  const [adding, setAdding]       = useState(false)
  const [running, setRunning]     = useState(false)
  const [uploadType, setUploadType] = useState('')
  const [uploading, setUploading] = useState(false)

  async function initiateBGV() {
    const app = applications.find((a: any) => a.id === formApp)
    if (!app) return
    setAdding(true)
    try {
      const res = await fetch('/api/bgv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: app.candidate_id,
          application_id: app.id,
          candidate_name: app.candidate?.full_name || 'Candidate',
          job_title: app.job?.title || 'Unknown Role',
        }),
      })
      const record = await res.json()
      setRecords(prev => [{ ...record, documents: [] }, ...prev])
      setSelected({ ...record, documents: [] })
      setShowAdd(false)
      setFormApp('')
    } finally {
      setAdding(false)
    }
  }

  async function runCheck(recordId: string) {
    setRunning(true)
    // Simulate AI running BGV checks
    await new Promise(r => setTimeout(r, 1200))
    const statuses = ['verified','verified','verified','verified','in_review']
    const checkKeys = Object.keys(CHECK_LABELS)
    const updates: Record<string, string> = {}
    checkKeys.forEach((key, i) => {
      updates[key] = statuses[i % statuses.length]
    })
    const fraud_flag = Math.random() < 0.1  // 10% chance of fraud flag for demo
    const res = await fetch(`/api/bgv/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updates,
        status: fraud_flag ? 'flagged' : 'completed',
        fraud_flag,
        fraud_notes: fraud_flag ? 'Discrepancy detected in employment history. Previous employer dates do not match.' : null,
        completed_at: fraud_flag ? null : new Date().toISOString(),
      }),
    })
    const updated = await res.json()
    const full = { ...updated, documents: selected?.documents || [] }
    setRecords(prev => prev.map((r: any) => r.id === recordId ? full : r))
    setSelected(full)
    setRunning(false)
  }

  async function uploadDocument(recordId: string) {
    if (!uploadType) return
    setUploading(true)
    try {
      const res = await fetch(`/api/bgv/${recordId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: uploadType,
          file_name: `${uploadType.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.pdf`,
        }),
      })
      const doc = await res.json()
      setSelected((s: any) => ({ ...s, documents: [...(s.documents || []), doc] }))
      setRecords(prev => prev.map((r: any) =>
        r.id === recordId ? { ...r, documents: [...(r.documents || []), doc] } : r
      ))
      setUploadType('')
    } finally {
      setUploading(false)
    }
  }

  const checks = Object.keys(CHECK_LABELS)
  const completedCount = records.filter((r:any) => r.status === 'completed').length
  const flaggedCount   = records.filter((r:any) => r.fraud_flag).length
  const pendingCount   = records.filter((r:any) => r.status === 'initiated' || r.status === 'in_progress').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BGV & Documentation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Background verification and document management</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Initiate BGV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Records',  value: records.length,   color: 'text-gray-700',  bg: 'bg-white' },
          { label: 'In Progress',    value: pendingCount,     color: 'text-blue-700',  bg: 'bg-blue-50' },
          { label: 'Completed',      value: completedCount,   color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Fraud Flags',    value: flaggedCount,     color: 'text-red-700',   bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Records list */}
        <div className="col-span-2 space-y-2">
          <h2 className="font-semibold text-gray-900 text-sm mb-2">Records ({records.length})</h2>
          {records.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <ShieldCheck size={32} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-sm text-gray-400">No BGV records yet. Initiate verification for hired candidates.</p>
            </div>
          ) : (
            records.map((r: any) => (
              <div key={r.id}
                onClick={() => setSelected(r)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition ${selected?.id === r.id ? 'border-red-500 shadow-md' : 'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="font-medium text-sm text-gray-900">{r.candidate_name}</div>
                  <div className="flex items-center gap-1.5">
                    {r.fraud_flag && <AlertTriangle size={14} className="text-red-500"/>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BGV_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-2">{r.job_title}</div>
                {/* Mini check bar */}
                <div className="flex gap-1">
                  {checks.map(key => {
                    const st = r[key] || 'pending'
                    const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.pending
                    return (
                      <div key={key} className={`flex-1 h-1.5 rounded-full ${st === 'verified' ? 'bg-green-500' : st === 'failed' || st === 'flagged' ? 'bg-red-500' : st === 'in_review' ? 'bg-blue-400' : 'bg-gray-200'}`}/>
                    )
                  })}
                </div>
                <div className="text-xs text-gray-400 mt-1">{(r.documents || []).length} documents</div>
              </div>
            ))
          )}
        </div>

        {/* BGV Detail */}
        <div className="col-span-3">
          {selected ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-gray-900">{selected.candidate_name}</h2>
                  <p className="text-sm text-gray-500">{selected.job_title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1.5 inline-block ${BGV_STATUS_COLORS[selected.status] || 'bg-gray-100 text-gray-500'}`}>
                    {selected.status.replace('_', ' ')}
                  </span>
                </div>
                {selected.status !== 'completed' && selected.status !== 'flagged' && (
                  <button onClick={() => runCheck(selected.id)} disabled={running}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50">
                    {running ? <RefreshCw size={14} className="animate-spin"/> : <Zap size={14}/>}
                    {running ? 'Running…' : 'Run AI Checks'}
                  </button>
                )}
              </div>

              {/* Fraud flag alert */}
              {selected.fraud_flag && (
                <div className="mx-5 mt-4 flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
                  <div>
                    <div className="text-sm font-bold text-red-700 mb-0.5">Fraud Flag Detected</div>
                    <p className="text-xs text-red-600">{selected.fraud_notes || 'Discrepancy found during verification. Manual review required.'}</p>
                  </div>
                </div>
              )}

              {/* Checks grid */}
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Verification Checks</h3>
                <div className="grid grid-cols-1 gap-2">
                  {checks.map(key => {
                    const status = selected[key] || 'pending'
                    const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.pending
                    return (
                      <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg}`}>
                          <cfg.icon size={14} className={cfg.color}/>
                        </div>
                        <span className="text-sm text-gray-700 flex-1">{CHECK_LABELS[key]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                          {status.replace('_', ' ')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Documents */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Documents ({(selected.documents || []).length})</h3>
                </div>

                {/* Upload */}
                <div className="flex gap-2 mb-3">
                  <select value={uploadType} onChange={e => setUploadType(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="">Select document type…</option>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={() => uploadDocument(selected.id)} disabled={!uploadType || uploading}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50">
                    <Upload size={14}/> {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>

                {(selected.documents || []).length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-400">
                    <FileText size={28} className="mx-auto mb-2 text-gray-300"/>
                    No documents uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(selected.documents || []).map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                        <FileText size={16} className="text-gray-500 flex-shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700">{doc.document_type}</div>
                          <div className="text-xs text-gray-400 truncate">{doc.file_name}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${doc.verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {doc.verified ? 'Verified' : 'Uploaded'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center">
              <ShieldCheck size={40} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400">Select a BGV record to view checks, upload documents, and track status</p>
            </div>
          )}
        </div>
      </div>

      {/* Initiate BGV Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Initiate Background Verification</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Candidate</label>
                <select value={formApp} onChange={e => setFormApp(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Select offered/hired candidate…</option>
                  {applications.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.candidate?.full_name} — {a.job?.title} ({a.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600 font-medium mb-1.5">Checks that will be run:</p>
                <div className="flex flex-wrap gap-1">
                  {Object.values(CHECK_LABELS).map(l => (
                    <span key={l} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{l}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAdd(false); setFormApp('') }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={initiateBGV} disabled={!formApp || adding}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                {adding ? 'Initiating…' : 'Initiate BGV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
