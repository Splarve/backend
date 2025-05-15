import { supabase } from "../../lib/supabase";
import { AppError } from "../../lib/errors";
import type { CreateOrganizationInput, InviteUserInput, CreateOrgRoleInput, UpdateOrgRoleInput, AssignRoleInput } from "./organization.validation";
import crypto from "crypto";

// Define the name for the default admin role for new organizations
const DEFAULT_ORG_ADMIN_ROLE_NAME = "Owner";
const DEFAULT_ORG_MEMBER_ROLE_NAME = "Member"; // New default role
const INVITATION_EXPIRY_HOURS = 72; // Invitations expire in 3 days

interface OrganizationRole {
  org_role_id: string;
  role_name: string;
  is_system_role: boolean;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export const organizationService = {
  async createOrganization(
    input: CreateOrganizationInput,
    creator: { 
      id: string; 
      email?: string | null; // Make email optional as it might not always be present
      user_metadata?: { [key: string]: any; display_name?: string } | null; // Standard Supabase user_metadata structure
    }
  ) {
    // Step 0: Use provided creator's auth details
    const creatorUserId = creator.id;
    const creatorEmail = creator.email || null;
    // Attempt to get display_name from user_metadata, fallback to a generic name or part of email if not present
    const creatorDisplayName = creator.user_metadata?.display_name || 
                             (creatorEmail ? creatorEmail.split('@')[0] : null) || 
                             'Creator'; // Fallback display name

    console.log(`[OrgCreation] Creating organization with Creator ID: ${creatorUserId}, Email: ${creatorEmail}, DisplayName: ${creatorDisplayName}`);
    if (!creator.user_metadata?.display_name) {
        console.warn("[OrgCreation] display_name not found in creator.user_metadata. Fallback logic for display name was triggered.");
        console.log("[OrgCreation] creator.user_metadata snapshot:", JSON.stringify(creator.user_metadata, null, 2));
    }

    // Start a Supabase transaction
    // Note: Actual transaction support for multiple operations might depend on Supabase client library version
    // or require manually calling RPC functions that bundle these operations if direct JS transactions are limited.
    // For now, we proceed with sequential calls, but for production, ensure atomicity.

    // TODO: Wrap the following operations in a database transaction if possible
    // This is a placeholder for how one might typically approach it.
    // const { data: transactionData, error: transactionError } = await supabase.rpc('create_org_and_assign_owner', {
    //   org_data: input,
    //   creator_id: creatorUserId,
    //   admin_role_name: DEFAULT_ORG_ADMIN_ROLE_NAME
    // });
    // if (transactionError) throw new AppError("Transaction failed", 500, transactionError);
    // return transactionData;

    // Step 1: Create the organization
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .insert({
        org_name: input.org_name,
        org_handle: input.org_handle,
        org_description: input.org_description,
        org_logo: input.org_logo,
        org_industry: input.org_industry,
        org_location: input.org_location,
        website: input.website,
      })
      .select()
      .single();

    if (orgError) {
      if (orgError.code === "23505") { // Unique violation (e.g., org_handle)
        throw new AppError(
          `Organization handle '${input.org_handle}' already exists.`,
          409,
          orgError
        );
      }
      console.error("Error creating organization:", orgError);
      throw new AppError(
        "Failed to create organization",
        500,
        orgError
      );
    }
    if (!orgData) {
      throw new AppError("Failed to create organization, no data returned", 500);
    }

    const newOrgId = orgData.org_id;

    // Step 2a: Create the default "Owner" role for this organization
    const { data: ownerRoleData, error: ownerRoleError } = await supabase
      .from("organization_roles")
      .insert({
        org_id: newOrgId,
        role_name: DEFAULT_ORG_ADMIN_ROLE_NAME,
        is_system_role: true, 
      })
      .select()
      .single();

    if (ownerRoleError) {
      console.error("Error creating default Owner role:", ownerRoleError);
      throw new AppError(
        "Failed to create default Owner role for organization",
        500,
        ownerRoleError
      );
    }
    if (!ownerRoleData) {
        throw new AppError("Failed to create default Owner role, no data returned", 500);
    }
    const ownerRoleId = ownerRoleData.org_role_id;

    // Step 2b: Create the default "Member" role for this organization
    const { data: memberRoleData, error: memberRoleError } = await supabase
      .from("organization_roles")
      .insert({
        org_id: newOrgId,
        role_name: DEFAULT_ORG_MEMBER_ROLE_NAME,
        is_system_role: true,
      })
      .select()
      .single();

    if (memberRoleError) {
      console.error("Error creating default Member role:", memberRoleError);
      // Consider cleanup logic here if Owner role was created but Member role failed
      throw new AppError(
        "Failed to create default Member role for organization",
        500,
        memberRoleError
      );
    }
    if (!memberRoleData) {
        throw new AppError("Failed to create default Member role, no data returned", 500);
    }
    // const memberRoleId = memberRoleData.org_role_id; // We'll use this ID if we were to assign default member permissions

    // Step 3: Assign all available permissions to the "Owner" role
    // Fetch all permission_ids from app_permissions
    const { data: allPermissions, error: permFetchError } = await supabase
      .from("app_permissions")
      .select("permission_id");

    if (permFetchError || !allPermissions) {
      console.error("Error fetching app permissions:", permFetchError);
      throw new AppError(
        "Failed to fetch application permissions for Owner role assignment",
        500,
        permFetchError
      );
    }

    const ownerRolePermissions = allPermissions.map((p) => ({
      org_role_id: ownerRoleId, // Use Owner role ID
      permission_id: p.permission_id,
    }));

    if (ownerRolePermissions.length > 0) {
        const { error: rolePermError } = await supabase
        .from("organization_role_permissions")
        .insert(ownerRolePermissions);

        if (rolePermError) {
        console.error("Error assigning permissions to Owner role:", rolePermError);
        throw new AppError(
            "Failed to assign permissions to default Owner role",
            500,
            rolePermError
        );
        }
    }
    // Note: The "Member" role gets no permissions by default. Org Owner can assign them later.
    

    // Step 4: Assign the creator as the Owner of the new organization
    const { error: memberAssignError } = await supabase
      .from("organization_members")
      .insert({
        org_id: newOrgId,
        user_id: creatorUserId,
        org_role_id: ownerRoleId, // Assign the Owner role ID
        email: creatorEmail, // Use the provided email
        display_name: creatorDisplayName, // Use the provided or derived display name
      });

    if (memberAssignError) {
      console.error("Error assigning creator to organization:", memberAssignError);
      throw new AppError(
        "Failed to assign creator as organization owner",
        500,
        memberAssignError
      );
    }

    // Return the created organization data (or a more comprehensive object)
    return {
        ...orgData,
        creator_role: DEFAULT_ORG_ADMIN_ROLE_NAME,
        creator_role_id: ownerRoleId
    };
  },

  async inviteUserToOrganization(
    orgId: string, 
    inviterUserId: string, 
    inviteInput: InviteUserInput
  ) {
    // Step 1: Verify the role_to_assign_id belongs to the organization
    const { data: roleData, error: roleCheckError } = await supabase
      .from("organization_roles")
      .select("org_role_id")
      .eq("org_id", orgId)
      .eq("org_role_id", inviteInput.org_role_id)
      .single();

    if (roleCheckError || !roleData) {
      console.error(
        `Role ID ${inviteInput.org_role_id} not found or does not belong to org ${orgId}:`,
        roleCheckError
      );
      throw new AppError("Specified role not found for this organization.", 400);
    }

    const invitedEmail = inviteInput.invited_email; // No longer lowercasing

    // Step 1.5: Check if this email is ALREADY an active member of THIS organization
    const { count: activeMemberCount, error: activeMemberCheckError } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("email", invitedEmail); // Case-sensitive check

    if (activeMemberCheckError) {
      console.error("Error checking active membership by email:", activeMemberCheckError);
      throw new AppError("Failed to verify existing membership by email.", 500, activeMemberCheckError);
    }

    if (activeMemberCount && activeMemberCount > 0) {
      throw new AppError(
        `${invitedEmail} is already an active member of this organization. No new invitation needed.`,
        409 // Conflict
      );
    }

    // Step 2: Check for existing PENDING invitations for this email in this org
    const { count: existingInviteCount, error: inviteCheckError } = await supabase
      .from("organization_invitations")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("invited_email", invitedEmail) // Case-sensitive check
      .eq("status", "pending");
    
    if (inviteCheckError) {
      console.error("Error checking for existing pending invitations:", inviteCheckError);
      throw new AppError("Failed to check for existing invitations.", 500, inviteCheckError);
    }

    if (existingInviteCount && existingInviteCount > 0) {
      throw new AppError(
        `An active invitation already exists for ${invitedEmail} for this organization.`,
        409
      );
    }

    // Step 3: Generate a secure invitation token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRY_HOURS);

    // Step 4: Create the invitation record
    const { data: invitationData, error: invitationError } = await supabase
      .from("organization_invitations")
      .insert({
        org_id: orgId,
        invited_email: invitedEmail, // Store email as provided (case-sensitive)
        invited_by_user_id: inviterUserId,
        role_to_assign_id: inviteInput.org_role_id,
        token: token,
        expires_at: expiresAt.toISOString(),
        status: "pending",
      })
      .select("invitation_id, token, expires_at, invited_email, status")
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      throw new AppError("Failed to create invitation.", 500, invitationError);
    }
    if (!invitationData) {
      throw new AppError("Failed to create invitation, no data returned.", 500);
    }

    console.log(`TODO: Send email to ${invitationData.invited_email} with token ${invitationData.token}`);

    return invitationData;
  },

