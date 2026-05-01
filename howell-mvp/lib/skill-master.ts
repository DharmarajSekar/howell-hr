/**
 * HOWELL HR — Skill Master
 * Static curated skill list categorised by domain.
 * Zero API cost, instant response, works offline.
 * Add/remove skills here as the business grows.
 */

export interface SkillCategory {
  id:       string
  label:    string
  emoji:    string
  color:    string       // tailwind bg + text classes for the badge
  skills:   string[]
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id:    'elv',
    label: 'ELV & Security',
    emoji: '🔒',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    skills: [
      'BMS', 'ELV', 'CCTV', 'Access Control', 'Structured Cabling',
      'Fire Alarm', 'PA System', 'Intercom', 'GRMS', 'IPTV',
      'Video Analytics', 'Lenel', 'Lenel OnGuard', 'Honeywell',
      'Siemens', 'Genetec', 'Milestone', 'HikVision', 'Dahua',
      'Axis', 'Suprema', 'Bosch Security', 'FLIR', 'Pelco',
      'IP CCTV', 'Analogue CCTV', 'Biometric Systems',
      'Turnstiles', 'Bollards', 'Perimeter Security',
    ],
  },
  {
    id:    'mep',
    label: 'MEP & Construction',
    emoji: '⚙️',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    skills: [
      'MEP', 'HVAC', 'Plumbing', 'Fire Fighting', 'Electrical',
      'AutoCAD', 'Revit', 'BIM', 'MS Project', 'Primavera P6',
      'EPC', 'FIDIC', 'Site Supervision', 'QA/QC', 'Commissioning',
      'Handover', 'Snagging', 'BOQ', 'Estimation', 'Tender',
      'Subcontractor Management', 'HSE', 'ISO 9001', 'ISO 14001',
      'Structural Engineering', 'Civil Engineering', 'MEP Coordination',
      'Shop Drawings', 'As-Built Drawings', 'Method Statements',
    ],
  },
  {
    id:    'technology',
    label: 'Technology',
    emoji: '💻',
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    skills: [
      'Python', 'Java', 'JavaScript', 'TypeScript', 'React',
      'Node.js', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
      'REST API', 'GraphQL', 'Git', 'CI/CD', 'Linux',
      'Power BI', 'Tableau', 'Machine Learning', 'Data Analysis',
      'Excel', 'VBA', 'SharePoint', 'Salesforce', 'SAP',
      'Next.js', 'Django', 'Spring Boot', 'Microservices',
      'Agile', 'Scrum', 'Jira', 'Confluence',
    ],
  },
  {
    id:    'hr',
    label: 'HR & People',
    emoji: '👥',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    skills: [
      'HRBP', 'Talent Acquisition', 'Sourcing', 'Headhunting',
      'L&D', 'Training Design', 'Performance Management', 'OKR',
      'HRMS', 'SAP HR', 'Workday', 'SuccessFactors', 'Darwinbox',
      'POSH', 'Labour Law', 'Payroll', 'Onboarding', 'Offboarding',
      'Employee Relations', 'Compensation & Benefits', 'HR Analytics',
      'Employer Branding', 'Engagement Surveys', 'Exit Management',
      'HR Compliance', 'PF & ESI', 'Gratuity', 'ATS', 'LinkedIn Recruiter',
      'Naukri', 'Job Portals', 'Campus Hiring', 'Background Verification',
    ],
  },
  {
    id:    'sales',
    label: 'Sales & Business',
    emoji: '📈',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    skills: [
      'B2B Sales', 'B2C Sales', 'Business Development', 'Account Management',
      'Key Account Management', 'Lead Generation', 'Cold Calling',
      'Tendering', 'Proposals', 'Client Servicing', 'Pre-Sales',
      'Market Research', 'CRM', 'Pipeline Management', 'Revenue Growth',
      'Channel Sales', 'Partner Management', 'Enterprise Sales',
      'Solution Selling', 'Consultative Selling', 'Negotiation',
      'Contract Negotiations', 'RFQ/RFP', 'Sales Forecasting',
    ],
  },
  {
    id:    'management',
    label: 'Management',
    emoji: '🏆',
    color: 'bg-red-100 text-red-700 border-red-200',
    skills: [
      'PMP', 'Project Management', 'Program Management', 'Agile',
      'Scrum', 'Stakeholder Management', 'Risk Management',
      'Budget Management', 'Team Leadership', 'Strategic Planning',
      'Change Management', 'Operations Management', 'P&L Ownership',
      'Cross-functional Coordination', 'Vendor Management',
      'Resource Planning', 'SLA Management', 'KPI Management',
      'Business Analysis', 'Process Improvement', 'Six Sigma', 'Lean',
    ],
  },
  {
    id:    'finance',
    label: 'Finance & Legal',
    emoji: '💰',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    skills: [
      'Financial Modeling', 'Financial Analysis', 'Budgeting', 'Forecasting',
      'SAP FI', 'Tally', 'QuickBooks', 'GST', 'TDS', 'Accounts Payable',
      'Accounts Receivable', 'MIS Reporting', 'Audit', 'Internal Audit',
      'Statutory Compliance', 'Cost Accounting', 'Management Accounting',
      'Contract Management', 'Legal Research', 'Corporate Law',
      'Employment Law', 'Drafting & Vetting', 'Litigation Support',
      'Due Diligence', 'Mergers & Acquisitions',
    ],
  },
]

