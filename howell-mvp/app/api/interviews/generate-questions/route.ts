/**
 * POST /api/interviews/generate-questions
 *
 * Generates personalised AI interview questions for a candidate
 * based on their profile + the job description.
 *
 * Uses Claude API if ANTHROPIC_API_KEY is set,
 * falls back to intelligent mock generation otherwise.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockGenerateInterviewQuestions } from '@/lib/ai-mock'

export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { applicationId, roundId, roundNumber, roundName } = await req.json()

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
    }

    // ── Fetch candidate + job details ─────────────────────────
    const { data: application } = await db()
      .from('applications')
      .select(`
        *,
        candidate:candidates(full_name, current_title, experience_years, skills, summary, email),
        job:jobs(title, description, requirements, department, experience_min, experience_max)
      `)
      .eq('id', applicationId)
      .single()

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const candidate = application.candidate
    const job       = application.job

    // ── Try Claude API first ──────────────────────────────────
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    let questions: string[] = []

    if (anthropicKey) {
      try {
        const prompt = `You are an expert HR interviewer. Generate exactly 7 personalised interview questions for the following candidate applying for a job.

JOB DETAILS:
- Title: ${job.title}
- Department: ${job.department || 'N/A'}
- Experience Required: ${job.experience_min}–${job.experience_max} years
- Description: ${job.description || 'Not provided'}
- Requirements: ${job.requirements || 'Not provided'}

CANDIDATE PROFILE:
- Name: ${candidate.full_name}
- Current Role: ${candidate.current_title || 'Not specified'}
- Experience: ${candidate.experience_years || 0} years
- Skills: ${(candidate.skills || []).join(', ') || 'Not listed'}
- Summary: ${candidate.summary || 'Not provided'}
- AI Match Score: ${application.ai_match_score || 'Not scored'}
- AI Identified Gaps: ${(application.ai_gaps || []).join(', ') || 'None'}

ROUND: ${roundName || `Round ${roundNumber}`}

INSTRUCTIONS:
1. Start with a personalised opening question addressing ${candidate.full_name} by name, referencing their specific background
2. Ask 2-3 deep technical or functional questions specifically targeting their listed skills (${(candidate.skills || []).slice(0, 3).join(', ')})
3. Ask 1-2 questions that probe the AI-identified gaps: ${(application.ai_gaps || []).join('; ') || 'general fit'}
4. Ask a behavioural question appropriate for their seniority (${candidate.experience_years} years)
5. Close with a forward-looking question about their goals or expectations

Return ONLY a JSON array of 7 question strings. No explanation, no numbering, just the JSON array.
Example format: ["Question 1?", "Question 2?", ...]`

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        const data = await response.json()
        const text = data.content?.[0]?.text || ''

        // Extract JSON array from response
        const match = text.match(/\[[\s\S]*\]/)
        if (match) {
          const parsed = JSON.parse(match[0])
          if (Array.isArray(parsed) && parsed.length > 0) {
            questions = parsed
          }
        }
      } catch (e: any) {
        console.error('Claude API error, falling back to mock:', e.message)
      }
    }

    // ── Fall back to smart mock if no API key or Claude failed ─
    if (questions.length === 0) {
      questions = await mockGenerateInterviewQuestions({
        jobTitle:                  job.title,
        jobDescription:            job.description,
        jobRequirements:           job.requirements,
        candidateName:             candidate.full_name,
        candidateTitle:            candidate.current_title || 'Professional',
        candidateExperienceYears:  candidate.experience_years || 0,
        candidateSkills:           candidate.skills || [],
        candidateSummary:          candidate.summary,
        roundName:                 roundName || `Round ${roundNumber}`,
        roundNumber:               roundNumber || 1,
      })
    }

    return NextResponse.json({
      questions,
      generatedFor: candidate.full_name,
      jobTitle:     job.title,
      isAI:         !!anthropicKey,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
