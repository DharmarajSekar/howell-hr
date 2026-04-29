export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sourcing — list all campaigns
export async function GET() {
  try {
    const campaigns = await db.sourcing.allCampaigns()
    return NextResponse.json(campaigns)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/sourcing — create campaign + simulate AI sourcing
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { job_id, job_title, platforms } = body

    // Create campaign
    const campaign = await db.sourcing.createCampaign({
      job_id,
      job_title,
      platforms: platforms || ['LinkedIn', 'Naukri', 'Indeed'],
      status: 'active',
      total_reached: 0,
      responses: 0,
      interested: 0,
      ai_summary: `AI sourcing campaign launched for ${job_title}. Scanning profiles across ${(platforms || ['LinkedIn','Naukri','Indeed']).join(', ')}.`,
    })

    // Simulate AI finding candidates
    const mockCandidates = generateMockCandidates(job_title, campaign.id)
    for (const c of mockCandidates) {
      await db.sourcing.addSourcedCandidate(c)
    }

    // Update campaign stats
    const interested = mockCandidates.filter((c: any) => c.status === 'interested').length
    await db.sourcing.updateCampaign(campaign.id, {
      total_reached: mockCandidates.length,
      responses: Math.round(mockCandidates.length * 0.6),
      interested,
      ai_summary: `AI sourced ${mockCandidates.length} matching profiles. ${interested} expressed interest. Top matches identified from LinkedIn and Naukri.`,
    })

    const updated = await db.sourcing.findCampaign(campaign.id)
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function generateMockCandidates(jobTitle: string, campaignId: string) {
  const names = [
    'Arjun Sharma','Priya Nair','Rohit Verma','Sneha Patel','Karthik Rajan',
    'Divya Menon','Aditya Singh','Meera Krishnan','Vikram Gupta','Ananya Das',
    'Rahul Joshi','Pooja Iyer','Sanjay Kumar','Lakshmi Reddy','Nikhil Bose',
  ]
  const companies = ['TCS','Infosys','Wipro','HCL','Tech Mahindra','Accenture','Cognizant','Capgemini']
  const platforms = ['LinkedIn','Naukri','Indeed','Referral']
  const statuses = ['reached_out','responded','interested','not_interested','in_process']
  const locations = ['Bangalore','Mumbai','Chennai','Hyderabad','Pune','Delhi','Noida']

  return names.slice(0, 10).map((name, i) => ({
    campaign_id: campaignId,
    full_name: name,
    current_title: jobTitle.includes('Senior') ? 'Senior Developer' : 'Software Developer',
    current_company: companies[i % companies.length],
    experience_years: 2 + (i % 8),
    location: locations[i % locations.length],
    platform: platforms[i % platforms.length],
    match_score: 65 + Math.floor(Math.random() * 30),
    status: statuses[i % statuses.length],
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    phone: `+91 9${String(Math.floor(Math.random() * 1000000000)).padStart(9, '0')}`,
  }))
}
