import { NextRequest, NextResponse } from 'next/server'

const MOCK_JOBS = [
  { id:'az-001', title:'ELV Engineer', company:'Siemens India', location:'Mumbai', salary_min:600000, salary_max:900000, description:'Looking for an experienced ELV engineer with BMS, CCTV and access control expertise.', created:'2026-04-20', source:'Adzuna' },
  { id:'az-002', title:'Site Supervisor', company:'Honeywell', location:'Bengaluru', salary_min:700000, salary_max:1100000, description:'Site supervisor for large ELV and structured cabling projects.', created:'2026-04-19', source:'Adzuna' },
  { id:'az-003', title:'HR Business Partner', company:'JLL India', location:'Delhi', salary_min:900000, salary_max:1400000, description:'HRBP for a 500+ employee workforce across multiple sites.', created:'2026-04-18', source:'Adzuna' },
  { id:'az-004', title:'Project Manager – ELV', company:'Johnson Controls', location:'Pune', salary_min:1200000, salary_max:1800000, description:'End-to-end project management for ELV installation projects.', created:'2026-04-17', source:'Adzuna' },
  { id:'az-005', title:'Data Analyst – HR', company:'Infosys BPM', location:'Hyderabad', salary_min:500000, salary_max:750000, description:'HR data analyst with Power BI and SQL skills for workforce analytics.', created:'2026-04-16', source:'Adzuna' },
]

const MOCK_SALARY = {
  'ELV Engineer':     { min: 550000, max: 950000, avg: 720000, currency: '₹' },
  'Site Supervisor':  { min: 600000, max: 1100000, avg: 830000, currency: '₹' },
  'Project Manager':  { min: 1100000, max: 2000000, avg: 1450000, currency: '₹' },
  'HR Business Partner': { min: 800000, max: 1500000, avg: 1100000, currency: '₹' },
  'Data Analyst':     { min: 450000, max: 800000, avg: 620000, currency: '₹' },
  'Site Engineer':    { min: 400000, max: 750000, avg: 570000, currency: '₹' },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query   = searchParams.get('q') || 'engineer'
  const location = searchParams.get('l') || 'Mumbai'
  const type    = searchParams.get('type') || 'jobs' // 'jobs' or 'salary'

  const appId  = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  // Salary benchmark endpoint
  if (type === 'salary') {
    if (appId && appKey) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/in/histogram?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(query)}&where=${encodeURIComponent(location)}`
        const res = await fetch(url, { next: { revalidate: 3600 } })
        const data = await res.json()
        return NextResponse.json({ source: 'live', data })
      } catch {
        // fall through to mock
      }
    }
    const key = Object.keys(MOCK_SALARY).find(k => query.toLowerCase().includes(k.toLowerCase().split(' ')[0])) || 'Site Engineer'
    return NextResponse.json({ source: 'mock', data: (MOCK_SALARY as any)[key] || MOCK_SALARY['Site Engineer'] })
  }

  // Jobs search endpoint
  if (appId && appKey) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=8&what=${encodeURIComponent(query)}&where=${encodeURIComponent(location)}&content-type=application/json`
      const res = await fetch(url, { next: { revalidate: 300 } })
      const data = await res.json()
      const results = (data.results || []).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company?.display_name || 'Unknown',
        location: j.location?.display_name || location,
        salary_min: j.salary_min || 0,
        salary_max: j.salary_max || 0,
        description: j.description?.substring(0, 200) || '',
        created: j.created?.split('T')[0] || '',
        source: 'Adzuna',
        url: j.redirect_url,
      }))
      return NextResponse.json({ source: 'live', results, count: data.count || results.length })
    } catch {
      // fall through to mock
    }
  }

  // Mock fallback
  const filtered = MOCK_JOBS.filter(j =>
    j.title.toLowerCase().includes(query.toLowerCase()) ||
    j.location.toLowerCase().includes(location.toLowerCase())
  )
  return NextResponse.json({ source: 'mock', results: filtered.length ? filtered : MOCK_JOBS, count: filtered.length || MOCK_JOBS.length })
}
