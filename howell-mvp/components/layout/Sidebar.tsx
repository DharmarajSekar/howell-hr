'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Briefcase, Users, Calendar, Bell, LogOut,
  UserCheck, Globe, Bot, BarChart2, ShieldCheck, ChevronDown,
  ChevronRight, Database, MessageSquare, Gift, Star, ClipboardList,
  TrendingDown, DoorOpen, Package, BookOpen, Home, AlertCircle,
  UserCog, Activity, Link2, Video, Settings2, Phone
} from 'lucide-react'

const SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    label: 'Recruitment',
    items: [
      { href: '/sourcing',                label: 'AI Sourcing',         icon: Globe,         badge: '' },
      { href: '/talent-pool',             label: 'Talent Pool',         icon: Database,      badge: '' },
      { href: '/jobs',                    label: 'Job Postings',        icon: Briefcase },
      { href: '/candidates',              label: 'Candidates',          icon: Users },
      { href: '/pre-screen',              label: 'Pre-Screen Bot',      icon: Bot },
      { href: '/pre-screen/recordings',   label: 'Video Recordings',    icon: Video,         badge: 'NEW' },
      { href: '/interviews',              label: 'Interviews',          icon: Calendar },
      { href: '/interview/ai-room',       label: 'AI Interview Room',   icon: Video,         badge: '' },
      { href: '/hiring-decisions',        label: 'Hire / Hold',         icon: BarChart2 },
    ]
  },
  {
    label: 'Offer & Joining',
    items: [
      { href: '/offers',      label: 'Offers',        icon: Gift },
      { href: '/bgv',         label: 'BGV & Docs',    icon: ShieldCheck },
      { href: '/onboarding',  label: 'Onboarding',    icon: UserCheck },
    ]
  },
  {
    label: 'Employee',
    items: [
      { href: '/ess',            label: 'Self-Service',    icon: UserCog },
      { href: '/attendance',     label: 'Attendance',      icon: Activity },
      { href: '/assets',         label: 'Assets',          icon: Package },
    ]
  },
  {
    label: 'Engagement',
    items: [
      { href: '/grievances',   label: 'Grievances',    icon: AlertCircle },
      { href: '/training',     label: 'Training',      icon: BookOpen },
      { href: '/performance',  label: 'Performance',   icon: Star },
      { href: '/retention',    label: 'Retention Risk',icon: TrendingDown },
      { href: '/exit',         label: 'Exit',          icon: DoorOpen },
    ]
  },
  {
    label: 'Communication',
    items: [
      { href: '/communications', label: 'Messages',      icon: MessageSquare },
      { href: '/notifications',  label: 'Notifications', icon: Bell },
    ]
  },
  {
    label: 'Settings',
    items: [
      { href: '/integrations',              label: 'Portal Integrations',  icon: Link2,     badge: '' },
      { href: '/settings/interview-config', label: 'Interview Pipeline',   icon: Settings2, badge: '' },
      { href: '/settings/ivr',              label: 'IVR Voice Bot',        icon: Phone,     badge: 'NEW' },
    ]
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function toggleSection(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="font-black text-white text-sm">H</span>
          </div>
          <div>
            <div className="font-bold text-sm leading-none">HOWELL</div>
            <div className="text-gray-400 text-xs mt-0.5">AI-Enabled HR Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {SECTIONS.map(section => {
          const isCollapsed = collapsed[section.label]
          const hasActive   = section.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))

          return (
            <div key={section.label} className="mb-1">
              {section.label !== 'Overview' && (
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition"
                >
                  {section.label}
                  {isCollapsed ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
                </button>
              )}

              {!isCollapsed && (
                <div className="space-y-0.5 px-2">
                  {section.items.map(item => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          active
                            ? 'bg-red-700 text-white'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        )}
                      >
                        <item.icon size={16} className="flex-shrink-0"/>
                        <span className="flex-1 truncate">{item.label}</span>
                        {(item as any).badge === '' && !active && (
                          <span className="text-xs bg-red-900 text-red-300 px-1 py-0.5 rounded text-[10px] font-bold">AI</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">D</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">Dharmaraj Sekar</div>
            <div className="text-gray-500 text-xs truncate">HR Admin</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition">
          <LogOut size={14}/> Sign out
        </button>
      </div>
    </aside>
  )
}
