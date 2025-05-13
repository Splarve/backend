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
    token: string;
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
      .select('invitation_id, org_id, invited_email, status, expires_at, created_at, token, organizations ( org_name, org_handle, org_logo )')
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
            token: inv.token,
            organization: orgDetails ? { 
                orgId: inv.org_id, 
                name: orgDetails.org_name,
                handle: orgDetails.org_handle,
                logo: orgDetails.org_logo
            } : null
        };
    }) as UserInvitation[];
  },

  async acceptInvitation(token: string, acceptingUserId: string, acceptingUserEmail: string) {
    console.log('Accepting invitation:', { token, acceptingUserId, acceptingUserEmail }); // Debug log

    // Step 1: Find the invitation by token
    const { data: invitation, error: tokenError } = await supabase
      .from("organization_invitations")
      .select("*, organizations(org_handle)") // Select related org_handle for response
      .eq("token", token)
      .single();

    if (tokenError) {
      console.error("Error fetching invitation by token:", tokenError);
      if (tokenError.code === "PGRST116") { // Not found
        throw new AppError("Invalid or expired invitation token.", 404);
      }
      throw new AppError("Failed to validate invitation token.", 500, tokenError);
    }

    if (!invitation) {
      console.error("No invitation found for token:", token);
      throw new AppError("Invalid or expired invitation token.", 404);
    }

    console.log('Found invitation:', invitation); // Debug log

    // Step 2: Check invitation status and expiry
    if (invitation.status !== "pending") {
      throw new AppError(`Invitation is already ${invitation.status}.`, 409);
    }
    if (new Date(invitation.expires_at) < new Date()) {
      // Update status to 'expired'
      await supabase
        .from("organization_invitations")
        .update({ status: "expired" })
        .eq("invitation_id", invitation.invitation_id);
      throw new AppError("Invitation token has expired.", 410);
    }

    // Step 3: Verify the accepting user is the one invited (case-sensitive)
    if (invitation.invited_email !== acceptingUserEmail) {
      console.error("Email mismatch:", { 
        invitationEmail: invitation.invited_email, 
        acceptingEmail: acceptingUserEmail 
      });
      throw new AppError(
        "Email mismatch: This invitation is intended for a different email address (case-sensitive).",
        403
      );
    }

    // Step 4: Check if user is already a member
    const { count: memberCount, error: memberCheckError } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", invitation.org_id)
      .eq("user_id", acceptingUserId);

    if (memberCheckError) {
      console.error("Error checking existing membership:", memberCheckError);
      throw new AppError("Failed to check membership status.", 500, memberCheckError);
    }

    // Step 5: If not already a member, add them
    if (memberCount === 0) {
      const { error: insertError } = await supabase
        .from("organization_members")
        .insert({
          org_id: invitation.org_id,
          user_id: acceptingUserId,
          org_role_id: invitation.role_to_assign_id,
          email: acceptingUserEmail
        });

      if (insertError) {
        console.error("Error adding user to organization:", insertError);
        throw new AppError("Failed to add user to organization.", 500, insertError);
      }
    }

    // Step 6: Update invitation status to accepted
    const { error: updateError } = await supabase
      .from("organization_invitations")
      .update({ status: "accepted" })
      .eq("invitation_id", invitation.invitation_id);

    if (updateError) {
      console.error("Error updating invitation status:", updateError);
      throw new AppError("Failed to update invitation status.", 500, updateError);
    }

    return {
      message: "Invitation accepted successfully!",
      organization_id: invitation.org_id,
      organization_handle: invitation.organizations?.org_handle,
      role_assigned_id: invitation.role_to_assign_id,
    };
  },

  async declineInvitation(token: string, decliningUserEmail: string) {
    console.log('Declining invitation:', { token, decliningUserEmail }); // Debug log

    // Step 1: Find the invitation by token
    const { data: invitation, error: tokenError } = await supabase
      .from("organization_invitations")
      .select("invitation_id, status, invited_email, expires_at")
      .eq("token", token)
      .single();

    if (tokenError) {
      console.error("Error fetching invitation by token for decline:", tokenError);
      if (tokenError.code === "PGRST116") { // Not found
        throw new AppError("Invalid or expired invitation token.", 404);
      }
      throw new AppError("Failed to validate invitation token.", 500, tokenError);
    }

    if (!invitation) {
      console.error("No invitation found for token:", token);
      throw new AppError("Invalid or expired invitation token.", 404);
    }

    console.log('Found invitation:', invitation); // Debug log

    // Step 2: Check invitation status and expiry
    if (invitation.status !== "pending") {
      throw new AppError(`Invitation is already ${invitation.status}. Cannot decline.`, 409);
    }
    if (new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from("organization_invitations")
        .update({ status: "expired" })
        .eq("invitation_id", invitation.invitation_id);
      throw new AppError("Invitation token has expired. Cannot decline.", 410);
    }

    // Step 3: Verify the declining user is the one invited (case-sensitive)
    if (invitation.invited_email !== decliningUserEmail) {
      console.error("Email mismatch:", { 
        invitationEmail: invitation.invited_email, 
        decliningEmail: decliningUserEmail 
      });
      throw new AppError(
        "Email mismatch: This invitation is intended for a different email address (case-sensitive).",
        403
      );
    }

    // Step 4: Update invitation status to 'declined'
    const { error: updateError } = await supabase
      .from("organization_invitations")
      .update({ status: "declined" })
      .eq("invitation_id", invitation.invitation_id);

    if (updateError) {
      console.error("Error declining invitation:", updateError);
      throw new AppError("Failed to decline invitation.", 500, updateError || undefined);
    }

    return { message: "Invitation declined successfully." };
  }
}; 