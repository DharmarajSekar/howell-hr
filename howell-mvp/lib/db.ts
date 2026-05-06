/**
 * Cloud database layer — Supabase PostgreSQL
 * All methods are async. Uses service-role key to bypass RLS.
 */
import { createClient } from '@supabase/supabase-js'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        // Disable Next.js fetch cache for all Supabase queries so server
        // components always get fresh data from the database
        fetch: (url: RequestInfo | URL, options: RequestInit = {}) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

export const db = {
  jobs: {
    all: async () => {
      const { data } = await svc().from('jobs').select('*').order('created_at', { ascending: false })
      return data || []
    },
    find: async (id: string) => {
      const { data } = await svc().from('jobs').select('*').eq('id', id).single()
      return data
    },
    create: async (data: any) => {
      const { data: job } = await svc().from('jobs').insert(data).select().single()
      return job
    },
    update: async (id: string, data: any) => {
      const { data: job } = await svc().from('jobs').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      return job
    },
    delete: async (id: string) => {
      await svc().from('jobs').delete().eq('id', id)
    },
  },

  candidates: {
    all: async () => {
      const { data } = await svc().from('candidates').select('*').order('created_at', { ascending: false })
      return data || []
    },
    find: async (id: string) => {
      const { data } = await svc().from('candidates').select('*').eq('id', id).single()
      return data
    },
    findByEmail: async (email: string) => {
      const { data } = await svc().from('candidates').select('*').eq('email', email).single()
      return data
    },
    upsert: async (data: any) => {
      const { data: candidate } = await svc()
        .from('candidates')
        .upsert(data, { onConflict: 'email' })
        .select()
        .single()
      return candidate
    },
  },

  applications: {
    all: async () => {
      const { data } = await svc()
        .from('applications')
        .select('*, candidate:candidates(*), job:jobs(*)')
        .order('created_at', { ascending: false })
      return data || []
    },
    forJob: async (jobId: string) => {
      const { data } = await svc()
        .from('applications')
        .select('*, candidate:candidates(*), job:jobs(*)')
        .eq('job_id', jobId)
        .order('ai_match_score', { ascending: false })
      return data || []
    },
    find: async (id: string) => {
      const { data } = await svc()
        .from('applications')
        .select('*, candidate:candidates(*), job:jobs(*)')
        .eq('id', id)
        .single()
      return data
    },
    create: async (data: any) => {
      const { data: app } = await svc().from('applications').insert(data).select().single()
      return app
    },
    update: async (id: string, data: any) => {
      const { data: app } = await svc()
        .from('applications')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, candidate:candidates(*), job:jobs(*)')
        .single()
      return app
    },
  },

  interviews: {
    all: async () => {
      const { data } = await svc()
        .from('interviews')
        .select('*, application:applications(*, candidate:candidates(*), job:jobs(*))')
        .order('scheduled_at', { ascending: true })
      return data || []
    },
    forApplication: async (appId: string) => {
      const { data } = await svc().from('interviews').select('*').eq('application_id', appId)
      return data || []
    },
    create: async (data: any) => {
      const { data: iv } = await svc().from('interviews').insert({ ...data, status: 'scheduled' }).select().single()
      return iv
    },
    update: async (id: string, data: any) => {
      const { data: iv } = await svc().from('interviews').update(data).eq('id', id).select().single()
      return iv
    },
  },

  notifications: {
    all: async () => {
      const { data } = await svc().from('notifications').select('*').order('created_at', { ascending: false })
      return data || []
    },
    create: async (data: any) => {
      const { data: notif } = await svc().from('notifications').insert(data).select().single()
      return notif
    },
  },

  onboarding: {
    all: async () => {
      const { data } = await svc()
        .from('onboarding_records')
        .select('*, tasks:onboarding_tasks(*)')
        .order('created_at', { ascending: false })
      return (data || []).map((r: any) => ({
        ...r,
        tasks: (r.tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      }))
    },
    find: async (id: string) => {
      const { data } = await svc()
        .from('onboarding_records')
        .select('*, tasks:onboarding_tasks(*)')
        .eq('id', id)
        .single()
      if (!data) return null
      return { ...data, tasks: (data.tasks || []).sort((a: any, b: any) => a.sort_order - b.sort_order) }
    },
    create: async (recordData: any, tasks: any[]) => {
      const { data: record } = await svc().from('onboarding_records').insert(recordData).select().single()
      if (record && tasks.length) {
        await svc().from('onboarding_tasks').insert(
          tasks.map((t, i) => ({ ...t, record_id: record.id, sort_order: i }))
        )
      }
      return db.onboarding.find(record.id)
    },
    updateTask: async (recordId: string, taskId: string, completed: boolean) => {
      await svc().from('onboarding_tasks').update({ completed }).eq('id', taskId)
      return db.onboarding.find(recordId)
    },
  },

  // ─── STAGE 1: AI Talent Sourcing ─────────────────────────────
  sourcing: {
    allCampaigns: async () => {
      const { data } = await svc()
        .from('sourcing_campaigns')
        .select('*, sourced_candidates(*)')
        .order('created_at', { ascending: false })
      return data || []
    },
    findCampaign: async (id: string) => {
      const { data } = await svc()
        .from('sourcing_campaigns')
        .select('*, sourced_candidates(*)')
        .eq('id', id)
        .single()
      return data
    },
    createCampaign: async (data: any) => {
      const { data: campaign } = await svc().from('sourcing_campaigns').insert(data).select().single()
      return campaign
    },
    updateCampaign: async (id: string, data: any) => {
      const { data: campaign } = await svc()
        .from('sourcing_campaigns')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      return campaign
    },
    addSourcedCandidate: async (data: any) => {
      const { data: sc } = await svc().from('sourced_candidates').insert(data).select().single()
      return sc
    },
    updateSourcedCandidate: async (id: string, data: any) => {
      const { data: sc } = await svc().from('sourced_candidates').update(data).eq('id', id).select().single()
      return sc
    },
  },

  // ─── STAGE 4: Pre-Screen Bot ──────────────────────────────────
  preScreen: {
    allSessions: async () => {
      const { data } = await svc()
        .from('pre_screen_sessions')
        .select('*, responses:pre_screen_responses(*)')
        .order('created_at', { ascending: false })
      return (data || []).map((s: any) => ({
        ...s,
        responses: (s.responses || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      }))
    },
    findSession: async (id: string) => {
      const { data } = await svc()
        .from('pre_screen_sessions')
        .select('*, responses:pre_screen_responses(*)')
        .eq('id', id)
        .single()
      if (!data) return null
      return { ...data, responses: (data.responses || []).sort((a: any, b: any) => a.sort_order - b.sort_order) }
    },
    createSession: async (data: any) => {
      const { data: session } = await svc().from('pre_screen_sessions').insert(data).select().single()
      return session
    },
    updateSession: async (id: string, data: any) => {
      const { data: session } = await svc().from('pre_screen_sessions').update(data).eq('id', id).select().single()
      return session
    },
    saveResponses: async (sessionId: string, responses: any[]) => {
      await svc().from('pre_screen_responses').delete().eq('session_id', sessionId)
      if (responses.length) {
        await svc().from('pre_screen_responses').insert(
          responses.map((r, i) => ({ ...r, session_id: sessionId, sort_order: i }))
        )
      }
      return db.preScreen.findSession(sessionId)
    },
  },

  // ─── STAGE 6: Hiring Decisions ────────────────────────────────
  hiringDecisions: {
    all: async () => {
      const { data } = await svc()
        .from('hiring_decisions')
        .select('*, application:applications(*, candidate:candidates(*), job:jobs(*))')
        .order('created_at', { ascending: false })
      return data || []
    },
    find: async (id: string) => {
      const { data } = await svc()
        .from('hiring_decisions')
        .select('*, application:applications(*, candidate:candidates(*), job:jobs(*))')
        .eq('id', id)
        .single()
      return data
    },
    findByApplication: async (appId: string) => {
      const { data } = await svc()
        .from('hiring_decisions')
        .select('*')
        .eq('application_id', appId)
        .single()
      return data
    },
    create: async (data: any) => {
      const { data: hd } = await svc().from('hiring_decisions').insert(data).select().single()
      return hd
    },
    update: async (id: string, data: any) => {
      const { data: hd } = await svc().from('hiring_decisions').update(data).eq('id', id).select().single()
      return hd
    },
  },

  // ─── STAGE 8: BGV & Documentation ────────────────────────────
  bgv: {
    all: async () => {
      const { data } = await svc()
        .from('bgv_records')
        .select('*, documents:bgv_documents(*)')
        .order('created_at', { ascending: false })
      return data || []
    },
    find: async (id: string) => {
      const { data } = await svc()
        .from('bgv_records')
        .select('*, documents:bgv_documents(*)')
        .eq('id', id)
        .single()
      return data
    },
    create: async (data: any) => {
      const { data: record } = await svc().from('bgv_records').insert(data).select().single()
      return record
    },
    update: async (id: string, data: any) => {
      const { data: record } = await svc().from('bgv_records').update(data).eq('id', id).select().single()
      return record
    },
    addDocument: async (data: any) => {
      const { data: doc } = await svc().from('bgv_documents').insert(data).select().single()
      return doc
    },
    updateDocument: async (id: string, data: any) => {
      const { data: doc } = await svc().from('bgv_documents').update(data).eq('id', id).select().single()
      return doc
    },
  },

  metrics: async () => {
    const supabase = svc()
    const [jobsRes, candidatesRes, appsRes, activityRes] = await Promise.all([
      supabase.from('jobs').select('status'),
      supabase.from('candidates').select('id'),
      supabase.from('applications').select('status, ai_match_score'),
      supabase
        .from('applications')
        .select('id, status, ai_match_score, updated_at, candidate:candidates(full_name), job:jobs(id, title)')
        .order('updated_at', { ascending: false })
        .limit(10),
    ])
    const jobs       = jobsRes.data || []
    const candidates = candidatesRes.data || []
    const apps       = appsRes.data || []
    const pipeline = [
      { status: 'applied',             label: 'Applied',     color: '#6b7280', count: 0 },
      { status: 'screening',           label: 'Screening',   color: '#3b82f6', count: 0 },
      { status: 'shortlisted',         label: 'Shortlisted', color: '#8b5cf6', count: 0 },
      { status: 'interview_scheduled', label: 'Interview',   color: '#f59e0b', count: 0 },
      { status: 'interview_done',      label: 'Interviewed', color: '#ec4899', count: 0 },
      { status: 'offer',               label: 'Offer',       color: '#10b981', count: 0 },
      { status: 'hired',               label: 'Hired',       color: '#059669', count: 0 },
    ]
    apps.forEach((a: any) => {
      const s = pipeline.find(p => p.status === a.status)
      if (s) s.count++
    })
    const scored   = apps.filter((a: any) => a.ai_match_score)
    const avgScore = scored.length
      ? Math.round(scored.reduce((s: number, a: any) => s + a.ai_match_score, 0) / scored.length)
      : 0

    // ── Recent Activity feed ─────────────────────────────────────
    const STATUS_META: Record<string, { badge: string; badgeColor: string; title: (n: string, r: string) => string; subtitle: (s?: number) => string }> = {
      applied:             { badge: 'Applied',      badgeColor: 'bg-gray-100 text-gray-600',      title: (n, r) => `${n} applied for ${r}`,           subtitle: () => 'New application received' },
      screening:           { badge: 'Pre-Screen',   badgeColor: 'bg-blue-100 text-blue-700',      title: (n, r) => `${n} — pre-screen complete`,       subtitle: (s) => s ? `AI Match Score: ${s}%` : 'Awaiting AI scoring' },
      shortlisted:         { badge: 'Shortlisted',  badgeColor: 'bg-purple-100 text-purple-700',  title: (n, r) => `${n} shortlisted for ${r}`,        subtitle: () => 'Moved to interview stage' },
      interview_scheduled: { badge: 'Interview',    badgeColor: 'bg-amber-100 text-amber-700',    title: (n, r) => `Interview scheduled — ${n}`,       subtitle: () => 'Calendar invite sent' },
      interview_done:      { badge: 'Interviewed',  badgeColor: 'bg-pink-100 text-pink-700',      title: (n, r) => `Interview completed — ${n}`,       subtitle: () => 'Awaiting hiring decision' },
      offer:               { badge: 'Offer',        badgeColor: 'bg-emerald-100 text-emerald-700',title: (n, r) => `Offer extended to ${n}`,           subtitle: () => 'Pending candidate acceptance' },
      hired:               { badge: 'Hired 🎉',     badgeColor: 'bg-green-100 text-green-700',    title: (n, r) => `${n} hired — onboarding started`,  subtitle: () => 'Welcome email + checklist sent' },
    }
    const recent_activity = (activityRes.data || []).map((a: any) => {
      const meta  = STATUS_META[a.status] || STATUS_META['applied']
      const name  = (a.candidate as any)?.full_name || 'Unknown'
      const role  = (a.job as any)?.title || 'Unknown Role'
      const jobId = (a.job as any)?.id || ''
      return {
        id:         a.id,
        title:      meta.title(name, role),
        subtitle:   meta.subtitle(a.ai_match_score),
        link:       `/candidates/${a.id}`,
        time:       a.updated_at,
        badge:      meta.badge,
        badgeColor: meta.badgeColor,
      }
    })

    return {
      total_jobs:           jobs.length,
      active_jobs:          jobs.filter((j: any) => j.status === 'active').length,
      total_candidates:     candidates.length,
      total_applications:   apps.length,
      shortlisted:          apps.filter((a: any) => ['shortlisted','interview_scheduled','interview_done','offer','hired'].includes(a.status)).length,
      interviews_scheduled: apps.filter((a: any) => a.status === 'interview_scheduled').length,
      offers_made:          apps.filter((a: any) => a.status === 'offer').length,
      hired_this_month:     apps.filter((a: any) => a.status === 'hired').length,
      avg_match_score:      avgScore,
      pipeline,
      recent_activity,
    }
  },
}
