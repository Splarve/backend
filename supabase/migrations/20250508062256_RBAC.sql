-- 1. Create app_permissions table (Global list of all possible actions)
CREATE TABLE public.app_permissions (
    permission_id TEXT PRIMARY KEY, -- e.g., 'job-posts:create', 'org:edit'
    description TEXT
);

-- Pre-populate with some initial essential permissions
INSERT INTO public.app_permissions (permission_id, description) VALUES
    ('org:read', 'Read organization details'),
    ('org:edit', 'Edit organization settings'),
    ('org:delete', 'Delete organization'),
    ('departments:create', 'Create departments'),
    ('departments:edit', 'Edit departments'),
    ('departments:delete', 'Delete departments'),
    ('job-posts:create', 'Create job posts'),
    ('job-posts:edit', 'Edit job posts'),
    ('job-posts:delete', 'Delete job posts'),
    ('job-posts:publish', 'Publish job posts'),
    ('members:invite', 'Invite members to the organization'),
    ('members:remove', 'Remove members from the organization'),
    ('members:read', 'View organization members'),
    ('roles:create', 'Create custom roles for the organization'),
    ('roles:edit', 'Edit custom roles for the organization (name, permissions)'),
    ('roles:delete', 'Delete custom roles for the organization'),
    ('roles:assign', 'Assign roles to organization members');
    -- Add more permissions as your application grows

-- 2. Create organization_roles table (Roles defined per organization)
CREATE TABLE public.organization_roles (
    org_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(org_id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE, -- To distinguish system-generated roles like 'Org Owner/Admin'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(org_id, role_name) -- Role names must be unique within an organization
);

CREATE INDEX idx_organization_roles_org_id ON public.organization_roles(org_id);

-- Trigger for updated_at on organization_roles
CREATE OR REPLACE FUNCTION update_organization_roles_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_roles_trigger
BEFORE UPDATE ON public.organization_roles
FOR EACH ROW
EXECUTE FUNCTION update_organization_roles_updated_at_column();

-- 3. Create organization_role_permissions table (Join table for roles and permissions)
CREATE TABLE public.organization_role_permissions (
    org_role_id UUID NOT NULL REFERENCES public.organization_roles(org_role_id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES public.app_permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (org_role_id, permission_id)
);

-- 4. Create/Modify organization_members table
-- If organization_members table already exists with the ENUM role, drop it first (or alter carefully)
-- Assuming it needs to be created or significantly changed:
DROP TABLE IF EXISTS public.organization_members; -- Be careful if it has data you want to migrate

CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(org_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_role_id UUID NOT NULL REFERENCES public.organization_roles(org_role_id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(org_id, user_id), -- A user can only have one role assignment per organization
    CONSTRAINT unique_org_email UNIQUE (org_id, email) -- Ensures an email can only appear once per organization
);

CREATE INDEX idx_organization_members_org_id_user_id ON public.organization_members(org_id, user_id);
CREATE INDEX idx_organization_members_role_id ON public.organization_members(org_role_id);

-- Comments for denormalized columns
COMMENT ON COLUMN public.organization_members.email IS 'Denormalized email from auth.users.';
COMMENT ON COLUMN public.organization_members.display_name IS 'Denormalized display name from auth.users (raw_user_meta_data).';

-- Trigger for updated_at on organization_members
CREATE OR REPLACE FUNCTION update_organization_members_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_members_trigger
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION update_organization_members_updated_at_column();


-- Apply security: Revoke permissions for anon and authenticated roles from new tables
REVOKE ALL ON TABLE public.app_permissions FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_roles FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_role_permissions FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_members FROM anon, authenticated;

-- Default privileges for public schema (re-iterate or ensure it's in a central security migration)
-- This ensures any NEW tables in public by default don't grant to anon/authenticated.
-- Note: `app_permissions` might be an exception if you ever wanted client-side to list available permissions for UI reasons,
-- but even then, it's safer to have an endpoint. For now, locking it down.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
