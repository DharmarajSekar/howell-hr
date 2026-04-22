import Link from 'next/link'
import { db } from '@/lib/db'
import { formatDate, JOB_STATUS_COLORS } from '@/lib/utils'
import { Plus, MapPin, Clock, Users } from 'lucide-react'

export default async function JobsPage() {
  const jobs = await db.jobs.all()
  const apps = await db.applications.all()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
          <p className="text-gray-500 text-sm mt-1">{jobs.length} positions · {jobs.filter((j: any) => j.status === 'active').length} active</p>
        </div>
        <Link href="/jobs/new" className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> New Job
        </Link>
      </div>
      <div className="grid gap-4">
        {jobs.map((job: any) => {
          const jobApps = apps.filter((a: any) => a.job_id === job.id)
          return (
            <Link key={job.id} href={`/jobs/${job.id}`} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 hover:shadow-md transition block">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-semibold text-gray-900">{job.title}</h2>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${JOB_STATUS_COLORS[job.status]}`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Users size={13}/>{job.department}</span>
                    <span className="flex items-center gap-1"><MapPin size={13}/>{job.location}</span>
                    <span className="flex items-center gap-1"><Clock size={13}/>{job.experience_min}–{job.experience_max} yrs</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-2xl font-bold text-gray-900">{jobApps.length}</div>
                  <div className="text-xs text-gray-500">applicants</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-3 text-xs text-gray-400">
                <span>{job.employment_type}</span>
                {job.salary_min && job.salary_max && <span>₹{job.salary_min}–{job.salary_max} LPA</span>}
                <span className="ml-auto">Posted {formatDate(job.created_at)}</span>
              </div>
            </Link>
          )
        })}
        {jobs.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-16 text-center">
            <p className="text-gray-400 text-sm">No jobs yet.</p>
            <Link href="/jobs/new" className="inline-block mt-3 text-sm text-red-700 hover:underline">Create your first job →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
