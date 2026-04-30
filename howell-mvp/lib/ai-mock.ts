/**
 * AI mock — realistic pre-crafted responses so the demo works
 * without any OpenAI API key. Responses are selected intelligently
 * based on keywords in the job title / resume text.
 */

// ── JD Templates keyed by role category ──────────────────────
const JD_TEMPLATES: Record<string, { description: string; requirements: string; niceToHave: string }> = {
  engineer: {
    description: `We are looking for a skilled {title} to join our growing team. In this role, you will lead end-to-end project delivery across installation, commissioning, and handover phases, ensuring all work meets the highest quality and safety standards.

You will collaborate closely with cross-functional teams including project managers, client representatives, and subcontractors. Your technical expertise will be critical in troubleshooting complex site challenges and mentoring junior engineers.

Howell offers a fast-paced environment where engineers can grow rapidly — most Senior Engineers transition to Project Managers within 18–24 months. This is a high-visibility role with significant impact on our flagship projects.`,
    requirements: `• {exp_min}+ years of experience in relevant engineering discipline\n• Proficiency with industry-standard tools and systems\n• Experience managing site teams and coordinating with multiple stakeholders\n• Strong understanding of applicable standards and regulatory requirements\n• Ability to read and interpret technical drawings and specifications\n• Bachelor's degree in Engineering or related discipline\n• Excellent communication and problem-solving skills`,
    niceToHave: `• Relevant professional certification or licence\n• Experience on large-scale infrastructure or government projects\n• PMP or equivalent project management qualification`,
  },
  hr: {
    description: `Howell is looking for an experienced {title} to partner with our leadership teams and drive people strategy across the organisation. You will act as a trusted advisor, balancing the needs of the business with the wellbeing of our workforce.

This is a strategic role with real autonomy — you will own the HR agenda for your assigned business units, from talent acquisition strategy to performance management, engagement, and compliance. You will also play a key role in rolling out Howell's AI-enabled HR platform to internal teams.

If you are passionate about building great places to work and using data to make better people decisions, this role is for you.`,
    requirements: `• {exp_min}+ years of progressive HR experience\n• Strong knowledge of Indian labour law and HR compliance\n• Demonstrated experience with performance management cycles\n• Excellent stakeholder management and influencing skills\n• Proficiency with HRMS tools (SAP, Workday, or equivalent)\n• MBA or PG Diploma in Human Resources`,
    niceToHave: `• SHRM, CIPD, or equivalent HR certification\n• Experience in a high-growth or technology organisation\n• Exposure to people analytics and data-driven HR`,
  },
  analyst: {
    description: `We are hiring a {title} to join our Analytics Centre of Excellence. You will transform raw data into actionable insights that drive business decisions across our operations, finance, and people functions.

Working directly with senior leaders, you will design and maintain dashboards, conduct deep-dive analyses, and build models that predict key business outcomes. This is a high-impact role in a team that is building Howell's data culture from the ground up.

You will have access to rich, varied datasets and the freedom to choose your tools. Results matter here — you will present your findings directly to business leaders.`,
    requirements: `• {exp_min}+ years of experience in data analysis or business intelligence\n• Advanced SQL skills and proficiency in Python or R\n• Experience building production dashboards in Power BI, Tableau, or similar\n• Strong ability to translate data into business recommendations\n• Bachelor's degree in Statistics, Mathematics, Computer Science, or related field\n• Excellent communication skills — written and verbal`,
    niceToHave: `• Experience with machine learning or predictive modelling\n• Domain knowledge in HR analytics, finance, or operations\n• Familiarity with dbt, Airflow, or modern data stack tools`,
  },
  manager: {
    description: `We are seeking a high-calibre {title} to lead a talented team and drive measurable outcomes across our growing operations. This is a leadership role requiring both strategic thinking and hands-on execution.

You will set the direction for your team, manage cross-functional dependencies, and serve as the primary point of contact for senior stakeholders. Expect to operate in a fast-moving environment where decisions are made quickly and ownership is taken seriously.

This role offers significant scope — you will shape not just your team's output but also contribute to building Howell's organisational playbooks and best practices.`,
    requirements: `• {exp_min}+ years of relevant experience, including {exp_min_minus1}+ years in a management or leadership role\n• Demonstrated ability to lead, develop, and retain high-performing teams\n• Strong analytical and commercial thinking\n• Excellent communication and senior stakeholder management skills\n• Track record of delivering results in a complex, matrixed organisation\n• Bachelor's degree from a recognised university; MBA preferred`,
    niceToHave: `• Industry-specific certifications or domain expertise\n• Experience working with global or multi-site teams\n• Familiarity with OKRs or other goal-setting frameworks`,
  },
  default: {
    description: `We are hiring a talented {title} to join our team at Howell. This is an exciting opportunity to work on challenging problems in a company that is growing rapidly across India's infrastructure and technology sectors.

You will bring expertise, energy, and a growth mindset to everything you do — contributing to a team that values ownership, collaboration, and continuous learning. Howell provides the resources and autonomy you need to do your best work.

This role offers a clear path to growth. Most team members at Howell take on expanded responsibilities within 12–18 months of joining.`,
    requirements: `• {exp_min}+ years of relevant experience in your domain\n• Strong technical and functional skills in your area\n• Excellent communication and collaboration skills\n• Ability to manage competing priorities in a fast-paced environment\n• Bachelor's degree in a relevant field\n• A growth mindset and genuine passion for the work`,
    niceToHave: `• Relevant professional certification or advanced degree\n• Experience in a high-growth company or startup environment\n• Domain expertise that goes beyond the core requirements`,
  },
}

