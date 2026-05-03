# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build (also type-checks)
npm run lint      # ESLint check
```

No test suite exists. Verify changes by running `npm run build` — TypeScript errors will surface there.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
ANTHROPIC_API_KEY=
TAVUS_API_KEY=           # optional — AI video interviews
ADZUNA_APP_ID=           # optional — job portal sourcing
ADZUNA_APP_KEY=
JSEARCH_API_KEY=
```

## Architecture

**Next.js 14 App Router** with Supabase PostgreSQL. No ORM — all DB access goes through `lib/db.ts`, a typed wrapper around the Supabase service-role client.

### Key conventions

- **Server components** fetch data directly via `lib/db.ts` (no fetch calls). Always export `export const dynamic = 'force-dynamic'` on pages that read live data.
- **API routes** (`app/api/`) use the Supabase service-role client directly via an inline `db()` helper — they don't import `lib/db.ts`.
- **Client components** fetch via API routes, never call Supabase directly.
- **Server actions** (`app/actions/`) are `'use server'` functions called from client components (e.g. `addCandidateAction`). Use these instead of API routes for form submissions where possible.
- Auth is session-based via `@supabase/ssr`. Middleware (`middleware.ts`) protects all routes except `/login` and allowlisted `/api/*` paths. The `isApiInternal` list in middleware must be updated whenever a new public API route is added.

### Data flow for candidate pipeline

```
Job Portal / HR form
  → addCandidateAction (server action)  OR  POST /api/candidates/add
  → candidates table (upsert on email)
  → applications table (status: 'applied')
  → POST /api/screening/evaluate (fire-and-forget)
      → knockout_questions check
      → /api/ai/score-resume (Anthropic)
      → screening_results upsert
      → applications.update (status, ai_match_score)
```

`candidates/page.tsx` splits applications into active pipeline vs rejected, then filters out portal-sourced candidates in 'applied' status (they land in Talent Pool instead, waiting for HR to action them).

### Supabase schema — two SQL files

- `supabase/schema.sql` — core tables: `jobs`, `candidates`, `applications`, `interviews`, `notifications`, `onboarding_records`, `onboarding_tasks`, `hiring_decisions`, `bgv_records`, `bgv_documents`, `sourcing_campaigns`, `sourced_candidates`, `pre_screen_sessions`, `pre_screen_responses`
- `supabase/interview-ai-schema.sql` — AI interview tables: `interview_pipeline_configs`, `interview_rounds`, `ai_interview_sessions`, `interview_auto_queue`, `knockout_questions`, `screening_results`

**Both files must be run in Supabase SQL Editor before AI screening and interview features work.**

### AI integrations

- **Resume scoring** — `POST /api/ai/score-resume` calls Anthropic Claude. Returns `{ score, summary, strengths, gaps, eligibility, auto_reject }`.
- **Interview questions** — `POST /api/interviews/generate-questions` or inline in `start-ai-interview` route.
- **Interview evaluation** — Tavus webhook (`POST /api/interviews/tavus-webhook`) receives transcript, calls Claude to score it, blends interview score (40%) with resume score (60%) to update `ai_match_score`.
- **Mock fallback** — `lib/ai-mock.ts` provides deterministic mock responses when `ANTHROPIC_API_KEY` is absent.

### Screening evaluate — important gotcha

The Supabase JS client never throws on query errors; it returns `{ data: null, error }`. This means even if `screening_results` upsert fails (table missing), execution continues and `applications.update()` still runs. Always check `if (error)` explicitly if you need to gate on DB success.

### `isPipelineEntry` filter

In `app/(dashboard)/candidates/page.tsx`, portal-sourced candidates with `status = 'applied'` are excluded from the Kanban board and shown only in Talent Pool. Direct candidates (`source = 'direct'`) always appear in the pipeline.

### Candidate upsert — safe pattern

The `candidates` upsert uses `onConflict: 'email'`. Only include fields that are actually provided in the payload — spreading null/empty values will overwrite existing valid data.

### Interview routing

`POST /api/interviews/start-ai-interview` — creates an `ai_interview_sessions` record and optionally a Tavus conversation. Falls back to a virtual round if no `interview_pipeline_configs` exists for the job. Updates application status to `interview_scheduled`.

### Hiring decisions

`/hiring-decisions` page reads from `hiring_decisions` table joined with applications/candidates/jobs. AI recommendation (Strong Hire / Consider / Not Recommended) is derived from `ai_score` thresholds (≥75 / 55–74 / <55). HR makes the final Hire/Hold/Reject decision which is stored as `decision`.

### Sidebar navigation

`components/layout/Sidebar.tsx` — grouped nav links. Add new pages here when creating new routes.
