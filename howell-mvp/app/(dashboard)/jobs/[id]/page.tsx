import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Clock, Users, ExternalLink } from 'lucide-react'
import { JOB_STATUS_COLORS } from '@/lib/utils'
import ApplicationCard from '@/components/candidates/ApplicationCard'

interface Props { params: { id: string } }

export default async function JobDetailPage({ params }: Props) {
  const [job, applications] = await Promise.all([
    db.jobs.find(params.id),
    db.applications.forJob(params.id),
  ])
  if (!job) notFound()

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <Link href="/jobs" className="text-gray-400 hover:text-gray-700 mt-1"><ArrowLeft size={20}/></Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${JOB_STATUS_COLORS[job.status]}`}>{job.status}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Users size={13}/>{job.department}</span>
              <span className="flex items-center gap-1"><MapPin size={13}/>{job.location}</span>
              <span className="flex items-center gap-1"><Clock size={13}/>{job.experience_min}–{job.experience_max} yrs</span>
            </div>
          </div>
        </div>
        <Link href={`/apply/${job.id}`} target="_blank"
          className="flex items-center gap-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg transition">
          <ExternalLink size={15}/> View Apply Page
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">About This Role</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.description}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Requirements</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.requirements}</p>
          </div>
          {job.nice_to_have && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Nice to Have</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.nice_to_have}</p>
            </div>
          )}
        </div>
        <div className="col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Applications ({applications.length})</h2>
          {applications.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
              <p className="text-gray-400 text-sm">No applications yet.</p>
              <Link href={`/apply/${job.id}`} target="_blank" className="inline-block mt-3 text-sm text-red-700 hover:underline">Share the apply link →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app: any) => <ApplicationCard key={app.id} app={app} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