function pickTemplate(title: string) {
  const t = title.toLowerCase()
  if (t.includes('engineer') || t.includes('technician') || t.includes('developer') || t.includes('architect')) return JD_TEMPLATES.engineer
  if (t.includes('hr') || t.includes('human resource') || t.includes('talent') || t.includes('people')) return JD_TEMPLATES.hr
  if (t.includes('analyst') || t.includes('data') || t.includes('bi ') || t.includes('insight')) return JD_TEMPLATES.analyst
  if (t.includes('manager') || t.includes('lead') || t.includes('head') || t.includes('director')) return JD_TEMPLATES.manager
  return JD_TEMPLATES.default
}

export async function mockGenerateJD(params: {
  title: string
  department: string
  location: string
  experienceMin: number
  experienceMax: number
  employmentType: string
  salaryMin?: number
  salaryMax?: number
}): Promise<{ description: string; requirements: string; niceToHave: string }> {
  // Small delay so it feels like AI is "thinking"
  await new Promise(r => setTimeout(r, 1200))

  const tpl = pickTemplate(params.title)
  const fill = (s: string) =>
    s.replace(/{title}/g, params.title)
     .replace(/{exp_min}/g, String(params.experienceMin))
     .replace(/{exp_max}/g, String(params.experienceMax))
     .replace(/{exp_min_minus1}/g, String(Math.max(1, params.experienceMin - 1)))
     .replace(/{location}/g, params.location)
     .replace(/{department}/g, params.department)

  return {
    description:  fill(tpl.description),
    requirements: fill(tpl.requirements),
    niceToHave:   fill(tpl.niceToHave),
  }
}

// ── Resume Parse Mock ─────────────────────────────────────────
const MOCK_RESUMES = [
  { full_name: 'Siddharth Rao', email: 'siddharth.rao@email.com', phone: '+91 98001 23456', current_title: 'Senior Software Engineer', current_company: 'Infosys', experience_years: 6, skills: ['Java', 'Spring Boot', 'Microservices', 'AWS', 'SQL', 'Agile'], location: 'Pune', salary_expectation: 18, summary: 'Experienced software engineer with 6 years building scalable backend services at Infosys. Strong Java and cloud background with a passion for clean architecture.' },
  { full_name: 'Meera Iyer', email: 'meera.iyer@email.com', phone: '+91 97654 32109', current_title: 'Product Manager', current_company: 'Swiggy', experience_years: 5, skills: ['Product Strategy', 'Roadmap Planning', 'SQL', 'A/B Testing', 'Stakeholder Management', 'Agile'], location: 'Bengaluru', salary_expectation: 22, summary: 'Product Manager at Swiggy with 5 years driving 0-to-1 product launches. Strong analytical background with SQL and data-driven decision making.' },
  { full_name: 'Karan Malhotra', email: 'karan.malhotra@email.com', phone: '+91 96543 21098', current_title: 'ELV Engineer', current_company: 'Johnson Controls', experience_years: 4, skills: ['CCTV', 'Access Control', 'BMS', 'AutoCAD', 'Honeywell', 'Structured Cabling'], location: 'Mumbai', salary_expectation: 10, summary: 'ELV Engineer at Johnson Controls with 4 years of hands-on experience in CCTV, access control, and building management systems across commercial projects.' },
]

export async function mockParseResume(): Promise<any> {
  await new Promise(r => setTimeout(r, 900))
  // Return a random mock resume each time
  return MOCK_RESUMES[Math.floor(Math.random() * MOCK_RESUMES.length)]
}