  async acceptInvitation(token: string, acceptingUserId: string, acceptingUserEmail: string) {
    // Step 1: Find the invitation by token
    const { data: invitation, error: tokenError } = await supabase
      .from("organization_invitations")
      .select("*, organizations(org_handle)") // Select related org_handle for response
      .eq("token", token)
      .single();

    if (tokenError || !invitation) {
      if (tokenError && tokenError.code === "PGRST116") { // Not found
        throw new AppError("Invalid or expired invitation token.", 404);
      }
      console.error("Error fetching invitation by token:", tokenError);
      throw new AppError("Failed to validate invitation token.", 500, tokenError || undefined);
    }

    // Step 2: Check invitation status and expiry
    if (invitation.status !== "pending") {
      throw new AppError(`Invitation is already ${invitation.status}.`, 409); // Conflict
    }
    if (new Date(invitation.expires_at) < new Date()) {
      // Optionally update status to 'expired' here if not done by a cron job
      await supabase
        .from("organization_invitations")
        .update({ status: "expired" })
        .eq("invitation_id", invitation.invitation_id);
      throw new AppError("Invitation token has expired.", 410); // Gone
    }

    // Step 3: Verify the accepting user is the one invited (case-sensitive)
    if (invitation.invited_email !== acceptingUserEmail) { // Strict case-sensitive comparison
      throw new AppError(
        "Email mismatch: This invitation is intended for a different email address (case-sensitive).",
        403
      );
    }

    // Step 4: Check if user is already a member (important to avoid duplicate entries)
    const { count: memberCount, error: memberCheckError } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", invitation.org_id)
        .eq("user_id", acceptingUserId);

    if (memberCheckError) {
        console.error("Error checking existing membership for accepting user:", memberCheckError);
        throw new AppError("Failed to check current membership status.", 500, memberCheckError);
    }
    if (memberCount && memberCount > 0) {
        // User is already a member. Update invite status and inform them.
        await supabase
            .from("organization_invitations")
            .update({ status: "accepted" }) // Or a custom status like 'already_member'
            .eq("invitation_id", invitation.invitation_id);

        // Step 4.5: Fetch accepting user's auth details for display_name
        const { data: acceptingUserAuthData, error: acceptingUserAuthError } = await supabase
          .schema("auth")
          .from("users")
          .select("raw_user_meta_data") // We already have email via acceptingUserEmail
          .eq("id", acceptingUserId)
          .single();

        if (acceptingUserAuthError || !acceptingUserAuthData) {
          console.error("Error fetching accepting user auth details for display_name:", acceptingUserAuthError);
          // If this fails, we might still proceed but log it, or throw. For now, let's throw.
          throw new AppError(
            "Failed to fetch user details for joining organization.",
            500,
            acceptingUserAuthError || undefined
          );
        }
        const userDisplayName = acceptingUserAuthData.raw_user_meta_data?.display_name || acceptingUserEmail.split('@')[0] || 'Member';

        // Step 5: Update the existing member's details in organization_members
        const { error: updateMemberError } = await supabase
          .from("organization_members")
          .update({ 
            email: acceptingUserEmail, 
            display_name: userDisplayName,
            // org_role_id: invitation.role_to_assign_id, // Decide if role should be updated. If so, uncomment.
                                                          // If the invitation implies a new role even for an existing member,
                                                          // this should be included. Otherwise, leave it to not change current role.
          })
          .eq("org_id", invitation.org_id)
          .eq("user_id", acceptingUserId);

        if (updateMemberError) {
          console.error("Error updating user details in organization_members:", updateMemberError);
          // Log this as a potential data consistency issue. 
          // The main operation (accepting invite) for an existing member still proceeds.
          // Not throwing an error here not to break the flow for the user.
        }

        return {
          message: "Invitation accepted successfully!",
          organization_id: invitation.org_id,
          organization_handle: invitation.organizations?.org_handle, // if joined in select
          role_assigned_id: invitation.role_to_assign_id,
        };
    }

    // Step 5: Add user to organization_members (Transaction recommended for these two updates)
    const { error: addMemberError } = await supabase
      .from("organization_members")
      .insert({
        org_id: invitation.org_id,
        user_id: acceptingUserId,
        org_role_id: invitation.role_to_assign_id,
      });

    if (addMemberError) {
      // Handle potential unique constraint violation if, by some race condition, they were added
      if (addMemberError.code === '23505') { // unique_violation
         await supabase // Still mark invite as accepted if they are now a member
            .from("organization_invitations")
            .update({ status: "accepted" })
            .eq("invitation_id", invitation.invitation_id);
        throw new AppError("User is already a member of this organization (concurrent join).", 409);
      }
      console.error("Error adding user to organization members:", addMemberError);
      throw new AppError("Failed to add user to organization.", 500, addMemberError);
    }

    // Step 6: Update invitation status to 'accepted'
    const { data: updatedInvite, error: updateInviteError } = await supabase
      .from("organization_invitations")
      .update({ status: "accepted", user_id: acceptingUserId }) // Optionally store who accepted it if user_id column is added to invitations table
      .eq("invitation_id", invitation.invitation_id)
      .select()
      .single();

    if (updateInviteError || !updatedInvite) {
      console.error("Error updating invitation status:", updateInviteError);
      // At this point, user IS a member. This is a data consistency issue for the invite itself.
      // Log this error critically. For the user, the join was successful.
      // Depending on business logic, you might not throw an error to the user here,
      // but ensure system admins are alerted.
      throw new AppError("Joined organization, but failed to update invitation status.", 500, updateInviteError || undefined);
    }

    return {
      message: "Invitation accepted successfully!",
      organization_id: invitation.org_id,
      organization_handle: invitation.organizations?.org_handle, // if joined in select
      role_assigned_id: invitation.role_to_assign_id,
    };
  },

