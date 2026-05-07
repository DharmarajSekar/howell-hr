'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell, CheckCheck, Trash2, ExternalLink, RefreshCw,
  AlertTriangle, Info, ShieldAlert, Filter
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface SysNotif {
  id:          string
  type:        string
  title:       string
  message:     string
  severity:    'info' | 'warning' | 'critical'
  link:        string | null
  entity_id:   string | null
  entity_type: string | null
  is_read:     boolean
  created_at:  string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const SEVERITY_STYLES = {
  critical: {
    bar:    'bg-red-600',
    badge:  'bg-red-100 text-red-700 border-red-200',
    icon:   <ShieldAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />,
    ring:   'border-l-4 border-l-red-500',
    label:  'Critical',
  },
  warning: {
    bar:    'bg-amber-500',
    badge:  'bg-amber-100 text-amber-700 border-amber-200',
    icon:   <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />,
    ring:   'border-l-4 border-l-amber-400',
    label:  'Warning',
  },
  info: {
    bar:    'bg-blue-500',
    badge:  'bg-blue-50 text-blue-700 border-blue-200',
    icon:   <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />,
    ring:   'border-l-4 border-l-blue-400',
    label:  'Info',
  },
}

type FilterType = 'all' | 'unread' | 'critical' | 'warning' | 'info'

// ── Component ────────────────────────────────────────────────────────────────
export default function SystemNotificationsPage() {
  const [notifs,     setNotifs]     = useState<SysNotif[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<FilterType>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res  = await fetch('/api/system-notifications?limit=100', { cache: 'no-store' })
      const data = await res.json()
      setNotifs(Array.isArray(data) ? data : [])
    } catch { /* non-fatal */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Mark single as read
  async function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await fetch(`/api/system-notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
  }

  // Mark all read
  async function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    await fetch('/api/system-notifications/mark-all-read', { method: 'POST' })
  }

  // Delete single
  async function dismiss(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    await fetch(`/api/system-notifications/${id}`, { method: 'DELETE' })
  }

  // Filtered list
  const displayed = notifs.filter(n => {
    if (filter === 'unread')   return !n.is_read
    if (filter === 'critical') return n.severity === 'critical'
    if (filter === 'warning')  return n.severity === 'warning'
    if (filter === 'info')     return n.severity === 'info'
    return true
  })

  const unreadCount    = notifs.filter(n => !n.is_read).length
  const criticalCount  = notifs.filter(n => n.severity === 'critical' && !n.is_read).length

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell size={20} className="text-red-700" />
            <h1 className="text-2xl font-bold text-gray-900">System Alerts</h1>
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Internal HR alerts — new applications, screening results, BGV flags, offer updates
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <ShieldAlert size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm font-medium text-red-800">
            {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} require immediate attention
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all',      label: `All (${notifs.length})` },
          { key: 'unread',   label: `Unread (${unreadCount})` },
          { key: 'critical', label: 'Critical', color: 'text-red-700' },
          { key: 'warning',  label: 'Warning',  color: 'text-amber-600' },
          { key: 'info',     label: 'Info',     color: 'text-blue-600' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as FilterType)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              filter === f.key
                ? 'bg-gray-900 text-white border-gray-900'
                : `border-gray-200 text-gray-500 hover:bg-gray-50 ${'color' in f ? f.color : ''}`
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Bell size={36} className="mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {filter === 'all' ? 'No alerts yet' : `No ${filter} alerts`}
          </p>
          <p className="text-xs mt-1">
            Alerts appear automatically as the team works
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(notif => {
            const sty = SEVERITY_STYLES[notif.severity] || SEVERITY_STYLES.info
            return (
              <div
                key={notif.id}
                className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition ${
                  notif.is_read ? 'opacity-70' : ''
                } ${sty.ring}`}
              >
                <div className="px-5 py-4 flex items-start gap-3">
                  {/* Severity icon */}
                  {sty.icon}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`text-sm font-semibold text-gray-900 leading-snug ${notif.is_read ? '' : 'font-bold'}`}>
                        {notif.title}
                        {!notif.is_read && (
                          <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full align-middle" />
                        )}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(notif.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{notif.message}</p>

                    {/* Footer row */}
                    <div className="flex items-center gap-3 mt-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${sty.badge}`}>
                        {sty.label}
                      </span>

                      {notif.link && (
                        <Link
                          href={notif.link}
                          onClick={() => markRead(notif.id)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                        >
                          <ExternalLink size={11} />
                          View record
                        </Link>
                      )}

                      {!notif.is_read && (
                        <button
                          onClick={() => markRead(notif.id)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:underline font-medium"
                        >
                          <CheckCheck size={11} />
                          Mark read
                        </button>
                      )}

                      <button
                        onClick={() => dismiss(notif.id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 font-medium ml-auto"
                      >
                        <Trash2 size={11} />
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
