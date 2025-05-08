-- Revoke all permissions for the anon role on specific tables
REVOKE ALL ON TABLE public.organizations FROM anon;
REVOKE ALL ON TABLE public.departments FROM anon;
REVOKE ALL ON TABLE public.job_info FROM anon;

-- Revoke usage on the public schema for the anon role
-- This prevents listing tables, etc.
REVOKE USAGE ON SCHEMA public FROM anon;

-- IMPORTANT: For any new tables you create in the public schema in the future,
-- you'll want to ensure the anon role doesn't automatically get permissions.
-- You can set default privileges for the schema:
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon; -- If you use sequences directly
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon; -- If anon should not execute functions

-- Additionally, if you are using storage and want to prevent anonymous access to buckets/objects,
-- you'll need to manage those permissions through Storage policies (RLS on storage.objects)
-- or by ensuring buckets are not public and anon key cannot list/read them.
-- The above commands primarily cover database table access.

-- Revoke all permissions for the 'authenticated' role on specific tables
-- in the 'public' schema.
REVOKE ALL ON TABLE public.organizations FROM authenticated;
REVOKE ALL ON TABLE public.departments FROM authenticated;
REVOKE ALL ON TABLE public.job_info FROM authenticated;

-- Additionally, to prevent the 'authenticated' role from seeing other objects
-- in the public schema unless explicitly granted (which you won't be doing for tables),
-- you can consider this. However, 'authenticated' users might still need to access
-- functions or other schema objects provided by Supabase extensions if you use them.
-- So, be cautious with a broad REVOKE USAGE ON SCHEMA.
-- For now, let's focus on table access. If you find authenticated users can still list
-- tables or something unexpected, you might revisit REVOKE USAGE ON SCHEMA public FROM authenticated;
-- but it's generally not needed if table-level permissions are revoked.

-- IMPORTANT: For any new application tables you create in the public schema in the future,
-- you'll want to ensure the 'authenticated' role doesn't automatically get permissions.
-- Set default privileges for the schema:
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;