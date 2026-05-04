/**
 * GET /api/offers/[id]/generate-letter
 * Returns a fully-formatted HTML offer letter for the given offer ID.
 * The client renders this in a print-preview modal and uses window.print() / html2pdf.
 *
 * Role-specific terms are injected based on the role field.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function roleSpecificClauses(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('engineer') || r.includes('developer') || r.includes('technical')) {
    return `<p>You will be expected to maintain the highest standards of engineering quality, participate in code/design reviews, and contribute to the team's technical roadmap. You may be required to travel to project sites as per business requirements.</p>`
  }
  if (r.includes('hr') || r.includes('human resource') || r.includes('business partner')) {
    return `<p>In this role, you will be responsible for supporting end-to-end HR operations, talent acquisition, employee relations, and statutory compliance. You are expected to maintain strict confidentiality regarding all personnel matters.</p>`
  }
  if (r.includes('manager') || r.includes('lead')) {
    return `<p>As a people manager, you are responsible for the performance, development, and wellbeing of your direct reports. You will be expected to set clear objectives, conduct regular 1:1s, and deliver team performance reviews on a quarterly basis.</p>`
  }
  if (r.includes('analyst') || r.includes('data')) {
    return `<p>Your primary responsibility will be to analyse business data, generate actionable insights, and deliver accurate reporting to stakeholders. You are expected to maintain data integrity and confidentiality at all times.</p>`
  }
  return `<p>You will be required to perform all duties and responsibilities associated with this role as communicated during the interview process and as directed by your reporting manager from time to time.</p>`
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: offer, error } = await svc()
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    const breakdown = offer.ctc_breakdown || {}
    const totalBreakdown = Object.values(breakdown as Record<string, number>).reduce((a: number, b: any) => a + Number(b), 0)

    const breakdownRows = Object.entries(breakdown as Record<string, number>)
      .map(([key, val]) => {
        const label = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
        const monthly = ((Number(val) * 100000) / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })
        const annual  = (Number(val) * 100000).toLocaleString('en-IN', { maximumFractionDigits: 0 })
        return `<tr><td>${label}</td><td>₹${monthly}/mo</td><td>₹${annual}/yr</td></tr>`
      })
      .join('')

    const joiningDate = offer.joining_date
      ? new Date(offer.joining_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'As mutually agreed'

    const todayDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Offer Letter — ${offer.candidate_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; font-size: 13px; color: #1a1a1a; background: #fff; line-height: 1.7; }
    .page { max-width: 800px; margin: 0 auto; padding: 48px 56px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #b91c1c; padding-bottom: 20px; margin-bottom: 28px; }
    .logo-block h1 { font-size: 22px; font-weight: bold; color: #b91c1c; letter-spacing: 1px; }
    .logo-block p { font-size: 10px; color: #6b7280; margin-top: 2px; }
    .header-right { text-align: right; font-size: 11px; color: #6b7280; }
    .confidential { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 4px; padding: 4px 10px; font-size: 10px; color: #b91c1c; font-weight: bold; letter-spacing: 0.5px; display: inline-block; margin-bottom: 28px; }
    .subject { font-size: 15px; font-weight: bold; color: #111827; margin-bottom: 20px; border-left: 4px solid #b91c1c; padding-left: 12px; }
    p { margin-bottom: 14px; }
    .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #b91c1c; margin: 24px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    table th { background: #1f2937; color: #fff; font-size: 11px; padding: 8px 12px; text-align: left; font-weight: 600; }
    table td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    table tr:last-child td { font-weight: bold; background: #f9fafb; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
    .info-item label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; display: block; }
    .info-item span { font-weight: bold; font-size: 13px; }
    .conditions { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .conditions ul { padding-left: 20px; }
    .conditions li { margin-bottom: 6px; font-size: 12px; }
    .signature-section { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .sig-block { border-top: 1px solid #374151; padding-top: 8px; }
    .sig-block .name { font-weight: bold; font-size: 13px; }
    .sig-block .role { font-size: 11px; color: #6b7280; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
    @media print { body { font-size: 12px; } .page { padding: 32px 40px; } }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-block">
      <h1>HOWELL HR</h1>
      <p>Human Resources Management Platform</p>
      <p style="margin-top:6px;font-size:10px;color:#374151;">Howell Group · Chennai, Tamil Nadu · India 600001</p>
    </div>
    <div class="header-right">
      <div>Date: ${todayDate}</div>
      <div style="margin-top:4px;">Ref: HOW/OFFER/${new Date().getFullYear()}/${offer.id.slice(0, 6).toUpperCase()}</div>
    </div>
  </div>

  <div class="confidential">STRICTLY CONFIDENTIAL</div>

  <!-- Salutation -->
  <p>Dear <strong>${offer.candidate_name}</strong>,</p>

  <div class="subject">Letter of Offer — ${offer.role}</div>

  <p>We are delighted to extend this offer of employment to you for the position of <strong>${offer.role}</strong> in the <strong>${offer.department || 'Engineering'}</strong> department at Howell Group. This offer is made following your successful completion of our selection process and is subject to the terms and conditions outlined below.</p>

  <!-- Position Details -->
  <div class="section-title">Position Details</div>
  <div class="info-grid">
    <div class="info-item"><label>Designation</label><span>${offer.role}</span></div>
    <div class="info-item"><label>Department</label><span>${offer.department || 'Engineering'}</span></div>
    <div class="info-item"><label>Work Location</label><span>${offer.location || 'Chennai, India'}</span></div>
    <div class="info-item"><label>Date of Joining</label><span>${joiningDate}</span></div>
    <div class="info-item"><label>Employment Type</label><span>Full-time, Permanent</span></div>
    <div class="info-item"><label>Reporting To</label><span>Department Head</span></div>
  </div>

  <!-- Compensation -->
  <div class="section-title">Compensation & Benefits</div>
  <p>Your total annual Cost to Company (CTC) will be <strong>₹${(offer.ctc_annual).toLocaleString('en-IN')} Lakhs per annum</strong>, structured as follows:</p>

  <table>
    <thead>
      <tr><th>Component</th><th>Monthly</th><th>Annual</th></tr>
    </thead>
    <tbody>
      ${breakdownRows || `<tr><td>Total CTC</td><td>₹${Math.round(offer.ctc_annual * 100000 / 12).toLocaleString('en-IN')}/mo</td><td>₹${(offer.ctc_annual * 100000).toLocaleString('en-IN')}/yr</td></tr>`}
      <tr><td><strong>Total CTC</strong></td><td><strong>₹${Math.round(offer.ctc_annual * 100000 / 12).toLocaleString('en-IN')}/mo</strong></td><td><strong>₹${(offer.ctc_annual * 100000).toLocaleString('en-IN')}/yr</strong></td></tr>
    </tbody>
  </table>

  <!-- Role-specific clause -->
  <div class="section-title">Role Responsibilities</div>
  ${roleSpecificClauses(offer.role)}

  <!-- Terms & Conditions -->
  <div class="section-title">Terms & Conditions</div>
  <div class="conditions">
    <ul>
      <li>This offer is contingent upon successful completion of background verification, reference checks, and submission of all required documents prior to joining.</li>
      <li>The probationary period for this role is <strong>6 months</strong> from the date of joining, during which performance will be evaluated.</li>
      <li>Notice period during probation: <strong>30 days</strong>. Post-confirmation: <strong>60 days</strong> (or as per company policy in force).</li>
      <li>You will be subject to Howell Group's Code of Conduct, data confidentiality policies, and non-disclosure obligations from the date of joining.</li>
      <li>This offer is valid for <strong>7 days</strong> from the date of issue. Acceptance must be communicated in writing or digitally by signing this letter.</li>
      <li>Howell Group reserves the right to withdraw this offer if any information provided during the recruitment process is found to be inaccurate or misleading.</li>
    </ul>
  </div>

  <p>We look forward to welcoming you to the Howell family. Should you have any questions regarding this offer, please do not hesitate to contact the HR team at <strong>hr@howellgroup.com</strong>.</p>

  <!-- Signatures -->
  <div class="signature-section">
    <div class="sig-block">
      <div style="height:50px;"></div>
      <div class="name">Dharmaraj Sekar</div>
      <div class="role">HR Admin · Howell Group</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">${todayDate}</div>
    </div>
    <div class="sig-block">
      <div style="height:50px; display:flex; align-items:flex-end;">
        <p style="font-size:11px;color:#9ca3af;font-style:italic;">[ Candidate Signature ]</p>
      </div>
      <div class="name">${offer.candidate_name}</div>
      <div class="role">Candidate — Acceptance</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">Date: ____________________</div>
    </div>
  </div>

  <div class="footer">
    This is a computer-generated offer letter. · Howell Group · www.howellgroup.com<br/>
    Offer Ref: HOW/OFFER/${new Date().getFullYear()}/${offer.id.slice(0, 6).toUpperCase()} · Generated: ${todayDate}
  </div>

</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
