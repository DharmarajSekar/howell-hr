export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import KanbanBoard from '@/components/candidates/KanbanBoard'

/**
 * Pipeline logic:
 * - Show ONLY genuine pipeline entries
 * - Self-applied candidates (source != portal_sync) → show at all stages
 * - Portal-sourced candidates → only show once HR has moved them past 'applied'
 *   (i.e., status is shortlisted, screening, interview_scheduled, etc.)
 * - This keeps the pipeline clean from auto-fetched portal profiles
 */
function isPipelineEntry(app: any): boolean {
  const source  = (app.candidate?.source || '').toLowerCase()
  const status  = app.status || ''
  const isPortal = source.includes('portal_sync') || source.includes('portal sync')

  // Portal candidates only appear once HR has actively worked with them
  if (isPortal && status === 'applied') return false

  return true
}

export default async function CandidatesPage() {
  const [allApplications, jobs] = await Promise.all([
    db.applications.all(),
    db.jobs.all(),
  ])

  // Filter to genuine pipeline entries only
  const applications = allApplications.filter(isPipelineEntry)

  const portalPending = allApplications.length - applications.length

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidate Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">
            {applications.length} active application{applications.length !== 1 ? 's' : ''} across {jobs.length} role{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        {portalPending > 0 && (
          <a
            href="/talent-pool"
            className="flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-100 transition"
          >
            <span>🔗</span>
            <span><strong>{portalPending}</strong> portal-sourced profile{portalPending !== 1 ? 's' : ''} awaiting HR review</span>
            <span>→ Talent Pool</span>
          </a>
        )}
      </div>
      <KanbanBoard applications={applications} />
    </div>
  )
}
