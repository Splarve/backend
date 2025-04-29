-- First, seed organizations
INSERT INTO public.organizations (org_id, org_name, org_description, org_logo)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Tech Innovators', 'Leading tech company focused on AI solutions', 'https://example.com/logos/tech_innovators.png'),
  ('22222222-2222-2222-2222-222222222222', 'Green Energy Co', 'Renewable energy solutions provider', 'https://example.com/logos/green_energy.png'),
  ('33333333-3333-3333-3333-333333333333', 'Future Finance', 'Modern fintech company revolutionizing banking', 'https://example.com/logos/future_finance.png');

-- Then seed job listings
INSERT INTO public.job_info (
  job_info_id, 
  org_id, 
  title, 
  description, 
  location, 
  salary_range, 
  tags, 
  comp_specific_label
)
VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Senior Software Engineer',
    'We are looking for an experienced software engineer to join our team working on cutting-edge AI solutions.',
    'San Francisco, CA',
    '$120,000 - $160,000',
    ARRAY['typescript', 'react', 'node.js', 'ai'],
    'Competitive benefits and equity'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    'Renewable Energy Analyst',
    'Join our team of analysts working on sustainable energy solutions.',
    'Remote',
    '$90,000 - $110,000',
    ARRAY['renewable', 'analyst', 'remote', 'sustainability'],
    'Four-day work week and full benefits'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '33333333-3333-3333-3333-333333333333',
    'Full Stack Developer',
    'Looking for a developer to work on our customer-facing financial applications.',
    'New York, NY',
    '$130,000 - $170,000',
    ARRAY['javascript', 'python', 'fintech', 'fullstack'],
    'Annual bonuses and professional development budget'
  );