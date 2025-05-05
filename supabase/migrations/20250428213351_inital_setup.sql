-- Define ENUM types (Please create these in Supabase Studio -> Database -> Enums first if needed)
CREATE TYPE employment_type AS ENUM (
    'Full-time',
    'Part-time',
    'Contract',
    'Temporary',
    'Internship',
    'Volunteer',
    'Apprenticeship',
    'Per Diem'
);

CREATE TYPE job_status AS ENUM (
    'draft',
    'published'
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.organizations (
    org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name TEXT NOT NULL, -- Removed UNIQUE constraint temporarily, handle uniqueness via org_handle
    org_handle TEXT UNIQUE NOT NULL, -- Added unique handle
    org_description TEXT, -- Changed to nullable
    org_logo TEXT, -- Changed to nullable
    org_industry TEXT, -- Added industry
    org_location TEXT, -- Added location
    website TEXT -- Added optional website
);

CREATE INDEX idx_org_name ON public.organizations USING gin (org_name gin_trgm_ops);
CREATE INDEX idx_org_handle ON public.organizations (org_handle); -- Index for handle lookups

-- New departments table
CREATE TABLE public.departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(org_id) ON DELETE CASCADE,
    department_name TEXT NOT NULL,
    UNIQUE(org_id, department_name) -- Ensure department names are unique within an org
);

CREATE TABLE public.job_info (
    job_info_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations (org_id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(department_id), -- Changed to NOT NULL
    job_title TEXT NOT NULL, -- Renamed from title
    job_description TEXT NOT NULL, -- Changed back to NOT NULL
    location TEXT NOT NULL, -- Changed back to NOT NULL
    employment_type employment_type NOT NULL, -- Added employment type enum
    salary TEXT NOT NULL, -- Changed back to NOT NULL
    tags TEXT[] NOT NULL, -- Changed back to NOT NULL
    citizenship_requirements TEXT[] NOT NULL, -- Added citizenship requirements (array of strings), changed to NOT NULL
    education_level TEXT[] NOT NULL, -- Added education level (array of strings), changed to NOT NULL
    status job_status NOT NULL DEFAULT 'draft', -- Added status enum
    applicant_count INTEGER NOT NULL DEFAULT 0, -- Added back applicant_count
    comp_specific_label TEXT[] NOT NULL, -- Changed to TEXT[] NOT NULL
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    -- Removed applicant_count (comment removed)
    -- Removed comp_specific_label (comment removed)
);

CREATE INDEX idx_job_title ON public.job_info USING gin (job_title gin_trgm_ops);
CREATE INDEX idx_job_description ON public.job_info USING gin (job_description gin_trgm_ops);
CREATE INDEX idx_job_tags_gin ON public.job_info USING gin(tags);
CREATE INDEX idx_job_department_id ON public.job_info (department_id);
CREATE INDEX idx_job_status ON public.job_info (status);
CREATE INDEX idx_job_employment_type ON public.job_info (employment_type);

-- Automatically updating the updated at column at edit
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_job_info_updated_at
BEFORE UPDATE ON public.job_info
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();