export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import HiringDecisionsClient from '@/components/hiring/HiringDecisionsClient'

export default async function HiringDecisionsPage() {
  const [decisions, applications] = await Promise.all([
    db.hiringDecisions.all(),
    db.applications.all(),
  ])
  const eligible = applications.filter((a: any) =>
    ['shortlisted','interview_scheduled','interview_done'].includes(a.status)
  )
  return <HiringDecisionsClient decisions={decisions} applications={eligible} />
}
