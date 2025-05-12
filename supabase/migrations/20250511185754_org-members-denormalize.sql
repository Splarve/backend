-- Add email and display_name columns to organization_members
ALTER TABLE public.organization_members
ADD COLUMN email TEXT,
ADD COLUMN display_name TEXT;

-- Add a composite unique constraint on org_id and email
-- This ensures an email can only appear once per organization.
ALTER TABLE public.organization_members
ADD CONSTRAINT unique_org_email UNIQUE (org_id, email);

-- Optional: Add an index on user_id in organization_members if not already present and frequently queried
-- CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);

-- Backfill existing data
-- This assumes you want to populate display_name from raw_user_meta_data->>'display_name'
-- and that auth.users table can be joined on id = organization_members.user_id
WITH user_details AS (
  SELECT
    id,
    email,
    raw_user_meta_data ->> 'display_name' AS display_name
  FROM
    auth.users
)
UPDATE
  public.organization_members om
SET
  email = ud.email,
  display_name = ud.display_name
FROM
  user_details ud
WHERE
  om.user_id = ud.id;

-- Create a function to update organization_members on auth.users change
CREATE OR REPLACE FUNCTION public.sync_user_details_to_org_members()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.organization_members
  SET
    email = NEW.email,
    display_name = NEW.raw_user_meta_data ->> 'display_name'
  WHERE
    user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger on auth.users to call the function
-- This trigger fires after an update on the email or raw_user_meta_data columns.
CREATE TRIGGER on_auth_user_update
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_details_to_org_members();

-- Grant usage on the 'auth' schema and select on 'auth.users' to the postgres role (or your app's service role if different)
-- if the trigger function needs it and doesn't run with elevated privileges by default.
-- The SECURITY DEFINER on the function should handle this, but if issues arise, explicit grants might be needed.
-- GRANT USAGE ON SCHEMA auth TO postgres; -- Or your specific service role
-- GRANT SELECT ON auth.users TO postgres; -- Or your specific service role

COMMENT ON COLUMN public.organization_members.email IS 'Denormalized email from auth.users, updated by trigger';
COMMENT ON COLUMN public.organization_members.display_name IS 'Denormalized display name from auth.users (raw_user_meta_data), updated by trigger';