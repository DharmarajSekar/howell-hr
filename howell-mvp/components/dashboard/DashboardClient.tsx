'use client'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Metrics } from '@/types'
import { Briefcase, Users, CalendarCheck, TrendingUp, Star, Award, Bell, ChevronRight, Clock } from 'lucide-react'

interface Props { metrics: Metrics }

const STAT_CARDS = (m: Metrics) => [
  { label: 'Active Jobs',          value: m.active_jobs,          icon: Briefcase,     color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { label: 'Total Candidates',     value: m.total_candidates,     icon: Users,         color: 'text-purple-600',  bg: 'bg-purple-50'  },
  { label: 'Interviews Scheduled', value: m.interviews_scheduled, icon: CalendarCheck, color: 'text-amber-600',   bg: 'bg-amber-50'   },
  { label: 'Avg AI Match Score',   value: `${m.avg_match_score}%`,icon: TrendingUp,    color: 'text-green-600',   bg: 'bg-green-50'   },
  { label: 'Shortlisted',          value: m.shortlisted,          icon: Star,          color: 'text-pink-600',    bg: 'bg-pink-50'    },
  { label: 'Offers Made',          value: m.offers_made,          icon: Award,         color: 'text-red-600',     bg: 'bg-red-50'     },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function DashboardClient({ metrics }: Props) {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back, Dharmaraj — here's your hiring overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {STAT_CARDS(metrics).map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`${card.bg} ${card.color} p-3 rounded-xl`}>
              <card.icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-gray-500 text-sm">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Chart + Activity Feed side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Pipeline Chart — 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Recruitment Pipeline</h2>
            <p className="text-sm text-gray-500 mb-6">Candidate distribution across hiring stages</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.pipeline} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                  cursor={{ fill: '#f9fafb' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {metrics.pipeline.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stage count legend */}
          <div className="grid grid-cols-4 gap-3">
            {metrics.pipeline.map(stage => (
              <div key={stage.status} className="bg-white rounded-lg border border-gray-100 p-3 text-center">
                <div className="text-xl font-bold" style={{ color: stage.color }}>{stage.count}</div>
                <div className="text-xs text-gray-500 mt-0.5">{stage.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity / Notifications — 2 cols */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-red-700" />
                <span className="font-semibold text-gray-900 text-sm">Recent Activity</span>
                {metrics.recent_activity.length > 0 && (
                  <span className="ml-1 bg-red-700 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {metrics.recent_activity.length}
                  </span>
                )}
              </div>
              <Link href="/candidates" className="text-xs text-red-700 hover:underline font-medium">
                View all
              </Link>
            </div>

            {/* Activity list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {metrics.recent_activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Bell size={28} className="mb-2 opacity-30" />
                  <p className="text-sm">No activity yet</p>
                  <p className="text-xs mt-1">Events appear as the team works</p>
                </div>
              ) : (
                metrics.recent_activity.map(item => (
                  <Link
                    key={item.id}
                    href={item.link}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-red-700 flex-shrink-0 opacity-80" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                        <span className="flex items-center gap-0.5 text-xs text-gray-400">
                          <Clock size={10} />
                          {timeAgo(item.time)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
