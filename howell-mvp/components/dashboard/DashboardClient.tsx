'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Metrics } from '@/types'
import { Briefcase, Users, CalendarCheck, TrendingUp, Star, Award } from 'lucide-react'

interface Props { metrics: Metrics }

const STAT_CARDS = (m: Metrics) => [
  { label: 'Active Jobs',          value: m.active_jobs,          icon: Briefcase,     color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { label: 'Total Candidates',     value: m.total_candidates,     icon: Users,         color: 'text-purple-600',  bg: 'bg-purple-50'  },
  { label: 'Interviews Scheduled', value: m.interviews_scheduled, icon: CalendarCheck, color: 'text-amber-600',   bg: 'bg-amber-50'   },
  { label: 'Avg AI Match Score',   value: `${m.avg_match_score}%`,icon: TrendingUp,    color: 'text-green-600',   bg: 'bg-green-50'   },
  { label: 'Shortlisted',          value: m.shortlisted,          icon: Star,          color: 'text-pink-600',    bg: 'bg-pink-50'    },
  { label: 'Offers Made',          value: m.offers_made,          icon: Award,         color: 'text-red-600',     bg: 'bg-red-50'     },
]

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

      {/* Pipeline Chart */}
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

      {/* Pipeline Count Legend */}
      <div className="grid grid-cols-4 gap-3">
        {metrics.pipeline.map(stage => (
          <div key={stage.status} className="bg-white rounded-lg border border-gray-100 p-3 text-center">
            <div className="text-xl font-bold" style={{ color: stage.color }}>{stage.count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stage.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
