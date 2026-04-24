export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import TalentPoolClient from '@/components/talent-pool/TalentPoolClient'

export default async function TalentPoolPage() {
  const [candidates, applications, jobs] = await Promise.all([
    db.candidates.all(),
    db.applications.all(),
    db.jobs.all(),
  ])
  return <TalentPoolClient candidates={candidates} applications={applications} jobs={jobs} />
}
