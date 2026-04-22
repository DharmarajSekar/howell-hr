-- ═══════════════════════════════════════════════════════════════
--  HOWELL HR — Demo Seed Data
--  Run AFTER schema.sql in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── Jobs ─────────────────────────────────────────────────────
INSERT INTO jobs (id, title, department, location, employment_type, experience_min, experience_max, salary_min, salary_max, status, description, requirements, nice_to_have) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Senior Site Engineer',
  'Engineering',
  'Mumbai',
  'Full-time',
  5, 9, 12, 18,
  'active',
  'We are looking for a skilled Senior Site Engineer to join our growing team. You will lead end-to-end project delivery across installation, commissioning, and handover phases, ensuring all work meets the highest quality and safety standards.

You will collaborate closely with cross-functional teams including project managers, client representatives, and subcontractors. Your technical expertise will be critical in troubleshooting complex site challenges and mentoring junior engineers.

Howell offers a fast-paced environment where engineers can grow rapidly — most Senior Engineers transition to Project Managers within 18–24 months.',
  '• 5+ years of experience in ELV, MEP, or Civil engineering
• Experience managing site teams and coordinating with multiple stakeholders
• Strong understanding of applicable standards and regulatory requirements
• Ability to read and interpret technical drawings and specifications
• Bachelor''s degree in Engineering or related discipline',
  '• Relevant professional certification or licence
• Experience on large-scale infrastructure or government projects
• PMP or equivalent project management qualification'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'HR Business Partner',
  'HR',
  'Bengaluru',
  'Full-time',
  5, 10, 15, 25,
  'active',
  'Howell is looking for an experienced HR Business Partner to partner with our leadership teams and drive people strategy across the organisation. You will act as a trusted advisor, balancing the needs of the business with the wellbeing of our workforce.

This is a strategic role with real autonomy — you will own the HR agenda for your assigned business units, from talent acquisition strategy to performance management, engagement, and compliance.',
  '• 5+ years of progressive HR experience
• Strong knowledge of Indian labour law and HR compliance
• Demonstrated experience with performance management cycles
• Proficiency with HRMS tools (SAP, Workday, or equivalent)
• MBA or PG Diploma in Human Resources',
  '• SHRM, CIPD, or equivalent HR certification
• Experience in a high-growth or technology organisation
• Exposure to people analytics and data-driven HR'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Data Analyst — HR Analytics',
  'Analytics',
  'Hyderabad',
  'Full-time',
  2, 5, 8, 14,
  'active',
  'We are hiring a Data Analyst to join our Analytics Centre of Excellence. You will transform raw data into actionable insights that drive business decisions across our HR, operations, and finance functions.

Working directly with senior leaders, you will design and maintain dashboards, conduct deep-dive analyses, and build models that predict key business outcomes.',
  '• 2+ years of experience in data analysis or business intelligence
• Advanced SQL skills and proficiency in Python or R
• Experience building dashboards in Power BI, Tableau, or similar
• Bachelor''s degree in Statistics, Mathematics, Computer Science, or related field',
  '• Experience with machine learning or predictive modelling
• Domain knowledge in HR analytics
• Familiarity with dbt, Airflow, or modern data stack tools'
);

