import { supabase } from "../../lib/supabase";
import { AppError } from "../../lib/errors";

// Define an interface for the organization membership details
interface OrganizationMembership {
  org_id: string;
  org_name: string;
  org_handle: string;
  org_logo?: string | null;
  role_name: string;
}

// Define an interface for the user invitation details
interface UserInvitation {
    invitationId: string;
    invitedEmail: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    organization: {
        orgId: string;
        name: string;
        handle: string;
        logo?: string | null;
    } | null;
}

export const currentUserService = {
  async getUserOrganizationMemberships(userId: string): Promise<OrganizationMembership[]> {
    const { data, error } = await supabase
      .from("organization_members")
      .select('organizations!inner ( org_id, org_name, org_handle, org_logo ), organization_roles!inner ( role_name )')
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching user organization memberships:", error);
      throw new AppError("Failed to retrieve user organization memberships.", 500, error);
    }

    return (data || []).map(member => {
      const orgDetails = member.organizations && Array.isArray(member.organizations) && member.organizations.length > 0
        ? member.organizations[0]
        : (member.organizations && !Array.isArray(member.organizations) ? member.organizations : null);

      const roleDetails = member.organization_roles && Array.isArray(member.organization_roles) && member.organization_roles.length > 0
        ? member.organization_roles[0]
        : (member.organization_roles && !Array.isArray(member.organization_roles) ? member.organization_roles : null);

      if (!orgDetails || !roleDetails) {
        console.error('Missing organization or role details for a membership record:', member);
        return null;
      }

      return {
        org_id: orgDetails.org_id,
        org_name: orgDetails.org_name,
        org_handle: orgDetails.org_handle,
        org_logo: orgDetails.org_logo,
        role_name: roleDetails.role_name,
      };
    }).filter(membership => membership !== null) as OrganizationMembership[];
  },

  async getUserInvitations(userEmail: string): Promise<UserInvitation[]> {
    const { data: invitations, error } = await supabase
      .from("organization_invitations")
      .select('invitation_id, org_id, invited_email, status, expires_at, created_at, organizations ( org_name, org_handle, org_logo )')
      .eq("invited_email", userEmail)
      .eq("status", "pending");

    if (error) {
      console.error("Error fetching user invitations:", error);
      throw new AppError("Failed to retrieve user invitations.", 500, error);
    }
    
    return (invitations || []).map(inv => {
        const orgDetails = inv.organizations && Array.isArray(inv.organizations) && inv.organizations.length > 0 
            ? inv.organizations[0] 
            : (inv.organizations && !Array.isArray(inv.organizations) ? inv.organizations : null);

        return {
            invitationId: inv.invitation_id,
            invitedEmail: inv.invited_email,
            status: inv.status,
            expiresAt: inv.expires_at,
            createdAt: inv.created_at,
            organization: orgDetails ? { 
                orgId: inv.org_id, 
                name: orgDetails.org_name,
                handle: orgDetails.org_handle,
                logo: orgDetails.org_logo
            } : null
        };
    }) as UserInvitation[];
  }
}; 