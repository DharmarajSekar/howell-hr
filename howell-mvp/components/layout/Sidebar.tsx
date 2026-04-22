'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Briefcase, Users, Calendar, Bell, LogOut, ChevronRight, UserCheck
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/jobs',           label: 'Job Postings',   icon: Briefcase },
  { href: '/candidates',     label: 'Candidates',     icon: Users },
  { href: '/interviews',     label: 'Interviews',     icon: Calendar },
  { href: '/onboarding',     label: 'Onboarding',     icon: UserCheck },
  { href: '/notifications',  label: 'Notifications',  icon: Bell },
]

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-700 rounded-lg flex items-center justify-center">
            <span className="font-black text-white">H</span>
          </div>
          <div>
            <div className="font-bold text-sm leading-none">HOWELL</div>
            <div className="text-gray-400 text-xs mt-0.5">HR Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-red-700 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center text-sm font-bold">
            D
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Dharmaraj Sekar</div>
            <div className="text-gray-400 text-xs truncate">HR Admin</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
