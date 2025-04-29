CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.organizations (
    org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name TEXT UNIQUE NOT NULL,
    org_description TEXT NOT NULL,
    org_logo TEXT NOT NULL
);

CREATE INDEX idx_org_name ON public.organizations USING gin (org_name gin_trgm_ops);

CREATE TABLE public.job_info (
    job_info_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations (org_id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    applicant_count INTEGER NOT NULL DEFAULT 0,
    location TEXT NOT NULL,
    salary_range TEXT NOT NULL,
    tags TEXT[] NOT NULL,
    comp_specific_label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_title ON public.job_info USING gin (title gin_trgm_ops);
CREATE INDEX idx_job_description ON public.job_info USING gin (description gin_trgm_ops);
CREATE INDEX idx_job_tags_gin ON public.job_info USING gin(tags);

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