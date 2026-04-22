import { db } from '@/lib/db'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const metrics = await db.metrics()
  return <DashboardClient metrics={metrics} />
}