-- ── Candidates ───────────────────────────────────────────────
INSERT INTO candidates (id, full_name, email, phone, current_title, current_company, experience_years, skills, location, salary_expectation, source, summary) VALUES
('b1000001-0000-0000-0000-000000000001','Rohit Sharma','rohit.sharma@email.com','+91 98123 45678','Senior ELV Engineer','Siemens',7,ARRAY['CCTV','Access Control','BMS','AutoCAD','Honeywell','Lenel'],'Mumbai',16,'linkedin','7 years ELV experience at Siemens across 15+ commercial and data centre projects.'),
('b1000001-0000-0000-0000-000000000002','Priya Nair','priya.nair@email.com','+91 97654 32100','HR Manager','Tata Consultancy Services',8,ARRAY['Talent Acquisition','Performance Management','Workday','Labour Law','HRBP'],'Bengaluru',22,'referral','Senior HR professional with 8 years at TCS. Expert in talent management and HR transformation.'),
('b1000001-0000-0000-0000-000000000003','Karan Malhotra','karan.malhotra@email.com','+91 96543 21098','ELV Engineer','Johnson Controls',4,ARRAY['CCTV','Access Control','BMS','AutoCAD','Structured Cabling'],'Mumbai',10,'apply_link','ELV Engineer at Johnson Controls with 4 years of experience in CCTV, access control, and BMS.'),
('b1000001-0000-0000-0000-000000000004','Sneha Krishnan','sneha.krishnan@email.com','+91 95432 10987','Business Analyst','Infosys',3,ARRAY['SQL','Python','Power BI','Excel','Data Modelling'],'Hyderabad',11,'linkedin','Analytical professional with 3 years in BI and data analytics. Strong SQL and Python background.'),
('b1000001-0000-0000-0000-000000000005','Arjun Mehta','arjun.mehta@email.com','+91 94321 09876','Site Engineer','L&T',5,ARRAY['Project Management','AutoCAD','MS Project','Safety','ELV'],'Mumbai',13,'naukri','Site Engineer with 5 years at L&T managing large-scale infrastructure projects.'),
('b1000001-0000-0000-0000-000000000006','Amit Singh','amit.singh@email.com','+91 97654 32109','Senior HR Business Partner','Wipro',9,ARRAY['HRBP','Talent Management','Workday','OD','Engagement','Labour Law'],'Bengaluru',23,'referral','9 years progressive HR experience including 4 years as HRBP at Wipro. Strong in talent strategy.'),
('b1000001-0000-0000-0000-000000000007','Neha Gupta','neha.gupta@email.com','+91 92109 87654','ELV Project Manager','Honeywell',8,ARRAY['Project Management','ELV','PMP','MS Project','Client Management','BMS'],'Delhi',20,'linkedin','ELV Project Manager at Honeywell managing ₹50Cr+ projects with 8 years experience.'),
('b1000001-0000-0000-0000-000000000008','Ravi Kumar','ravi.kumar@email.com','+91 91098 76543','HR Analyst','Accenture',4,ARRAY['HR Analytics','Power BI','Python','Workday','Compensation'],'Bengaluru',14,'naukri','HR Analyst with 4 years at Accenture specialising in people analytics and compensation benchmarking.'),
('b1000001-0000-0000-0000-000000000009','Siddharth Rao','siddharth.rao@email.com','+91 98001 23456','Senior Software Engineer','Infosys',6,ARRAY['Java','Spring Boot','Microservices','AWS','SQL'],'Pune',18,'apply_link','Backend engineer with 6 years at Infosys. Strong Java and cloud architecture background.'),
('b1000001-0000-0000-0000-000000000010','Meera Iyer','meera.iyer@email.com','+91 97654 32100','Product Manager','Swiggy',5,ARRAY['Product Strategy','SQL','A/B Testing','Roadmap','Agile'],'Bengaluru',22,'linkedin','PM at Swiggy with 5 years driving 0-to-1 launches. Data-driven decision making background.');

