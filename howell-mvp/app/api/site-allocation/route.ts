/**
 * POST /api/site-allocation
 * AI-driven site/location allocation for hired candidates.
 * Body: { candidateName, role, skills, preferredLocation, department }
 * Returns: { allocated_site, allocated_city, reason, alternatives[], confidence }
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const HOWELL_SITES = [
  { site: 'Howell HQ',              city: 'Chennai',   type: 'Corporate',     departments: ['HR', 'Finance', 'Leadership', 'Technology'] },
  { site: 'Chennai Tech Park',       city: 'Chennai',   type: 'Tech',          departments: ['Engineering', 'Technology', 'Product'] },
  { site: 'Mumbai Construction Hub', city: 'Mumbai',    type: 'Construction',  departments: ['Site', 'Civil', 'ELV', 'Project Management'] },
  { site: 'Delhi NCR Office',        city: 'Delhi',     type: 'Corporate',     departments: ['Sales', 'BD', 'HR', 'Finance'] },
  { site: 'Bengaluru Tech Centre',   city: 'Bengaluru', type: 'Tech',          departments: ['Engineering', 'Technology', 'Data', 'AI'] },
  { site: 'Hyderabad Operations',    city: 'Hyderabad', type: 'Operations',    departments: ['Operations', 'Procurement', 'Logistics'] },
  { site: 'Pune Engineering Hub',    city: 'Pune',      type: 'Engineering',   departments: ['Civil', 'Mechanical', 'Electrical', 'ELV'] },
]

function fallbackAllocation(role: string, preferredLocation: string) {
  const r = role.toLowerCase()
  const p = (preferredLocation || '').toLowerCase()

  let sites = HOWELL_SITES

  // Filter by preferred location first
  if (p) {
    const preferred = sites.filter(s => s.city.toLowerCase().includes(p))
    if (preferred.length) sites = preferred
  }

  // Match by department/role keywords
  let best = sites[0]
  if (r.includes('engineer') || r.includes('developer') || r.includes('technical')) {
    best = sites.find(s => s.type === 'Tech') || best
  } else if (r.includes('site') || r.includes('civil') || r.includes('construction') || r.includes('elv')) {
    best = sites.find(s => s.type === 'Construction') || sites.find(s => s.type === 'Engineering') || best
  } else if (r.includes('hr') || r.includes('finance') || r.includes('manager')) {
    best = sites.find(s => s.type === 'Corporate') || best
  } else if (r.includes('data') || r.includes('analyst') || r.includes('ai')) {
    best = sites.find(s => s.city === 'Bengaluru') || best
  }

  const alternatives = HOWELL_SITES.filter(s => s.site !== best.site).slice(0, 2)

  return {
    allocated_site:  best.site,
    allocated_city:  best.city,
    confidence:      72,
    reason: `Based on role type (${role}) and ${preferredLocation ? `preferred location (${preferredLocation}), ` : ''}${best.site} is the best match for this candidate's department alignment.`,
    alternatives: alternatives.map(a => ({ site: a.site, city: a.city })),
  }
}

export async function POST(req: NextRequest) {
  try {
    const { candidateName, role, skills = [], preferredLocation, department, applicationId } = await req.json()

    if (!role) return NextResponse.json({ error: 'role is required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(fallbackAllocation(role, preferredLocation || ''))
    }

    const sitesJson = JSON.stringify(HOWELL_SITES, null, 2)

    const prompt = `You are an HR site allocation AI for Howell Group. Assign the best site for a new hire.

Candidate: ${candidateName || 'New Hire'}
Role: ${role}
Department: ${department || 'Not specified'}
Skills: ${skills.length ? skills.join(', ') : 'Not listed'}
Preferred city: ${preferredLocation || 'No preference'}

Available sites:
${sitesJson}

Analyse the role, department, and preferred location. Return ONLY valid JSON — no markdown, no explanation:
{
  "allocated_site": "<site name>",
  "allocated_city": "<city>",
  "confidence": <number 60–98>,
  "reason": "<1–2 sentence explanation of why this site fits>",
  "alternatives": [
    { "site": "<site>", "city": "<city>" },
    { "site": "<site>", "city": "<city>" }
  ]
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 400,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await res.json()
    const raw    = aiData.content?.[0]?.text?.trim() || ''

    try {
      const clean  = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      if (parsed.allocated_site && parsed.allocated_city) {
        // Optionally save to DB
        if (applicationId) {
          await svc()
            .from('applications')
            .update({ allocated_site: parsed.allocated_site, allocated_city: parsed.allocated_city })
            .eq('id', applicationId)
        }
        return NextResponse.json(parsed)
      }
    } catch {}

    return NextResponse.json(fallbackAllocation(role, preferredLocation || ''))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
