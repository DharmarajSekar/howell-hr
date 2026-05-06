export interface Job {
  id: string
  title: string
  department: string
  location: string
  employment_type: string
  experience_min: number
  experience_max: number
  salary_min?: number
  salary_max?: number
  status: 'draft' | 'active' | 'paused' | 'closed'
  description: string
  requirements: string
  nice_to_have: string
  created_at: string
  updated_at: string
}

export interface Candidate {
  id: string
  full_name: string
  email: string
  phone: string
  current_title: string
  current_company: string
  experience_years: number
  skills: string[]
  location: string
  salary_expectation: number
  resume_url?: string
  source: string
  summary: string
  created_at: string
}

export interface Application {
  id: string
  job_id: string
  candidate_id: string
  status: string
  ai_match_score?: number
  ai_match_summary?: string
  ai_strengths?: string[]
  ai_gaps?: string[]
  notes?: string
  created_at: string
  updated_at: string
  // joined
  candidate?: Candidate
  job?: Job
}

export interface Interview {
  id: string
  application_id: string
  scheduled_at: string
  duration_minutes: number
  interview_type: 'video' | 'in_person' | 'phone'
  meeting_link?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  feedback?: string
  rating?: number
  created_at: string
  // joined
  application?: Application
}

export interface Notification {
  id: string
  recipient_email: string
  recipient_phone?: string
  recipient_name: string
  channel: 'email' | 'whatsapp' | 'sms'
  subject?: string
  message: string
  status: 'sent' | 'pending' | 'failed'
  sent_at?: string
  created_at: string
}

export interface ActivityItem {
  id: string
  title: string
  subtitle: string
  link: string
  time: string
  badge: string
  badgeColor: string
}

export interface Metrics {
  total_jobs: number
  active_jobs: number
  total_candidates: number
  total_applications: number
  shortlisted: number
  interviews_scheduled: number
  offers_made: number
  hired_this_month: number
  avg_match_score: number
  pipeline: { status: string; label: string; color: string; count: number }[]
  recent_activity: ActivityItem[]
}

export interface DemoUser {
  id: string
  full_name: string
  email: string
  role: string
  department: string
}