-- ── Applications ─────────────────────────────────────────────
INSERT INTO applications (id, job_id, candidate_id, status, ai_match_score, ai_match_summary, ai_strengths, ai_gaps) VALUES
('c1000001-0000-0000-0000-000000000001','a1b2c3d4-0001-0001-0001-000000000001','b1000001-0000-0000-0000-000000000001','shortlisted',88,'Rohit is an excellent match. His 7 years at Siemens directly mirrors the role requirements with deep ELV expertise.',ARRAY['7 years ELV experience at Siemens — exact domain match','Proven on large commercial and data centre projects','Advanced toolset: Honeywell, Lenel, AutoCAD'],ARRAY['PMP certification not confirmed','Reference verification pending']),
('c1000001-0000-0000-0000-000000000002','a1b2c3d4-0002-0002-0002-000000000002','b1000001-0000-0000-0000-000000000002','interview_scheduled',82,'Priya brings strong HR generalist experience from TCS. Talent management depth is well-aligned.',ARRAY['8 years at TCS with HRBP exposure','Workday proficiency confirmed','Strong in performance management cycles'],ARRAY['Labour law depth to verify in interview','MBA details not listed']),
('c1000001-0000-0000-0000-000000000003','a1b2c3d4-0001-0001-0001-000000000001','b1000001-0000-0000-0000-000000000003','applied',72,'Karan meets core requirements with relevant Johnson Controls experience, slightly below seniority level.',ARRAY['Relevant ELV project experience','Good tool exposure: CCTV, BMS, AutoCAD'],ARRAY['4 years experience — below 5-year minimum','No mention of team management']),
('c1000001-0000-0000-0000-000000000004','a1b2c3d4-0003-0003-0003-000000000003','b1000001-0000-0000-0000-000000000004','screening',75,'Sneha has solid BI foundations. SQL and Python match well, Power BI dashboard experience is a plus.',ARRAY['Power BI and SQL skills directly match requirements','Python proficiency confirmed','Analytical background from Infosys'],ARRAY['3 years total experience — at lower bound','No HR analytics domain experience mentioned']),
('c1000001-0000-0000-0000-000000000005','a1b2c3d4-0001-0001-0001-000000000001','b1000001-0000-0000-0000-000000000005','screening',68,'Arjun''s L&T background is relevant. 5 years experience matches, though ELV specialisation needs verification.',ARRAY['5 years at L&T — meets experience threshold','Project management experience','Safety and site management background'],ARRAY['ELV specialisation unclear — primarily civil/MEP','No BMS tool experience listed']),
('c1000001-0000-0000-0000-000000000006','a1b2c3d4-0002-0002-0002-000000000002','b1000001-0000-0000-0000-000000000006','interview_done',94,'Amit is the strongest match for the HRBP role. 9 years experience with deep expertise in talent strategy.',ARRAY['9 years progressive HR with 4 years as HRBP','Workday expert — exact system requirement','Strong in OD, engagement, and labour law'],ARRAY['Current CTC above stated range — negotiation needed']),
('c1000001-0000-0000-0000-000000000007','a1b2c3d4-0001-0001-0001-000000000001','b1000001-0000-0000-0000-000000000007','offer',91,'Neha''s ELV Project Manager profile is outstanding. 8 years at Honeywell managing ₹50Cr+ projects.',ARRAY['8 years ELV experience at Honeywell — premium match','PMP certified','Proven on large-value projects'],ARRAY['Role is Senior Engineer, not PM — check scope alignment']),
('c1000001-0000-0000-0000-000000000008','a1b2c3d4-0003-0003-0003-000000000003','b1000001-0000-0000-0000-000000000008','shortlisted',79,'Ravi''s HR analytics specialisation at Accenture is well-aligned. People analytics is a direct fit.',ARRAY['HR analytics domain experience — unique strength','Power BI and Workday combination','Compensation analytics background'],ARRAY['Python skills depth unclear','4 years experience at lower bound for some projects']),
('c1000001-0000-0000-0000-000000000009','a1b2c3d4-0001-0001-0001-000000000001','b1000001-0000-0000-0000-000000000009','applied',52,'Siddharth is a software engineer — limited ELV relevance. Recommend redirecting to a tech-focused role.',ARRAY['Strong analytical and problem-solving skills','Cloud and microservices — transferable to smart building tech'],ARRAY['No ELV or site engineering experience','Domain mismatch — software vs infrastructure']),
('c1000001-0000-0000-0000-000000000010','a1b2c3d4-0002-0002-0002-000000000002','b1000001-0000-0000-0000-000000000010','applied',58,'Meera''s PM background has some overlap with HRBP — stakeholder management and analytics transferable.',ARRAY['Strong stakeholder management skills','Data-driven mindset aligns with analytics requirement'],ARRAY['No HR functional experience','HRBP role requires labour law knowledge not evident']);