/**
 * Returns the most relevant category IDs for a given job title.
 * Used to auto-highlight the right category tab when HR types the title.
 */
export function suggestCategoriesForTitle(title: string): string[] {
  const t = title.toLowerCase()

  if (t.includes('elv') || t.includes('cctv') || t.includes('bms') ||
      t.includes('security') || t.includes('access control') || t.includes('fire alarm') ||
      t.includes('structured cabling') || t.includes('surveillance'))
    return ['elv', 'mep']

  if (t.includes('mep') || t.includes('hvac') || t.includes('civil') ||
      t.includes('mechanical') || t.includes('electrical') || t.includes('site') ||
      t.includes('construction') || t.includes('commissioning') || t.includes('epc'))
    return ['mep', 'elv']

  if (t.includes('software') || t.includes('developer') || t.includes('engineer') && (
      t.includes('data') || t.includes('cloud') || t.includes('backend') || t.includes('frontend') ||
      t.includes('full') || t.includes('devops') || t.includes('tech')))
    return ['technology', 'management']

  if (t.includes('data') || t.includes('analyst') || t.includes('bi ') ||
      t.includes('analytics') || t.includes('insight') || t.includes('reporting'))
    return ['technology', 'finance']

  if (t.includes('hr') || t.includes('human resource') || t.includes('talent') ||
      t.includes('people') || t.includes('l&d') || t.includes('learning') ||
      t.includes('recruiter') || t.includes('hrbp'))
    return ['hr', 'management']

  if (t.includes('sales') || t.includes('business development') || t.includes('account') ||
      t.includes('pre-sales') || t.includes('presales') || t.includes('commercial'))
    return ['sales', 'management']

  if (t.includes('manager') || t.includes('director') || t.includes('head') ||
      t.includes('vp') || t.includes('chief') || t.includes('lead') || t.includes('principal'))
    return ['management', 'elv']

  if (t.includes('finance') || t.includes('accounts') || t.includes('audit') ||
      t.includes('tax') || t.includes('legal') || t.includes('compliance') || t.includes('counsel'))
    return ['finance', 'management']

  // Default — show ELV first (Howell's core business)
  return ['elv', 'mep', 'management']
}

/**
 * Quick lookup: all skills as a flat array for search-across-all-categories.
 */
export const ALL_SKILLS: string[] = SKILL_CATEGORIES.flatMap(c => c.skills)

/**
 * Find which category a skill belongs to.
 */
export function getCategoryForSkill(skill: string): SkillCategory | undefined {
  return SKILL_CATEGORIES.find(c =>
    c.skills.some(s => s.toLowerCase() === skill.toLowerCase())
  )
}