// ── AI Interview Question Generator ──────────────────────────
export async function mockGenerateInterviewQuestions(params: {
  jobTitle: string
  jobDescription?: string
  jobRequirements?: string
  candidateName: string
  candidateTitle: string
  candidateExperienceYears: number
  candidateSkills: string[]
  candidateSummary?: string
  roundName: string
  roundNumber: number
}): Promise<string[]> {
  await new Promise(r => setTimeout(r, 800))

  const {
    jobTitle, candidateTitle, candidateExperienceYears,
    candidateSkills, candidateSummary, roundName, roundNumber
  } = params

  const skills    = candidateSkills.slice(0, 4).join(', ')
  const seniorityLabel = candidateExperienceYears >= 8 ? 'senior' : candidateExperienceYears >= 4 ? 'mid-level' : 'junior'
  const t = jobTitle.toLowerCase()

  // Opening question — always personalised
  const opener = `${params.candidateName}, you are currently a ${candidateTitle} with ${candidateExperienceYears} years of experience. Walk me through your journey and what specifically draws you to this ${jobTitle} role at Howell.`

  // Skills deep-dive — pick top 2 skills from their profile
  const topSkill1 = candidateSkills[0] || 'your primary technical skill'
  const topSkill2 = candidateSkills[1] || 'a secondary skill'
  const skillsQ = `Your profile highlights ${topSkill1} and ${topSkill2} as key strengths. Can you describe a specific project where you applied both and what the outcome was?`

  // Experience gap or depth question
  const expQ = candidateExperienceYears < 5
    ? `You have ${candidateExperienceYears} years of experience. Tell me about the most complex challenge you have handled independently so far, and how you approached it.`
    : `With ${candidateExperienceYears} years as a ${seniorityLabel} professional, describe a time you mentored junior team members or led a team through a high-pressure situation.`

  // Role-specific domain questions
  let domainQs: string[] = []

  if (t.includes('engineer') || t.includes('site') || t.includes('elv') || t.includes('mep')) {
    domainQs = [
      `Describe the largest project you have handled in terms of scope and team size. What was your specific contribution and how did you ensure quality delivery?`,
      `How do you typically handle scope creep or sudden client requirement changes mid-project? Give me a real example.`,
      `Walk me through your experience with ${topSkill1}. What is the most technically complex implementation you have done with it?`,
    ]
  } else if (t.includes('hr') || t.includes('human resource') || t.includes('talent') || t.includes('people')) {
    domainQs = [
      `Give me an example of a time you handled a sensitive employee relations issue. How did you balance the employee's interests with the company's?`,
      `How have you used data or HR analytics to influence a key business decision? What metrics did you track?`,
      `Describe your experience with performance management cycles — how do you ensure the process is fair, motivating, and legally compliant?`,
    ]
  } else if (t.includes('analyst') || t.includes('data') || t.includes('bi') || t.includes('insight')) {
    domainQs = [
      `Walk me through a dashboard or analytical model you built from scratch. What business problem did it solve and what tools did you use?`,
      `Describe a time your data analysis led to a counterintuitive finding. How did you present it to stakeholders and what happened next?`,
      `How do you validate the accuracy of your data before presenting insights? Describe your QA process.`,
    ]
  } else if (t.includes('manager') || t.includes('lead') || t.includes('head') || t.includes('director')) {
    domainQs = [
      `Tell me about a time you had to make a difficult people decision — a performance issue, restructuring, or a conflict within your team.`,
      `How do you set goals for your team and ensure accountability without micromanaging?`,
      `Describe the most significant business impact you have delivered in a leadership role. What was your approach and how did you measure success?`,
    ]
  } else {
    domainQs = [
      `Tell me about a project where you had to learn something completely new on the job. How did you approach it and what was the result?`,
      `Describe a situation where you disagreed with your manager or stakeholder. How did you handle it professionally?`,
      `What does your day-to-day work look like currently, and how does this ${jobTitle} role represent a step forward for you?`,
    ]
  }

  // Closing — always round-aware
  const closingQ = roundNumber === 1
    ? `Finally, what are your salary expectations for this role, and what is your earliest possible joining date if selected?`
    : `As you reflect on this interview, what is the one thing about your background that you feel we have not fully explored yet, and that you would want us to know?`

  return [opener, skillsQ, expQ, ...domainQs.slice(0, 3), closingQ]
}

// ── Match Score Mock ──────────────────────────────────────────
export async function mockScoreResume(jobTitle: string, candidateName: string): Promise<{
  score: number; summary: string; strengths: string[]; gaps: string[]
}> {
  await new Promise(r => setTimeout(r, 600))
  // Generate a realistic score (60-88 range — not too perfect, not too low)
  const score = 60 + Math.floor(Math.random() * 28)
  return {
    score,
    summary: `${candidateName} shows a ${score >= 75 ? 'strong' : 'moderate'} match for the ${jobTitle} role. ${score >= 75 ? 'Core skills align well with the requirements and experience level is appropriate.' : 'Some relevant experience present but key requirements are partially met. Recommend screening interview to assess fit.'}`,
    strengths: [
      'Relevant domain experience in the right industry vertical',
      'Communication skills indicated by structured resume presentation',
      score >= 75 ? 'Experience level matches the role seniority requirement' : 'Enthusiasm and growth trajectory evident',
    ],
    gaps: [
      score < 80 ? 'Some specialised technical skills not explicitly mentioned' : 'Minor tool-specific experience to confirm in interview',
      'Reference verification pending — background check recommended',
    ],
  }
}
