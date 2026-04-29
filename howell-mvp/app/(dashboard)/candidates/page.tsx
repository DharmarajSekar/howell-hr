export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import KanbanBoard from '@/components/candidates/KanbanBoard'

export default async function CandidatesPage() {
  const [applications, jobs] = await Promise.all([db.applications.all(), db.jobs.all()])
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Candidate Pipeline</h1>
        <p className="text-gray-500 text-sm mt-1">{applications.length} applications across {jobs.length} roles</p>
      </div>
      <KanbanBoard applications={applications} />
    </div>
  )
}
