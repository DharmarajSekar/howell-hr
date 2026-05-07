export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import PreScreenClient from '@/components/pre-screen/PreScreenClient'

export default async function PreScreenPage() {
  const [sessions, applications] = await Promise.all([
    db.preScreen.allSessions(),
    db.applications.all(),
  ])
  // Show all active pipeline candidates so HR can pre-screen at any stage
  const eligible = applications.filter((a: any) =>
    ['applied','shortlisted','interview_scheduled','interview_done','screening'].includes(a.status)
  )
  return <PreScreenClient sessions={sessions} applications={eligible} />
}
