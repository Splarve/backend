-- ENUM for invitation status
CREATE TYPE invitation_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired'
);

-- Table to store organization invitations
CREATE TABLE public.organization_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(org_id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL, -- Email of the person being invited
    invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL, -- Who sent the invite. SET NULL if inviter's account is deleted.
    role_to_assign_id UUID NOT NULL REFERENCES public.organization_roles(org_role_id) ON DELETE CASCADE, -- Which role they get upon acceptance
    token TEXT UNIQUE NOT NULL, -- Secure, unique token for the invitation link
    status invitation_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_organization_invitations_org_id ON public.organization_invitations(org_id);
CREATE INDEX idx_organization_invitations_invited_email ON public.organization_invitations(invited_email);
CREATE INDEX idx_organization_invitations_token ON public.organization_invitations(token);
CREATE INDEX idx_organization_invitations_status ON public.organization_invitations(status);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_invitations_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_invitations_trigger
BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION update_organization_invitations_updated_at_column();

-- Apply security: Revoke permissions for anon and authenticated roles
REVOKE ALL ON TABLE public.organization_invitations FROM anon;
REVOKE ALL ON TABLE public.organization_invitations FROM authenticated;

-- Default privileges for public schema (ensure this is part of your standard security setup)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;