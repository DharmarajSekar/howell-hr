export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import PreScreenClient from '@/components/pre-screen/PreScreenClient'

export default async function PreScreenPage() {
  const [sessions, applications] = await Promise.all([
    db.preScreen.allSessions(),
    db.applications.all(),
  ])
  // Only show applications that don't have a session yet or are shortlisted+
  const eligible = applications.filter((a: any) =>
    ['shortlisted','interview_scheduled','interview_done','screening'].includes(a.status)
  )
  return <PreScreenClient sessions={sessions} applications={eligible} />
}
