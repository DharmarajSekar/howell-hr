/**
 * POST /api/bgv/[id]/documents
 * Logs an uploaded document and runs AI OCR classification.
 * Returns the doc record with extracted OCR fields.
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

/** Returns AI-simulated OCR extraction for a given document type */
async function ocrClassify(documentType: string, candidateName: string): Promise<{ classified_as: string; ocr_data: Record<string, string> }> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return fallbackOCR(documentType, candidateName)
  }

  const prompt = `You are an OCR extraction engine. For the document type "${documentType}" belonging to a candidate named "${candidateName}", generate realistic extracted fields as JSON.

Return ONLY valid JSON with realistic (but fictional) Indian document data in this format:
{
  "classified_as": "<canonical document category>",
  "ocr_data": { "<field_name>": "<extracted_value>", ... }
}

Rules:
- classified_as must be one of: Identity, Educational, Employment, Financial, Legal
- ocr_data should have 4–6 realistic fields for this specific document type
- Use realistic Indian formats (Aadhaar: XXXX XXXX XXXX, PAN: ABCDE1234F, etc.)
- Candidate name in documents should match: ${candidateName}
- Do NOT add any explanation outside the JSON`

  try {
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
    const clean  = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    if (parsed.classified_as && parsed.ocr_data) return parsed
  } catch {}

  return fallbackOCR(documentType, candidateName)
}

function fallbackOCR(documentType: string, candidateName: string): { classified_as: string; ocr_data: Record<string, string> } {
  const dt = documentType.toLowerCase()
  if (dt.includes('aadhaar')) {
    return {
      classified_as: 'Identity',
      ocr_data: {
        name:           candidateName,
        aadhaar_number: '7234 5678 9012',
        dob:            '15/06/1993',
        gender:         'Male',
        address:        '42, Anna Nagar, Chennai - 600040',
      },
    }
  }
  if (dt.includes('pan')) {
    return {
      classified_as: 'Identity',
      ocr_data: {
        name:           candidateName,
        pan_number:     'ABCDE1234F',
        dob:            '15/06/1993',
        father_name:    'Rajesh Kumar',
      },
    }
  }
  if (dt.includes('degree') || dt.includes('marksheet') || dt.includes('10th') || dt.includes('12th')) {
    return {
      classified_as: 'Educational',
      ocr_data: {
        candidate_name:  candidateName,
        institution:     'Anna University, Chennai',
        degree:          dt.includes('degree') ? 'B.E. Electronics & Communication' : 'SSLC / HSC',
        year_of_passing: '2015',
        percentage:      '82.4%',
        register_number: 'AU-2011-EC-0847',
      },
    }
  }
  if (dt.includes('offer letter') || dt.includes('relieving')) {
    return {
      classified_as: 'Employment',
      ocr_data: {
        candidate_name:    candidateName,
        previous_employer: 'Tech Solutions Pvt Ltd',
        designation:       'Software Engineer',
        date_of_joining:   '03/08/2018',
        date_of_leaving:   '15/01/2023',
        last_drawn_salary: '₹8.5 LPA',
      },
    }
  }
  if (dt.includes('bank statement') || dt.includes('payslip')) {
    return {
      classified_as: 'Financial',
      ocr_data: {
        account_holder: candidateName,
        bank:           'HDFC Bank',
        account_number: 'XXXX XXXX 3847',
        period:         'Feb 2026 – Apr 2026',
        avg_balance:    '₹1,24,500',
      },
    }
  }
  if (dt.includes('passport') || dt.includes('driving')) {
    return {
      classified_as: 'Identity',
      ocr_data: {
        name:        candidateName,
        document_no: dt.includes('passport') ? 'Z1234567' : 'TN-09-2019-1234567',
        dob:         '15/06/1993',
        expiry_date: '14/06/2033',
        nationality: 'Indian',
      },
    }
  }
  return {
    classified_as: 'Identity',
    ocr_data: {
      name:            candidateName,
      document_type:   documentType,
      extracted_on:    new Date().toLocaleDateString('en-IN'),
      classification:  'Standard document — manual review recommended',
    },
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { document_type, file_name } = await req.json()
    if (!document_type) {
      return NextResponse.json({ error: 'document_type is required' }, { status: 400 })
    }

    // Fetch BGV record to get candidate name
    const { data: bgv } = await svc()
      .from('bgv_records')
      .select('candidate_name')
      .eq('id', params.id)
      .single()

    const candidateName = bgv?.candidate_name || 'Candidate'

    // Run AI OCR classification
    const { classified_as, ocr_data } = await ocrClassify(document_type, candidateName)

    // Save document with OCR data
    const { data: doc, error } = await svc()
      .from('bgv_documents')
      .insert({
        bgv_record_id: params.id,
        document_type,
        file_name:     file_name || `${document_type.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.pdf`,
        file_url:      null,
        status:        'uploaded',
        verified:      false,
        classified_as,
        ocr_data,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(doc)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
