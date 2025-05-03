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
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.location, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(NEW.salary_range, '')), 'C') ||
        setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.comp_specific_label, '')), 'D');
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
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(salary_range, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(comp_specific_label, '')), 'D')
WHERE search_vector IS NULL; -- Add WHERE clause for safety if run multiple times


-- 5. Add the GIN index for fast search (can be done after initial update)
CREATE INDEX IF NOT EXISTS idx_job_info_search_vector ON public.job_info USING GIN (search_vector);

-- Optional: Add missing trigram indexes for better similarity performance
-- CREATE INDEX IF NOT EXISTS idx_job_location_trgm ON public.job_info USING gin (location gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_job_salary_range_trgm ON public.job_info USING gin (salary_range gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_job_comp_label_trgm ON public.job_info USING gin (comp_specific_label gin_trgm_ops);


-- 6. Recreate the search function using RETURNS TABLE (This block was already here)
CREATE OR REPLACE FUNCTION search_job_posts(search_query text)
-- Explicitly define all returned columns, including the calculated score
RETURNS TABLE(
    job_info_id UUID,
    org_id UUID,
    title TEXT,
    description TEXT,
    applicant_count INTEGER,
    location TEXT,
    salary_range TEXT,
    tags TEXT[],
    comp_specific_label TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    search_vector tsvector, -- Include the search_vector column itself if needed later
    relevance_score REAL -- Add the calculated score column
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
        ji.job_info_id, -- List all columns explicitly instead of ji.*
        ji.org_id,
        ji.title,
        ji.description,
        ji.applicant_count,
        ji.location,
        ji.salary_range,
        ji.tags,
        ji.comp_specific_label,
        ji.created_at,
        ji.updated_at,
        ji.search_vector,
        -- Calculate rank based on tsvector match and similarity
        (ts_rank(ji.search_vector, web_query) +
         GREATEST(
             similarity(ji.title, search_query),
             similarity(ji.description, search_query),
             similarity(ji.location, search_query),
             similarity(ji.comp_specific_label, search_query)
         ))::real AS relevance_score -- Cast score to REAL to match return type
    FROM
        public.job_info ji
    WHERE
        ji.search_vector @@ web_query
        OR similarity(ji.title, search_query) > similarity_threshold
        OR similarity(ji.description, search_query) > similarity_threshold
        OR similarity(ji.location, search_query) > similarity_threshold
        OR similarity(ji.comp_specific_label, search_query) > similarity_threshold
    ORDER BY
        relevance_score DESC
    LIMIT 50;

END;
$$;