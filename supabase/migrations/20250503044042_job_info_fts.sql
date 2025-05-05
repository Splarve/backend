-- Enable pg_trgm if not already enabled (should be from initial setup)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Add a standard tsvector column (not generated)
ALTER TABLE public.job_info
ADD COLUMN search_vector tsvector;

-- 2. Create a function to update the search_vector
CREATE OR REPLACE FUNCTION update_job_info_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.job_title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.job_description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.location, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(NEW.salary, '')), 'C') ||
        setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'B') ||
        setweight(to_tsvector('english', NEW.employment_type::text), 'C') ||
        setweight(to_tsvector('english', array_to_string(NEW.citizenship_requirements, ' ')), 'D') ||
        setweight(to_tsvector('english', array_to_string(NEW.education_level, ' ')), 'D') ||
        setweight(to_tsvector('english', array_to_string(NEW.comp_specific_label, ' ')), 'D');
    RETURN NEW; -- Return the modified row
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Create a trigger to call the function before insert or update
CREATE TRIGGER tsvector_update_trigger
BEFORE INSERT OR UPDATE ON public.job_info
FOR EACH ROW EXECUTE FUNCTION update_job_info_search_vector();

-- 4. IMPORTANT: Update existing rows to populate the search_vector initially
-- Run this *after* creating the column and trigger
UPDATE public.job_info SET search_vector =
    setweight(to_tsvector('english', coalesce(job_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(job_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(salary, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('english', employment_type::text), 'C') ||
    setweight(to_tsvector('english', array_to_string(citizenship_requirements, ' ')), 'D') ||
    setweight(to_tsvector('english', array_to_string(education_level, ' ')), 'D') ||
    setweight(to_tsvector('english', array_to_string(comp_specific_label, ' ')), 'D')
WHERE search_vector IS NULL; -- Add WHERE clause for safety if run multiple times


-- 5. Add the GIN index for fast search (can be done after initial update)
CREATE INDEX IF NOT EXISTS idx_job_info_search_vector ON public.job_info USING GIN (search_vector);

-- Optional: Add missing trigram indexes for better similarity performance
-- CREATE INDEX IF NOT EXISTS idx_job_location_trgm ON public.job_info USING gin (location gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_job_salary_range_trgm ON public.job_info USING gin (salary_range gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_job_comp_label_trgm ON public.job_info USING gin (comp_specific_label gin_trgm_ops);


-- 6. Recreate the search function using RETURNS TABLE
-- Add org_id_filter parameter
CREATE OR REPLACE FUNCTION search_job_posts(search_query text, org_id_filter UUID)
RETURNS TABLE(
    job_info_id UUID,
    org_id UUID,
    department_id UUID,
    job_title TEXT,
    job_description TEXT,
    location TEXT,
    employment_type employment_type,
    salary TEXT,
    tags TEXT[],
    citizenship_requirements TEXT[],
    education_level TEXT[],
    status job_status,
    applicant_count INTEGER,
    comp_specific_label TEXT[],
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    search_vector tsvector,
    relevance_score REAL
)
LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE
    web_query tsquery;
    similarity_threshold real := 0.15;
BEGIN
    search_query := trim(search_query);
    web_query := websearch_to_tsquery('english', search_query);

    RETURN QUERY
    SELECT
        ji.job_info_id,
        ji.org_id,
        ji.department_id,
        ji.job_title,
        ji.job_description,
        ji.location,
        ji.employment_type,
        ji.salary,
        ji.tags,
        ji.citizenship_requirements,
        ji.education_level,
        ji.status,
        ji.applicant_count,
        ji.comp_specific_label,
        ji.created_at,
        ji.updated_at,
        ji.search_vector,
        -- Calculate rank based on tsvector match and similarity
        (ts_rank(ji.search_vector, web_query) +
         GREATEST(
             similarity(ji.job_title, search_query),
             similarity(ji.job_description, search_query),
             similarity(ji.location, search_query),
             similarity(array_to_string(ji.tags, ' '), search_query),
             similarity(array_to_string(ji.comp_specific_label, ' '), search_query)
         ))::real AS relevance_score
    FROM
        public.job_info ji
    WHERE
        ji.org_id = org_id_filter -- Filter by organization ID
        AND (
            -- Original search conditions
            ji.search_vector @@ web_query
            OR similarity(ji.job_title, search_query) > similarity_threshold
            OR similarity(ji.job_description, search_query) > similarity_threshold
            OR similarity(ji.location, search_query) > similarity_threshold
            OR similarity(array_to_string(ji.tags, ' '), search_query) > similarity_threshold
            OR similarity(array_to_string(ji.comp_specific_label, ' '), search_query) > similarity_threshold
        )
    ORDER BY
        relevance_score DESC
    LIMIT 50;

END;
$$;