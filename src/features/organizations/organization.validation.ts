import { z } from "zod";
import { sanitizePlainText } from "../../lib/sanitize"; // Assuming sanitizePlainText exists

export const createOrganizationSchema = z.object({
  org_name: z
    .string()
    .min(1, "Organization name is required")
    .max(100, "Organization name must be 100 characters or fewer")
    .transform(sanitizePlainText),
  org_handle: z
    .string()
    .min(3, "Handle must be at least 3 characters long")
    .max(50, "Handle must be 50 characters or fewer")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Handle must be lowercase alphanumeric with hyphens and cannot start/end with a hyphen."
    )
    .transform((val) => val.toLowerCase())
    .refine((val) => !val.startsWith("-") && !val.endsWith("-"), {
      message: "Handle cannot start or end with a hyphen.",
    }),
  org_description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .optional()
    .transform((val) => (val ? sanitizePlainText(val) : undefined)),
  org_logo: z.string().url("Invalid logo URL").optional(),
  org_industry: z
    .string()
    .max(100, "Industry must be 100 characters or fewer")
    .optional()
    .transform((val) => (val ? sanitizePlainText(val) : undefined)),
  org_location: z
    .string()
    .max(100, "Location must be 100 characters or fewer")
    .optional()
    .transform((val) => (val ? sanitizePlainText(val) : undefined)),
  website: z.string().url("Invalid website URL").optional(),
});

export type CreateOrganizationInput = z.infer<
  typeof createOrganizationSchema
>;

export const orgHandleParamSchema = z.object({
  org_handle: z
    .string()
    .min(3, "Handle must be at least 3 characters long")
    .max(50, "Handle must be 50 characters or fewer")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Handle must be lowercase alphanumeric with hyphens and cannot start/end with a hyphen."
    )
    .transform((val) => val.toLowerCase())
    .refine((val) => !val.startsWith("-") && !val.endsWith("-"), {
      message: "Handle cannot start or end with a hyphen.",
    }),
});

export type OrgHandleParams = z.infer<typeof orgHandleParamSchema>;

export const inviteUserSchema = z.object({
  invited_email: z.string().email("Invalid email address for invitation."),
  org_role_id: z.string().uuid("Invalid role ID specified for invitation.") 
  // We use org_role_id directly, assuming the inviting user's client fetches available roles first.
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required."),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const createOrgRoleSchema = z.object({
  role_name: z
    .string()
    .min(1, "Role name is required.")
    .max(50, "Role name must be 50 characters or fewer")
    .transform(sanitizePlainText),
  description: z
    .string()
    .max(255, "Role description must be 255 characters or fewer")
    .optional()
    .transform(val => val ? sanitizePlainText(val) : undefined),
  permission_ids: z.array(z.string().min(1)).min(0, "At least one permission must be assigned, or an empty array if none initially.")
    // Further validation could check if these permission_ids actually exist in app_permissions table (service layer)
});

export type CreateOrgRoleInput = z.infer<typeof createOrgRoleSchema>;

export const updateOrgRoleSchema = z.object({
  role_name: z
    .string()
    .min(1, "Role name is required.")
    .max(50, "Role name must be 50 characters or fewer")
    .transform(sanitizePlainText)
    .optional(),
  description: z
    .string()
    .max(255, "Role description must be 255 characters or fewer")
    .optional()
    .nullable() // Allow explicit null to clear description
    .transform(val => val === null ? null : (val ? sanitizePlainText(val) : undefined)),
  permission_ids: z.array(z.string().min(1))
    .min(0, "Permissions list can be empty to remove all permissions.")
    .optional()
});

export type UpdateOrgRoleInput = z.infer<typeof updateOrgRoleSchema>;

export const orgRoleIdParamSchema = z.object({
  org_role_id: z.string().uuid("Invalid role ID format in path.")
});

export type OrgRoleIdParams = z.infer<typeof orgRoleIdParamSchema>;

export const assignRoleSchema = z.object({
  org_role_id: z.string().uuid("Invalid Role ID format in request body.")
});

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

export const memberUserIdParamSchema = z.object({
  member_user_id: z.string().uuid("Invalid User ID format in path.")
});

export type MemberUserIdParams = z.infer<typeof memberUserIdParamSchema>; 