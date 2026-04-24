'use client'
import { useState } from 'react'
import { Package, Plus, AlertTriangle, CheckCircle, Clock, Search, Filter, Laptop, Smartphone, Car, Tool, Wrench } from 'lucide-react'

const ASSET_CATEGORIES = ['Laptop','Mobile Phone','Vehicle','Tools & Equipment','Safety Gear','Access Card','Other']

const MOCK_ASSETS = [
  { id:'AST-001', name:'Dell Latitude 5540',     category:'Laptop',           assignedTo:'Amit Singh',    employeeId:'EMP-001', site:'Bengaluru HQ',  status:'assigned',   serial:'DL5540-BLR-001', value:85000,  assignedOn:'2025-01-10', returnDue: null,       condition:'Good' },
  { id:'AST-002', name:'iPhone 14 Pro',           category:'Mobile Phone',     assignedTo:'Neha Gupta',    employeeId:'EMP-002', site:'Mumbai Site A', status:'assigned',   serial:'IP14P-MUM-001', value:110000, assignedOn:'2025-03-01', returnDue: null,       condition:'Good' },
  { id:'AST-003', name:'Toyota Innova MH-01-AB',  category:'Vehicle',          assignedTo:'Arjun Mehta',   employeeId:'EMP-004', site:'Delhi Site C',  status:'maintenance',serial:'MH01AB9876',    value:950000, assignedOn:'2024-06-15', returnDue:'2026-05-01',condition:'Needs Service' },
  { id:'AST-004', name:'Fluke 376 Clamp Meter',   category:'Tools & Equipment',assignedTo:'Karan Malhotra',employeeId:'EMP-003', site:'Pune Site B',   status:'assigned',   serial:'FLK376-PUN-03', value:18000,  assignedOn:'2025-07-22', returnDue: null,       condition:'Good' },
  { id:'AST-005', name:'Safety Helmet (Red)',      category:'Safety Gear',      assignedTo:'Vikram Rajan',  employeeId:'EMP-008', site:'Mumbai Site A', status:'assigned',   serial:'SH-RED-MUM-07', value:2500,   assignedOn:'2025-02-14', returnDue: null,       condition:'Good' },
  { id:'AST-006', name:'Access Card — L3',         category:'Access Card',      assignedTo:'Priya Nair',    employeeId:'EMP-005', site:'Bengaluru HQ',  status:'assigned',   serial:'AC-L3-BLR-022', value:500,    assignedOn:'2024-11-01', returnDue: null,       condition:'Good' },
  { id:'AST-007', name:'HP EliteBook 840 G9',      category:'Laptop',           assignedTo: null,           employeeId: null,     site:'Bengaluru HQ',  status:'available',  serial:'HP840G9-BLR-04',value:92000,  assignedOn: null,        returnDue: null,       condition:'New' },
  { id:'AST-008', name:'Bosch GBH 2-26 Drill',    category:'Tools & Equipment',assignedTo: null,           employeeId: null,     site:'Pune Site B',   status:'lost',       serial:'BOS-GBH-PUN-01',value:12000,  assignedOn: null,        returnDue: null,       condition:'Lost' },
]

const STATUS_CFG: Record<string,{color:string;label:string}> = {
  assigned:    { color: 'bg-blue-100 text-blue-700',   label: 'Assigned' },
  available:   { color: 'bg-green-100 text-green-700', label: 'Available' },
  maintenance: { color: 'bg-yellow-100 text-yellow-700', label: 'In Maintenance' },
  lost:        { color: 'bg-red-100 text-red-700',     label: 'Lost / Missing' },
  returned:    { color: 'bg-gray-100 text-gray-600',   label: 'Returned' },
}

const CATEGORY_ICONS: Record<string,any> = {
  'Laptop': Laptop, 'Mobile Phone': Smartphone, 'Vehicle': Car,
  'Tools & Equipment': Wrench, 'Safety Gear': Package, 'Access Card': Package, 'Other': Package,
}

