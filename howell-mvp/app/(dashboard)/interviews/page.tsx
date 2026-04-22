'use client'
import { useEffect, useState } from 'react'
import { Calendar, Clock, Video, Users, Star, ChevronDown } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Interview } from '@/types'
import Link from 'next/link'

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    fetch('/api/interviews')
      .then(r => r.json())
      .then(d => { setInterviews(d); setLoading(false) })
  }, [])

  const upcoming  = interviews.filter(iv => iv.status === 'scheduled')
  const completed = interviews.filter(iv => iv.status === 'completed')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
        <p className="text-gray-500 text-sm mt-1">{upcoming.length} upcoming · {completed.length} completed</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading interviews…</div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map(iv => <InterviewCard key={iv.id} interview={iv} />)}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed</h2>
              <div className="space-y-3">
                {completed.map(iv => <InterviewCard key={iv.id} interview={iv} />)}
              </div>
            </section>
          )}

          {interviews.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">No interviews scheduled yet.</div>
          )}
        </div>
      )}
    </div>
  )
}

function InterviewCard({ interview: iv }: { interview: Interview }) {
  const app = iv.application
  const candidate = app?.candidate
  const job = app?.job

  return (
    <div className={`bg-white border rounded-xl shadow-sm p-5 ${iv.status === 'completed' ? 'border-gray-100 opacity-80' : 'border-gray-100'}`}>
      <div className="flex items-start gap-4">
        {/* Type Icon */}
        <div className={`p-2.5 rounded-xl ${iv.interview_type === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
          {iv.interview_type === 'video' ? <Video size={18} /> : <Users size={18} />}
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              {candidate && (
                <Link href={`/candidates/${candidate.id}`}
                  className="font-semibold text-gray-900 text-sm hover:text-red-700">
                  {candidate.full_name}
                </Link>
              )}
              <div className="text-xs text-gray-500 mt-0.5">{job?.title}</div>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              iv.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
              iv.status === 'completed' ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-600'
            }`}>
              {iv.status.charAt(0).toUpperCase() + iv.status.slice(1)}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1"><Calendar size={12} />{formatDateTime(iv.scheduled_at)}</span>
            <span className="flex items-center gap-1"><Clock size={12} />{iv.duration_minutes} min</span>
          </div>

          {iv.meeting_link && iv.status === 'scheduled' && (
            <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-blue-600 hover:underline">
              Join Meeting →
            </a>
          )}

          {iv.feedback && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              {iv.rating && (
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12}
                      className={i < iv.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600">{iv.feedback}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
