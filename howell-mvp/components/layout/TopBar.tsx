'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'

// Map routes to readable page titles
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':             'Dashboard',
  '/sourcing':              'AI Sourcing',
  '/talent-pool':           'Talent Pool',
  '/jobs':                  'Job Postings',
  '/candidates':            'Candidates',
  '/pre-screen':            'Pre-Screen Bot',
  '/pre-screen/recordings': 'Video Recordings',
  '/interviews':            'Interviews',
  '/interview/ai-room':     'AI Interview Room',
  '/hiring-decisions':      'Hire / Hold',
  '/offers':                'Offers',
  '/bgv':                   'BGV & Docs',
  '/onboarding':            'Onboarding',
  '/ess':                   'Self-Service Portal',
  '/attendance':            'Attendance',
  '/assets':                'Asset Management',
  '/grievances':            'Grievances',
  '/training':              'Training',
  '/performance':           'Performance',
  '/retention':             'Retention Risk',
  '/exit':                  'Exit Management',
  '/communications':        'Messages',
  '/notifications':         'Candidate Messages',
  '/system-notifications':  'System Alerts',
  '/integrations':          'Portal Integrations',
  '/settings/interview-config': 'Interview Pipeline Config',
  '/settings/ivr':          'IVR Voice Bot',
}

export default function TopBar() {
  const pathname             = usePathname()
  const [unread, setUnread]  = useState(0)

  // Find the best matching title for current path
  const title = Object.entries(PAGE_TITLES)
    .filter(([route]) => pathname === route || pathname.startsWith(route + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'Howell HR'

  useEffect(() => {
    async function fetchUnread() {
      try {
        const res  = await fetch('/api/system-notifications?unread=true&limit=50', { cache: 'no-store' })
        const data = await res.json()
        setUnread(Array.isArray(data) ? data.length : 0)
      } catch { /* non-fatal */ }
    }
    fetchUnread()
    const id = setInterval(fetchUnread, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="h-14 border-b border-gray-100 bg-white flex items-center justify-between px-6 flex-shrink-0">
      {/* Page title */}
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {/* Bell icon → System Alerts */}
        <Link
          href="/system-notifications"
          className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-800"
          title="System Alerts"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center text-white text-xs font-bold">
          D
        </div>
      </div>
    </header>
  )
}