export default function AssetsPage() {
  const [assets, setAssets]     = useState(MOCK_ASSETS)
  const [selected, setSelected] = useState<any>(null)
  const [showNew, setShowNew]   = useState(false)
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm]         = useState({ name:'', category: ASSET_CATEGORIES[0], serial:'', value:'', site:'', assignedTo:'', condition:'New' })

  const filtered = assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.serial.toLowerCase().includes(search.toLowerCase()) || (a.assignedTo||'').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalValue    = assets.reduce((s,a)=>s+a.value,0)
  const assignedCount = assets.filter(a=>a.status==='assigned').length
  const lostCount     = assets.filter(a=>a.status==='lost').length
  const maintCount    = assets.filter(a=>a.status==='maintenance').length

  function submitAsset() {
    const id = 'AST-' + String(assets.length + 1).padStart(3,'0')
    setAssets(prev => [{
      id, ...form, value: Number(form.value),
      employeeId: form.assignedTo ? 'EMP-NEW' : null,
      assignedTo: form.assignedTo || null,
      status: form.assignedTo ? 'assigned' : 'available',
      assignedOn: form.assignedTo ? new Date().toISOString().split('T')[0] : null,
      returnDue: null,
    }, ...prev])
    setShowNew(false)
    setForm({ name:'', category: ASSET_CATEGORIES[0], serial:'', value:'', site:'', assignedTo:'', condition:'New' })
  }

  function markReturn(assetId: string) {
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: 'returned', assignedTo: null, employeeId: null } : a))
    setSelected((s:any) => s ? { ...s, status: 'returned', assignedTo: null } : null)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track, allocate, and monitor company assets across all sites</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          <Plus size={16}/> Add Asset
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Assets',    value: assets.length,                           color: 'bg-white' },
          { label: 'Assigned',        value: assignedCount,                           color: 'bg-blue-50 text-blue-700' },
          { label: 'In Maintenance',  value: maintCount,                              color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Lost / Missing',  value: lostCount,                               color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border border-gray-100 rounded-xl p-4 shadow-sm`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {lostCount > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <div>
            <div className="text-sm font-bold text-red-800 mb-1">⚠ {lostCount} Asset(s) Reported Lost / Missing</div>
            <p className="text-xs text-red-600">Immediate action required. Review allocation history and file an insurance claim if applicable.</p>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search asset or employee…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
        </div>
        <div className="flex gap-2">
          {[['all','All'],['assigned','Assigned'],['available','Available'],['maintenance','Maintenance'],['lost','Lost']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterStatus(k)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${filterStatus===k?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Asset','Category','Assigned To','Site','Value','Status'].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(a => {
                  const Icon = CATEGORY_ICONS[a.category] || Package
                  return (
                    <tr key={a.id} onClick={() => setSelected(a)}
                      className={`cursor-pointer transition ${selected?.id===a.id?'bg-red-50':'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Icon size={14} className="text-gray-500"/>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-xs">{a.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{a.serial}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{a.category}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{a.assignedTo || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{a.site}</td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-900">₹{a.value.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CFG[a.status]?.color}`}>{STATUS_CFG[a.status]?.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {selected ? (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    {(() => { const Icon = CATEGORY_ICONS[selected.category] || Package; return <Icon size={18} className="text-gray-500"/> })()}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{selected.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{selected.serial}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CFG[selected.status]?.color}`}>{STATUS_CFG[selected.status]?.label}</span>
              </div>
              <div className="p-5 space-y-3 text-sm">
                {[
                  ['Category',    selected.category],
                  ['Site',        selected.site],
                  ['Value',       `₹${selected.value.toLocaleString()}`],
                  ['Condition',   selected.condition],
                  ['Assigned To', selected.assignedTo || '—'],
                  ['Assigned On', selected.assignedOn || '—'],
                  ['Return Due',  selected.returnDue || '—'],
                ].map(([k,v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{k}</span>
                    <span className="text-xs font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
              {selected.status === 'assigned' && (
                <div className="px-5 pb-5">
                  <button onClick={() => markReturn(selected.id)}
                    className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition">
                    Mark as Returned
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
              <Package size={36} className="mx-auto text-gray-300 mb-3"/>
              <p className="text-gray-400 text-sm">Select an asset to view details</p>
            </div>
          )}

          {/* Total portfolio value */}
          <div className="mt-4 bg-gradient-to-br from-red-700 to-red-800 rounded-xl p-4 text-white">
            <div className="text-xs font-medium opacity-75 mb-1">Total Asset Value</div>
            <div className="text-2xl font-black">₹{(totalValue/100000).toFixed(1)}L</div>
            <div className="text-xs opacity-60 mt-0.5">Across {assets.length} tracked assets</div>
          </div>
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Asset</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Asset Name</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {ASSET_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {['New','Good','Fair','Needs Service','Damaged'].map(c=><option key={c}>{c}</option>)}
                  </select></div>
              </div>
              {[['Serial / Asset No.','serial'],['Value (₹)','value'],['Site / Location','site'],['Assign To (optional)','assignedTo']].map(([l,k]) => (
                <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    type={k==='value'?'number':'text'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/></div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNew(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={submitAsset} disabled={!form.name||!form.serial} className="flex-1 bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">Add Asset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
