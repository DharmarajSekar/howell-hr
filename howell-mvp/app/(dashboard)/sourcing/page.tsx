export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import SourcingClient from '@/components/sourcing/SourcingClient'

export default async function SourcingPage() {
  const [campaigns, jobs] = await Promise.all([
    db.sourcing.allCampaigns(),
    db.jobs.all(),
  ])
  return <SourcingClient campaigns={campaigns} jobs={jobs} />
}
