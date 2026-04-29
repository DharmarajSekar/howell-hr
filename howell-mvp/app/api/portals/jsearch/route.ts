import { NextRequest, NextResponse } from 'next/server'

// Simulated candidate profiles — realistic for ELV/HR/infrastructure industry
const MOCK_PROFILES = [
  {
    id: 'js-001', name: 'Rahul Verma', title: 'ELV Engineer', location: 'Mumbai',
    experience: '4 years', skills: ['BMS','CCTV','Access Control','AutoCAD','Honeywell'],
    education: 'B.E. Electronics', source: 'LinkedIn', matchScore: 0,
    summary: '4 years experience in ELV system design, installation and commissioning for commercial projects.',
    email: 'rahul.v@example.com', phone: '+91 98200 11234',
  },
  {
    id: 'js-002', name: 'Meena Pillai', title: 'HR Business Partner', location: 'Bengaluru',
    experience: '6 years', skills: ['HRBP','Workday','Talent Management','SHRM','Analytics'],
    education: 'MBA HR', source: 'Indeed', matchScore: 0,
    summary: 'Senior HRBP with 6 years managing 300+ employee organizations in IT and infrastructure sectors.',
    email: 'meena.p@example.com', phone: '+91 99001 22345',
  },
  {
    id: 'js-003', name: 'Faisal Khan', title: 'Site Engineer', location: 'Dubai, UAE',
    experience: '3 years', skills: ['Structured Cabling','CCTV','Fire Alarm','ELV','MS Project'],
    education: 'B.Tech Civil', source: 'LinkedIn', matchScore: 0,
    summary: 'Site engineer with Middle East experience in ELV and structured cabling for hotel and commercial projects.',
    email: 'faisal.k@example.com', phone: '+971 50 123 4567',
  },
  {
    id: 'js-004', name: 'Anjali Sharma', title: 'Data Analyst', location: 'Hyderabad',
    experience: '2 years', skills: ['SQL','Power BI','Python','Excel','Tableau'],
    education: 'B.Sc Statistics', source: 'Indeed', matchScore: 0,
    summary: 'Junior data analyst specializing in HR and workforce analytics with strong Power BI dashboarding skills.',
    email: 'anjali.s@example.com', phone: '+91 90000 33456',
  },
  {
    id: 'js-005', name: 'Vikram Nair', title: 'Project Manager', location: 'Delhi',
    experience: '8 years', skills: ['PMP','MS Project','ELV','Client Management','Budgeting','Agile'],
    education: 'B.E. + PMP Certified', source: 'LinkedIn', matchScore: 0,
    summary: 'PMP-certified PM with 8 years delivering large-scale ELV and smart building projects across India.',
    email: 'vikram.n@example.com', phone: '+91 98100 44567',
  },
  {
    id: 'js-006', name: 'Sunita Rao', title: 'HR Recruiter', location: 'Pune',
    experience: '3 years', skills: ['Sourcing','LinkedIn Recruiter','ATS','Campus Hiring','HRIS'],
    education: 'MBA HR', source: 'Indeed', matchScore: 0,
    summary: 'Technical recruiter with experience in bulk hiring for EPC and infrastructure companies.',
    email: 'sunita.r@example.com', phone: '+91 87000 55678',
  },
  {
    id: 'js-007', name: 'Hassan Al-Farsi', title: 'ELV Systems Manager', location: 'Abu Dhabi, UAE',
    experience: '10 years', skills: ['ELV','BMS','Lenel','Genetec','BICSI','Leadership','Contract Management'],
    education: 'B.E. Electrical + BICSI RCDD', source: 'LinkedIn', matchScore: 0,
    summary: 'Senior ELV manager overseeing multi-million dollar smart city and hospitality projects in UAE.',
    email: 'hassan.a@example.com', phone: '+971 55 678 9012',
  },
  {
    id: 'js-008', name: 'Preethi Mohan', title: 'Compliance & Training Manager', location: 'Chennai',
    experience: '5 years', skills: ['ISO 45001','POSH','Compliance','LMS','Training Design','L&D'],
    education: 'MBA + ISO Lead Auditor', source: 'Indeed', matchScore: 0,
    summary: 'L&D and compliance specialist with expertise in designing mandatory training programs for infrastructure firms.',
    email: 'preethi.m@example.com', phone: '+91 96000 66789',
  },
]

// AI scoring engine — keyword matching against job requirements
function aiScore(profile: typeof MOCK_PROFILES[0], jobQuery: string): number {
  const queryWords = jobQuery.toLowerCase().split(/\s+/)
  const titleWords = profile.title.toLowerCase().split(/\s+/)
  const allProfileText = [
    profile.title, profile.summary, ...profile.skills, profile.education
  ].join(' ').toLowerCase()

  let score = 0

  // Title match (up to 40 points)
  const titleMatches = queryWords.filter(w => titleWords.some(t => t.includes(w) || w.includes(t)))
  score += Math.min(40, titleMatches.length * 20)

  // Skills match (up to 40 points)
  const skillMatches = queryWords.filter(w => allProfileText.includes(w))
  score += Math.min(40, skillMatches.length * 10)

  // Experience bonus (up to 20 points)
  const expYears = parseInt(profile.experience)
  if (expYears >= 8) score += 20
  else if (expYears >= 5) score += 15
  else if (expYears >= 3) score += 10
  else score += 5

  return Math.min(100, Math.max(5, score))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query    = searchParams.get('query') || 'engineer'
  const location = searchParams.get('location') || ''

  const rapidApiKey = process.env.RAPIDAPI_KEY

  if (rapidApiKey) {
    try {
      const q = location ? `${query} in ${location}` : query
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&num_pages=1&date_posted=month`
      const res = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
        next: { revalidate: 300 }
      })
      const data = await res.json()

      // Map JSearch job listings to candidate-style profiles for display
      const profiles = (data.data || []).slice(0, 8).map((j: any, i: number) => ({
        id: `js-live-${i}`,
        name: `Candidate from ${j.employer_name || 'Portal'}`,
        title: j.job_title || query,
        location: j.job_city || j.job_country || 'Unknown',
        experience: 'Listed on portal',
        skills: (j.job_required_skills || j.job_highlights?.Qualifications || []).slice(0, 5),
        education: 'See original posting',
        source: j.job_publisher || 'JSearch',
        matchScore: Math.floor(Math.random() * 40) + 55,
        summary: (j.job_description || '').substring(0, 200),
        email: 'Available after connection',
        phone: 'Available after connection',
      }))
      return NextResponse.json({ source: 'live', profiles, count: profiles.length })
    } catch {
      // fall through to mock
    }
  }

  // Mock fallback with AI scoring
  const scored = MOCK_PROFILES.map(p => ({
    ...p,
    matchScore: aiScore(p, query),
  })).sort((a, b) => b.matchScore - a.matchScore)

  const filtered = scored.filter(p =>
    !location || p.location.toLowerCase().includes(location.toLowerCase()) || location === ''
  )

  return NextResponse.json({
    source: 'mock',
    profiles: filtered.length >= 3 ? filtered : scored,
    count: filtered.length || scored.length,
  })
}