-- ── Interviews ───────────────────────────────────────────────
INSERT INTO interviews (application_id, scheduled_at, duration_minutes, interview_type, meeting_link, status, feedback, rating) VALUES
('c1000001-0000-0000-0000-000000000002','2026-04-24 10:00:00+00',60,'video','https://meet.google.com/abc-defg-hij','scheduled',NULL,NULL),
('c1000001-0000-0000-0000-000000000006','2026-04-21 11:00:00+00',60,'in_person',NULL,'completed','Amit demonstrated exceptional depth in Workday and talent management. Cultural fit is strong. Recommend moving to offer stage immediately.',5);

-- ── Notifications ────────────────────────────────────────────
INSERT INTO notifications (recipient_name, recipient_email, recipient_phone, channel, subject, message, status, sent_at) VALUES
('Rohit Sharma','rohit.sharma@email.com','+91 98123 45678','whatsapp',NULL,'Hi Rohit,

Congratulations! You''ve been shortlisted for the *Senior Site Engineer* position at Howell.

Your interview is scheduled for 24th April 2026 at 10:00 AM via Google Meet.

Join here: https://meet.google.com/abc-defg-hij

Please confirm your attendance.

Best regards,
Howell HR Team','sent','2026-04-20 10:10:00+00'),
('Amit Singh','amit.singh@email.com','+91 97654 32109','email','Interview Confirmation — HR Business Partner | Howell','Hi Amit,

Thank you for your time today. We were very impressed with your background and would like to move forward.

Please expect your offer letter within 2 business days.

Best regards,
Howell HR Team','sent','2026-04-21 12:00:00+00'),
('Neha Gupta','neha.gupta@email.com','+91 92109 87654','email','Offer Letter — Senior Site Engineer | Howell','Hi Neha,

We are thrilled to extend an offer for the Senior Site Engineer position at Howell!

Offer details:
• Role: Senior Site Engineer
• CTC: ₹18 LPA
• Start Date: 5th May 2026

Please review and accept your offer letter in the HR portal.

Welcome to the Howell family!

Best regards,
Howell HR Team','sent','2026-04-21 14:05:00+00');

-- ── Onboarding ───────────────────────────────────────────────
INSERT INTO onboarding_records (id, candidate_id, job_id, candidate_name, job_title, joining_date, status) VALUES
('d1000001-0000-0000-0000-000000000001','b1000001-0000-0000-0000-000000000006','a1b2c3d4-0002-0002-0002-000000000002','Amit Singh','HR Business Partner','2026-05-05','in_progress');

INSERT INTO onboarding_tasks (record_id, category, title, completed, sort_order) VALUES
('d1000001-0000-0000-0000-000000000001','Documents','Submit signed offer letter',TRUE,0),
('d1000001-0000-0000-0000-000000000001','Documents','Submit educational certificates',TRUE,1),
('d1000001-0000-0000-0000-000000000001','Documents','Submit previous employment letters',FALSE,2),
('d1000001-0000-0000-0000-000000000001','Documents','Submit PAN card & Aadhaar copy',TRUE,3),
('d1000001-0000-0000-0000-000000000001','Documents','Submit 3-month bank statement',FALSE,4),
('d1000001-0000-0000-0000-000000000001','IT Setup','Laptop provisioned',TRUE,5),
('d1000001-0000-0000-0000-000000000001','IT Setup','Corporate email account created',FALSE,6),
('d1000001-0000-0000-0000-000000000001','IT Setup','Access to HR systems granted',FALSE,7),
('d1000001-0000-0000-0000-000000000001','Induction','Orientation session scheduled',FALSE,8),
('d1000001-0000-0000-0000-000000000001','Induction','Meet the team — intro call',FALSE,9),
('d1000001-0000-0000-0000-000000000001','Induction','Company handbook & policies shared',TRUE,10),
('d1000001-0000-0000-0000-000000000001','Day 1 Kit','Welcome kit dispatched',TRUE,11),
('d1000001-0000-0000-0000-000000000001','Day 1 Kit','Buddy assigned',FALSE,12);

-- ── Demo User (run this LAST) ────────────────────────────────
-- NOTE: Create this user in Supabase Dashboard → Authentication → Users
-- Email: demo@howell.com | Password: demo1234
-- This SQL just confirms the data. The user must be created via the Dashboard.
