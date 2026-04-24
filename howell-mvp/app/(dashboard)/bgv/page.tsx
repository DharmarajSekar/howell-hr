export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import BGVClient from '@/components/bgv/BGVClient'

export default async function BGVPage() {
  const [bgvRecords, applications] = await Promise.all([
    db.bgv.all(),
    db.applications.all(),
  ])
  const eligible = applications.filter((a: any) =>
    ['offer','hired'].includes(a.status)
  )
  return <BGVClient records={bgvRecords} applications={eligible} />
}
