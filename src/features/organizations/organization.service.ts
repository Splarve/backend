import { supabase } from "../../lib/supabase";
import { AppError } from "../../lib/errors";
import type { CreateOrganizationInput, InviteUserInput, CreateOrgRoleInput, UpdateOrgRoleInput, AssignRoleInput } from "./organization.validation";
import crypto from "crypto";

// Define the name for the default admin role for new organizations
const DEFAULT_ORG_ADMIN_ROLE_NAME = "Owner";
const DEFAULT_ORG_MEMBER_ROLE_NAME = "Member"; // New default role
const INVITATION_EXPIRY_HOURS = 72; // Invitations expire in 3 days

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

    // Step 2a: Check if the invited_email corresponds to an existing user in auth.users
    // and if so, if they are already an active member of this organization.
    let foundAuthUserId: string | null = null;
    const lowercasedInvitedEmail = inviteInput.invited_email.toLowerCase();

    // Query auth.users table directly using the service role client
    const { data: existingUser, error: userQueryError } = await supabase
      .from("users") // This targets the auth.users table
      .select("id")
      .eq("email", lowercasedInvitedEmail)
      .maybeSingle(); // Returns one row or null, doesn't error if not found

    if (userQueryError) {
      // Log the error but don't necessarily throw if it's just about not finding the user
      // unless it's an actual unexpected database error.
      // This check might need refinement based on how critical an actual DB error is here vs. user not found.
      console.error("Error querying auth.users by email:", userQueryError);
      throw new AppError("Failed to verify invited user details due to a database error.", 500, userQueryError);
    }

    if (existingUser && existingUser.id) {
      foundAuthUserId = existingUser.id;
      // User exists in Supabase Auth, now check if they are already a member of this organization
      const { count: memberCount, error: memberCheckError } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("user_id", foundAuthUserId);

      if (memberCheckError) {
        console.error("Error checking active membership for existing user:", memberCheckError);
        throw new AppError("Failed to verify existing membership.", 500, memberCheckError);
      }

      if (memberCount && memberCount > 0) {
        throw new AppError(
          `${inviteInput.invited_email} is already an active member of this organization.`,
          409 // Conflict
        );
      }
    }
    // If user not found in auth, or found but not a member, proceed to check pending invites.

    // Step 2b: Check for existing PENDING invitations for this email in this org
    const { count: existingInviteCount, error: inviteCheckError } = await supabase
      .from("organization_invitations")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("invited_email", lowercasedInvitedEmail) 
      .eq("status", "pending");
    
    if (inviteCheckError) {
      console.error("Error checking for existing pending invitations:", inviteCheckError);
      throw new AppError("Failed to check for existing invitations.", 500, inviteCheckError);
    }

    if (existingInviteCount && existingInviteCount > 0) {
      throw new AppError(
        `An active invitation already exists for ${lowercasedInvitedEmail} for this organization.`,
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
        invited_email: lowercasedInvitedEmail, // Store email in lowercase
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

    // Step 3: Verify the accepting user is the one invited
    // The acceptingUserId comes from the JWT of the logged-in user.
    // The invitation.invited_email is the email that was invited.
    // If the invited_email doesn't match the logged-in user's email, it could be:
    //   a) An attempt to hijack an invite (if the logged-in user isn't the intended recipient).
    //   b) The invited_email is for a new user who just signed up with that email.
    if (invitation.invited_email.toLowerCase() !== acceptingUserEmail.toLowerCase()) {
      throw new AppError(
        "Email mismatch: This invitation is intended for a different email address.",
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

    // Step 3: Verify the declining user is the one invited
    if (invitation.invited_email.toLowerCase() !== decliningUserEmail.toLowerCase()) {
      throw new AppError(
        "Email mismatch: This invitation is intended for a different email address.",
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

  async createOrganizationRole(orgId: string, input: CreateOrgRoleInput) {
    // Step 1: Validate that all provided permission_ids exist in app_permissions
    if (input.permission_ids && input.permission_ids.length > 0) {
      const { data: existingPermissions, error: permCheckError } = await supabase
        .from("app_permissions")
        .select("permission_id")
        .in("permission_id", input.permission_ids);

      if (permCheckError) {
        console.error("Error validating permission IDs:", permCheckError);
        throw new AppError("Failed to validate permissions.", 500, permCheckError);
      }
      if (existingPermissions.length !== input.permission_ids.length) {
        const foundIds = existingPermissions.map(p => p.permission_id);
        const notFoundIds = input.permission_ids.filter(id => !foundIds.includes(id));
        throw new AppError(`Invalid permission IDs provided: ${notFoundIds.join(", ")}.`, 400);
      }
    }

    // Step 2: Create the role in organization_roles (transaction recommended)
    let newRoleData: { org_role_id: string; role_name: string; created_at: string; } | undefined;
    try {
      const { data: roleData, error: roleError } = await supabase
        .from("organization_roles")
        .insert({
          org_id: orgId,
          role_name: input.role_name,
          // description: input.description, // Add if description is in your table schema for organization_roles
          is_system_role: false, // Custom roles are not system roles
        })
        .select("org_role_id, role_name, created_at")
        .single();

      if (roleError) {
        if (roleError.code === '23505') { // Unique constraint violation (org_id, role_name)
            throw new AppError(`Role name '${input.role_name}' already exists in this organization.`, 409);
        }
        console.error("Error creating organization role:", roleError);
        throw new AppError("Failed to create role.", 500, roleError);
      }
      if (!roleData) {
        throw new AppError("Failed to create role, no data returned.", 500);
      }
      newRoleData = roleData;

      // Step 3: Assign permissions to the new role in organization_role_permissions
      if (input.permission_ids && input.permission_ids.length > 0 && newRoleData) {
        const rolePermissionsToInsert = input.permission_ids.map((permissionId) => ({
          org_role_id: newRoleData!.org_role_id,
          permission_id: permissionId,
        }));

        const { error: assignPermError } = await supabase
          .from("organization_role_permissions")
          .insert(rolePermissionsToInsert);

        if (assignPermError) {
          console.error("Error assigning permissions to new role:", assignPermError);
          // IMPORTANT: Rollback role creation here if in a transaction
          throw new AppError("Role created, but failed to assign permissions.", 500, assignPermError);
        }
      }
    } catch (error) {
        // If any part of the transaction fails, rethrow
        // Ideally, a real DB transaction would handle rollback.
        throw error;
    }

    if (!newRoleData) {
        throw new AppError("Role data was not properly finalized.", 500);
    }

    return {
        ...newRoleData,
        assigned_permissions: input.permission_ids || [] 
        // description: input.description // include if added to select/return
    };
  },

  async listOrganizationRoles(orgId: string) {
    const { data: roles, error } = await supabase
      .from("organization_roles")
      .select(`
        org_role_id,
        role_name,
        is_system_role,
        created_at,
        updated_at,
        organization_role_permissions ( permission_id )
      `)
      .eq("org_id", orgId);

    if (error) {
      console.error(`Error fetching roles for organization ${orgId}:`, error);
      throw new AppError("Failed to retrieve organization roles.", 500, error || undefined);
    }

    return (roles || []).map(role => ({
        ...role,
        // Simplify the permissions structure if needed, e.g., just an array of permission_ids
        permissions: role.organization_role_permissions.map((p: any) => p.permission_id)
    }));
  },

  async updateOrganizationRole(orgId: string, orgRoleId: string, input: UpdateOrgRoleInput) {
    // Step 0: Fetch the role to ensure it belongs to the org and is not a system role if trying to change crucial aspects
    const { data: existingRole, error: fetchRoleError } = await supabase
      .from("organization_roles")
      .select("org_role_id, is_system_role, role_name")
      .eq("org_id", orgId)
      .eq("org_role_id", orgRoleId)
      .single();

    if (fetchRoleError || !existingRole) {
      throw new AppError("Role not found in this organization.", 404, fetchRoleError || undefined);
    }

    // Prevent renaming system roles or changing their fundamental nature if needed.
    // For now, we allow changing description and permissions of system roles if input allows.
    if (existingRole.is_system_role && input.role_name && input.role_name !== existingRole.role_name) {
        throw new AppError("System role names cannot be changed.", 400);
    }

    // Step 1: Validate new permission_ids if provided
    if (input.permission_ids) { // This covers empty array too (for removing all permissions)
      if (input.permission_ids.length > 0) {
        const { data: existingPermissions, error: permCheckError } = await supabase
          .from("app_permissions")
          .select("permission_id")
          .in("permission_id", input.permission_ids);

        if (permCheckError) {
          console.error("Error validating permission IDs for update:", permCheckError);
          throw new AppError("Failed to validate permissions for update.", 500, permCheckError);
        }
        if (existingPermissions.length !== input.permission_ids.length) {
          const foundIds = existingPermissions.map(p => p.permission_id);
          const notFoundIds = input.permission_ids.filter(id => !foundIds.includes(id));
          throw new AppError(`Invalid permission IDs provided for update: ${notFoundIds.join(", ")}.`, 400);
        }
      }
    }

    // Step 2: Update role details (name, description) in organization_roles
    // This needs to be in a transaction with permission changes
    const roleUpdatePayload: { role_name?: string; description?: string | null } = {};
    if (input.role_name !== undefined) {
      roleUpdatePayload.role_name = input.role_name;
    }
    if (input.description !== undefined) { // Allows setting description to null or a new string
      roleUpdatePayload.description = input.description;
    }

    if (Object.keys(roleUpdatePayload).length > 0) {
      const { error: updateRoleDetailsError } = await supabase
        .from("organization_roles")
        .update(roleUpdatePayload)
        .eq("org_role_id", orgRoleId);

      if (updateRoleDetailsError) {
        if (updateRoleDetailsError.code === '23505') { // Unique constraint (org_id, role_name)
            throw new AppError(`Role name '${input.role_name}' already exists in this organization.`, 409);
        }
        console.error("Error updating role details:", updateRoleDetailsError);
        throw new AppError("Failed to update role details.", 500, updateRoleDetailsError);
      }
    }

    // Step 3: Update permissions if permission_ids are provided in the input
    // This means replacing all existing permissions for the role with the new set.
    if (input.permission_ids !== undefined) {
      // Delete existing permissions for this role
      const { error: deletePermsError } = await supabase
        .from("organization_role_permissions")
        .delete()
        .eq("org_role_id", orgRoleId);

      if (deletePermsError) {
        console.error("Error deleting old permissions for role update:", deletePermsError);
        throw new AppError("Failed to update role permissions (cleanup failed).", 500, deletePermsError);
      }

      // Insert new permissions if any
      if (input.permission_ids.length > 0) {
        const newRolePermissionsToInsert = input.permission_ids.map((permissionId) => ({
          org_role_id: orgRoleId,
          permission_id: permissionId,
        }));

        const { error: assignNewPermsError } = await supabase
          .from("organization_role_permissions")
          .insert(newRolePermissionsToInsert);

        if (assignNewPermsError) {
          console.error("Error assigning new permissions for role update:", assignNewPermsError);
          // Data inconsistency: role details might be updated, but permissions failed.
          // Transaction essential here.
          throw new AppError("Failed to assign new permissions to role.", 500, assignNewPermsError);
        }
      }
    }

    // Refetch the updated role to return it
    const { data: updatedRoleData, error: refetchError } = await supabase
      .from("organization_roles")
      .select(`org_role_id, role_name, is_system_role, created_at, updated_at, organization_role_permissions ( permission_id )`)
      .eq("org_role_id", orgRoleId)
      .single();

    if (refetchError || !updatedRoleData) {
        console.error("Failed to refetch updated role:", refetchError);
        throw new AppError("Role updated, but failed to retrieve latest state.", 500, refetchError || undefined);
    }
    
    return {
        ...updatedRoleData,
        permissions: updatedRoleData.organization_role_permissions.map((p: any) => p.permission_id)
    };
  },

  async deleteOrganizationRole(orgId: string, orgRoleId: string) {
    // Step 1: Fetch the role to ensure it belongs to the org and is not a system role
    const { data: existingRole, error: fetchRoleError } = await supabase
      .from("organization_roles")
      .select("org_role_id, is_system_role, role_name")
      .eq("org_id", orgId)
      .eq("org_role_id", orgRoleId)
      .single();

    if (fetchRoleError || !existingRole) {
      throw new AppError("Role not found in this organization.", 404, fetchRoleError || undefined);
    }

    // Step 2: Prevent deletion of system roles
    if (existingRole.is_system_role) {
      throw new AppError(`System role '${existingRole.role_name}' cannot be deleted.`, 400);
    }

    // Step 3: Check if any members are currently assigned this role
    const { count: memberCount, error: memberCheckError } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId) // Redundant check but good practice
      .eq("org_role_id", orgRoleId);

    if (memberCheckError) {
      console.error(`Error checking members assigned to role ${orgRoleId}:`, memberCheckError);
      throw new AppError("Failed to check role assignments.", 500, memberCheckError);
    }

    if (memberCount && memberCount > 0) {
      throw new AppError(
        `Cannot delete role '${existingRole.role_name}' as it is currently assigned to ${memberCount} member(s). Please reassign members first.`,
        409 // Conflict
      );
    }

    // Step 4: Delete the role (permissions associated will cascade delete due to FK constraint)
    // Transaction recommended if more cleanup steps were needed.
    const { error: deleteError } = await supabase
      .from("organization_roles")
      .delete()
      .eq("org_role_id", orgRoleId);

    if (deleteError) {
      console.error(`Error deleting role ${orgRoleId}:`, deleteError);
      throw new AppError("Failed to delete role.", 500, deleteError);
    }

    return { message: `Role '${existingRole.role_name}' deleted successfully.` };
  },

  async assignOrganizationMemberRole(orgId: string, memberUserId: string, newRoleId: string) {
    // Step 1: Verify the newRoleId exists within this organization
    const { data: roleData, error: roleCheckError } = await supabase
      .from("organization_roles")
      .select("org_role_id")
      .eq("org_id", orgId)
      .eq("org_role_id", newRoleId)
      .single();
    
    if (roleCheckError || !roleData) {
        throw new AppError("Specified role not found for this organization.", 400, roleCheckError || undefined);
    }

    // Step 2: Verify the memberUserId is actually a member of this organization
    // We update the record, so Supabase update with eq filters handles this implicitly,
    // but an explicit check can give a clearer 404.
    const { data: memberData, error: memberCheckError } = await supabase
        .from("organization_members")
        .select("id") // Just need to know if they exist
        .eq("org_id", orgId)
        .eq("user_id", memberUserId)
        .maybeSingle(); // Use maybeSingle to not error on not found

    if (memberCheckError) {
        console.error(`Error checking membership for user ${memberUserId} in org ${orgId}:`, memberCheckError);
        throw new AppError("Failed to verify user membership.", 500, memberCheckError);
    }
    if (!memberData) {
        throw new AppError(`User ${memberUserId} is not a member of this organization.`, 404);
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
  }
}; // End of organizationService 