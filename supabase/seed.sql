-- First, seed organizations
INSERT INTO public.organizations (org_id, org_name, org_handle, org_description, org_logo, org_industry, org_location, website)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tech Innovators', 'tech-innovators', 'Leading tech company focused on AI solutions', 'https://example.com/logos/tech_innovators.png', 'Technology', 'San Francisco, CA', 'https://techinnovators.example'),
  ('22222222-2222-2222-2222-222222222222', 'Green Energy Co', 'green-energy', 'Renewable energy solutions provider', 'https://example.com/logos/green_energy.png', 'Energy', 'Austin, TX', 'https://greenenergy.example'),
  ('33333333-3333-3333-3333-333333333333', 'Future Finance', 'future-finance', 'Modern fintech company revolutionizing banking', 'https://example.com/logos/future_finance.png', 'Finance', 'New York, NY', NULL); -- Website is optional

-- Seed departments (assuming some departments for the orgs)
-- Note: We need department_ids for job_info seeding below. Using fixed UUIDs for simplicity in seeding.
INSERT INTO public.departments (department_id, org_id, department_name)
VALUES
  -- Tech Innovators Departments
  ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Engineering'),
  ('d1111111-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Research'),
  -- Green Energy Co Departments
  ('d2222222-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Analysis'),
  ('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Marketing'),
  -- Future Finance Departments
  ('d3333333-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Development');


-- Then seed job listings
INSERT INTO public.job_info (
  job_info_id,
  org_id,
  department_id, -- Added
  job_title, -- Renamed
  job_description, -- Renamed
  location,
  employment_type, -- Added
  salary, -- Renamed
  tags,
  citizenship_requirements, -- Added
  education_level, -- Added
  status, -- Added (default 'draft', explicitly setting some to 'published')
  applicant_count, -- Added back
  comp_specific_label -- Changed to TEXT[]
  -- created_at, updated_at have defaults
)
VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'd1111111-1111-1111-1111-111111111111', -- Engineering Dept ID
    'Senior Software Engineer',
    'We are looking for an experienced software engineer to join our team working on cutting-edge AI solutions.',
    'San Francisco, CA',
    'Full-time',
    '$120,000 - $160,000',
    ARRAY['typescript', 'react', 'node.js', 'ai'],
    ARRAY['Citizen', 'H1B'],
    ARRAY['Bachelors', 'Masters'],
    'published',
    5, -- Example applicant count
    ARRAY['Competitive benefits', 'Equity'] -- Now an array
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    'd2222222-1111-1111-1111-111111111111', -- Analysis Dept ID
    'Renewable Energy Analyst',
    'Join our team of analysts working on sustainable energy solutions.',
    'Remote',
    'Full-time',
    '$90,000 - $110,000',
    ARRAY['renewable', 'analyst', 'remote', 'sustainability'],
    ARRAY['Citizen', 'Green Card'],
    ARRAY['Bachelors'],
    'published',
    12,
    ARRAY['Four-day work week', 'Full benefits']
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '33333333-3333-3333-3333-333333333333',
    'd3333333-1111-1111-1111-111111111111', -- Development Dept ID
    'Full Stack Developer',
    'Looking for a developer to work on our customer-facing financial applications.',
    'New York, NY',
    'Full-time',
    '$130,000 - $170,000',
    ARRAY['javascript', 'python', 'fintech', 'fullstack'],
    ARRAY['Citizen', 'H1B', 'CPT/OPT'],
    ARRAY['Bachelors', 'Masters', 'PhD'],
    'draft', -- Default status
    0,
    ARRAY['Annual bonuses', 'Professional development budget']
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    'd1111111-2222-2222-2222-222222222222', -- Research Dept ID
    'AI Research Scientist',
    '## About the Role
We are seeking a talented AI Research Scientist to push the boundaries of machine learning.
*   Develop novel algorithms
*   Publish research findings
*   Collaborate with engineering teams',
    'Palo Alto, CA',
    'Full-time',
    '$150,000 - $200,000',
    ARRAY['python', 'tensorflow', 'pytorch', 'research', 'ai'],
    ARRAY['Citizen', 'H1B', 'O-1'],
    ARRAY['PhD', 'Masters'],
    'published',
    3,
    ARRAY['Conference travel budget', 'Stock options']
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    '22222222-2222-2222-2222-222222222222',
    'd2222222-2222-2222-2222-222222222222', -- Marketing Dept ID
    'Marketing Manager',
    'Lead our marketing efforts to promote sustainable energy solutions. **Experience required**.',
    'Austin, TX',
    'Contract',
    '$100,000 - $130,000',
    ARRAY['marketing', 'strategy', 'renewable', 'management'],
    ARRAY['Citizen'],
    ARRAY['Bachelors'],
    'draft',
    0,
    ARRAY['Generous PTO', 'Remote work options']
  );