  async declineInvitation(token: string, decliningUserEmail: string) {
    // Step 1: Find the invitation by token
    const { data: invitation, error: tokenError } = await supabase
      .from("organization_invitations")
      .select("invitation_id, status, invited_email, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !invitation) {
      if (tokenError && tokenError.code === "PGRST116") { // Not found
        throw new AppError("Invalid or expired invitation token.", 404);
      }
      console.error("Error fetching invitation by token for decline:", tokenError);
      throw new AppError("Failed to validate invitation token.", 500, tokenError || undefined);
    }

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
    if (invitation.invited_email !== decliningUserEmail) { // Strict case-sensitive comparison
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
  },

  async listAppPermissions() {
    const { data, error } = await supabase
      .from("app_permissions")
      .select("permission_id, description");

    if (error) {
      console.error("Error fetching application permissions:", error);
      throw new AppError("Failed to retrieve application permissions.", 500, error || undefined);
    }
    return data || [];
  },

  async getOrganizationRoles(orgId: string): Promise<OrganizationRole[]> {
    const { data: roles, error: rolesError } = await supabase
      .from("organization_roles")
      .select(`
        org_role_id,
        role_name,
        is_system_role,
        created_at,
        updated_at,
        organization_role_permissions (
          permission_id
        )
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (rolesError) {
      console.error("Error fetching organization roles:", rolesError);
      throw new AppError("Failed to fetch organization roles.", 500, rolesError);
    }

    return roles.map(role => ({
      org_role_id: role.org_role_id,
      role_name: role.role_name,
      is_system_role: role.is_system_role,
      permissions: role.organization_role_permissions.map(p => p.permission_id),
      created_at: role.created_at,
      updated_at: role.updated_at
    }));
  },

  async createOrganizationRole(
    orgId: string,
    roleName: string,
    permission_ids: string[]
  ): Promise<OrganizationRole> {
    // Start a transaction
    const { data: role, error: roleError } = await supabase
      .from("organization_roles")
      .insert({
        org_id: orgId,
        role_name: roleName,
        is_system_role: false
      })
      .select()
      .single();

    if (roleError) {
      console.error("Error creating organization role:", roleError);
      throw new AppError("Failed to create organization role.", 500, roleError);
    }

    // Insert role permissions
    const rolePermissions = permission_ids.map(permissionId => ({
      org_role_id: role.org_role_id,
      permission_id: permissionId
    }));

    const { error: permissionsError } = await supabase
      .from("organization_role_permissions")
      .insert(rolePermissions);

    if (permissionsError) {
      console.error("Error assigning permissions to role:", permissionsError);
      // Attempt to clean up the created role
      await supabase
        .from("organization_roles")
        .delete()
        .eq("org_role_id", role.org_role_id);
      throw new AppError("Failed to assign permissions to role.", 500, permissionsError);
    }

    return {
      org_role_id: role.org_role_id,
      role_name: role.role_name,
      is_system_role: role.is_system_role,
      permissions: permission_ids,
      created_at: role.created_at,
      updated_at: role.updated_at
    };
  },

  async updateOrganizationRole(
    orgId: string,
    roleId: string,
    roleName: string,
    permission_ids: string[]
  ): Promise<OrganizationRole> {
    // Check if role exists and belongs to the organization
    const { data: existingRole, error: checkError } = await supabase
      .from("organization_roles")
      .select("is_system_role")
      .eq("org_id", orgId)
      .eq("org_role_id", roleId)
      .single();

    if (checkError || !existingRole) {
      throw new AppError("Role not found or does not belong to this organization.", 404);
    }

    if (existingRole.is_system_role) {
      throw new AppError("Cannot modify system roles.", 403);
    }

    // Update role name
    const { data: updatedRole, error: updateError } = await supabase
      .from("organization_roles")
      .update({ role_name: roleName })
      .eq("org_role_id", roleId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating role name:", updateError);
      throw new AppError("Failed to update role.", 500, updateError);
    }

    // Update permissions
    // First, delete existing permissions
    const { error: deleteError } = await supabase
      .from("organization_role_permissions")
      .delete()
      .eq("org_role_id", roleId);

    if (deleteError) {
      console.error("Error deleting existing permissions:", deleteError);
      throw new AppError("Failed to update role permissions.", 500, deleteError);
    }

    // Then insert new permissions
    const rolePermissions = permission_ids.map(permissionId => ({
      org_role_id: roleId,
      permission_id: permissionId
    }));

    const { error: insertError } = await supabase
      .from("organization_role_permissions")
      .insert(rolePermissions);

    if (insertError) {
      console.error("Error inserting new permissions:", insertError);
      throw new AppError("Failed to update role permissions.", 500, insertError);
    }

    return {
      org_role_id: updatedRole.org_role_id,
      role_name: updatedRole.role_name,
      is_system_role: updatedRole.is_system_role,
      permissions: permission_ids,
      created_at: updatedRole.created_at,
      updated_at: updatedRole.updated_at
    };
  },

  async deleteOrganizationRole(orgId: string, roleId: string): Promise<void> {
    // Check if role exists and belongs to the organization
    const { data: existingRole, error: checkError } = await supabase
      .from("organization_roles")
      .select("is_system_role")
      .eq("org_id", orgId)
      .eq("org_role_id", roleId)
      .single();

    if (checkError || !existingRole) {
      throw new AppError("Role not found or does not belong to this organization.", 404);
    }

    if (existingRole.is_system_role) {
      throw new AppError("Cannot delete system roles.", 403);
    }

    // Check if role is assigned to any members
    const { count, error: countError } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("org_role_id", roleId);

    if (countError) {
      console.error("Error checking role usage:", countError);
      throw new AppError("Failed to check if role is in use.", 500, countError);
    }

    if (count && count > 0) {
      throw new AppError("Cannot delete role that is assigned to members.", 409);
    }

    // Delete role (cascade will handle permissions)
    const { error: deleteError } = await supabase
      .from("organization_roles")
      .delete()
      .eq("org_role_id", roleId);

    if (deleteError) {
      console.error("Error deleting role:", deleteError);
      throw new AppError("Failed to delete role.", 500, deleteError);
    }
  },

  async assignOrganizationMemberRole(orgId: string, memberUserId: string, newRoleId: string, operatorUserId: string) {
    // Prevent user from changing their own role
    if (memberUserId === operatorUserId) {
      throw new AppError("Users cannot change their own role.", 403);
    }

    // Step 1: Verify the newRoleId exists within this organization AND is not a system role
    const { data: newRoleData, error: newRoleCheckError } = await supabase
      .from("organization_roles")
      .select("org_role_id, is_system_role")
      .eq("org_id", orgId)
      .eq("org_role_id", newRoleId)
      .single();
    
    if (newRoleCheckError || !newRoleData) {
        throw new AppError("Specified new role not found for this organization.", 400, newRoleCheckError || undefined);
    }
    if (newRoleData.is_system_role) {
      throw new AppError("Cannot assign a system role.", 403);
    }

    // Step 2: Verify the memberUserId is actually a member of this organization AND their current role is not a system role
    const { data: memberData, error: memberCheckError } = await supabase
        .from("organization_members")
        .select("id, org_role_id, roles:organization_roles (is_system_role)")
        .eq("org_id", orgId)
        .eq("user_id", memberUserId)
        .maybeSingle(); 

    if (memberCheckError) {
        console.error(`Error checking membership for user ${memberUserId} in org ${orgId}:`, memberCheckError);
        throw new AppError("Failed to verify user membership.", 500, memberCheckError);
    }
    if (!memberData) {
        throw new AppError(`User ${memberUserId} is not a member of this organization.`, 404);
    }
    
    // Check if the member's current role is a system role
    let currentRoleIsSystem = false;
    if (memberData.roles) {
      const rolesData = memberData.roles as { is_system_role: boolean } | { is_system_role: boolean }[];
      if (Array.isArray(rolesData) && rolesData.length > 0 && rolesData[0]) {
        currentRoleIsSystem = rolesData[0].is_system_role;
      } else if (!Array.isArray(rolesData)) {
        currentRoleIsSystem = rolesData.is_system_role;
      }
    }

    if (currentRoleIsSystem) {
        throw new AppError("Cannot change the role of a member who currently has a system role.", 403);
    }

    // Step 3: Update the member's role
    const { data: updatedMember, error: updateError } = await supabase
      .from("organization_members")
      .update({ org_role_id: newRoleId })
      .eq("org_id", orgId)
      .eq("user_id", memberUserId)
      .select("id, user_id, org_id, org_role_id, updated_at") // Return updated record
      .single();

    if (updateError) {
      console.error(`Error updating role for member ${memberUserId} in org ${orgId}:`, updateError);
      throw new AppError("Failed to update member role.", 500, updateError);
    }
    if (!updatedMember) {
      // This case should be unlikely if the member existence check passed, but handle defensively
      throw new AppError("Failed to update member role, member not found during update.", 404);
    }

    return updatedMember;
  },

  async getUserPermissionsForOrganization(userId: string, orgId: string): Promise<string[]> {
    const { data: memberData, error: memberError } = await supabase
      .from("organization_members")
      .select("org_role_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (memberError) {
      if (memberError.code === "PGRST116") { return []; }
      console.error(`Error fetching user membership for permissions:`, memberError);
      throw new AppError("Failed to verify user membership for permissions.", 500);
    }
    if (!memberData || !memberData.org_role_id) { return []; }

    const { data: permissionsData, error: permissionsError } = await supabase
      .from("organization_role_permissions")
      .select("permission_id")
      .eq("org_role_id", memberData.org_role_id);

    if (permissionsError) {
      console.error(`Error fetching permissions for role:`, permissionsError);
      throw new AppError("Failed to retrieve permissions.", 500);
    }
    return permissionsData ? permissionsData.map(p => p.permission_id) : [];
  },

  async listOrganizationMembers(orgId: string) {
    const { data, error } = await supabase
      .from("organization_members")
      .select(`
        user_id,
        email,
        display_name,
        role_details:organization_roles ( org_role_id, role_name )
      `)
      .eq("org_id", orgId);

    if (error) {
      console.error(`[service] Error fetching members for organization ${orgId}:`, error);
      throw new AppError("Failed to retrieve organization members.", 500, error);
    }
    
    if (!data) {
      console.warn("[service] No data returned from organization members query for orgId:", orgId);
      return [];
    }
    
    return data.map((member, index) => {
      let roleInfo = null;
      const rawRoleData = member.role_details;

      if (Array.isArray(rawRoleData) && rawRoleData.length > 0) {
        roleInfo = rawRoleData[0] as { org_role_id: string; role_name: string };
      } else if (typeof rawRoleData === 'object' && rawRoleData !== null && !Array.isArray(rawRoleData)) {
        roleInfo = rawRoleData as { org_role_id: string; role_name: string };
      }

      if (!roleInfo && member.role_details) {
          console.warn(`[service] Member at index ${index} (user_id: ${member.user_id}) has unparsable role_details. Raw:`, JSON.stringify(rawRoleData));
      }
      
      return {
        userId: member.user_id,
        email: member.email || 'N/A',
        displayName: member.display_name || member.email?.split('@')[0] || 'Anonymous',
        roleId: roleInfo?.org_role_id || 'N/A',
        roleName: roleInfo?.role_name || 'N/A',
      };
    });
  },

  async removeMemberFromOrganization(orgId: string, memberUserIdToRemove: string, operatorUserId: string): Promise<void> {
    // 1. Prevent operator from removing themselves
    if (memberUserIdToRemove === operatorUserId) {
      throw new AppError("Users cannot remove themselves from the organization via this action.", 403);
    }

    // 2. Verify the member exists and check their role (cannot remove if system role)
    const { data: memberData, error: memberCheckError } = await supabase
      .from("organization_members")
      .select("id, org_role_id, role:organization_roles (is_system_role)") // Changed alias to 'role' for consistency
      .eq("org_id", orgId)
      .eq("user_id", memberUserIdToRemove)
      .single(); 

    if (memberCheckError) {
      if (memberCheckError.code === "PGRST116") { 
        throw new AppError(`Member with ID ${memberUserIdToRemove} not found in this organization.`, 404);
      }
      console.error("Error fetching member for removal check:", memberCheckError);
      throw new AppError("Failed to verify member details before removal.", 500, memberCheckError);
    }

    // memberData should exist due to .single() throwing PGRST116 if not found, caught above.
    // if (!memberData) { 
    //     throw new AppError(`Member with ID ${memberUserIdToRemove} not found in this organization.`, 404);
    // }
    
    let memberSystemRole = false;
    if (memberData.role) {
      const roleData = memberData.role as { is_system_role: boolean } | { is_system_role: boolean }[];
      if (Array.isArray(roleData) && roleData.length > 0 && roleData[0]) {
        memberSystemRole = roleData[0].is_system_role;
      } else if (!Array.isArray(roleData)) {
        memberSystemRole = roleData.is_system_role;
      }
    }

    if (memberSystemRole) {
      throw new AppError("Cannot remove a member who has a system role.", 403);
    }

    // 3. Proceed with deletion
    const { error: deleteError } = await supabase
      .from("organization_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", memberUserIdToRemove);

    if (deleteError) {
      console.error("Error removing member from organization:", deleteError);
      throw new AppError("Failed to remove member from organization.", 500, deleteError);
    }
    // Success, no return value needed for void
  }
}; // End of organizationService 