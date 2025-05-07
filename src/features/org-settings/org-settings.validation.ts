// org-settings.validation.ts
import { z } from "zod";
import { sanitizeHtml, sanitizePlainText } from "../../lib/sanitize";

// --- Parameter Schemas ---

// Replicated from job-posts for now. Consider moving to lib later.
export const orgHandleParamSchema = z.object({
    org_handle: z.string().min(1, 'Organization handle is required').regex(/^[a-z0-9-]+$/, 'Invalid handle format'),
});

// --- Payload Schemas ---

export const updateOrgSettingsSchema = z.object({
    org_name: z.string().min(1, 'Organization name cannot be empty').transform(sanitizePlainText).optional(),
    org_description: z.string().transform(sanitizeHtml).nullish(), // Allow null or string
    org_logo: z.string().url('Invalid URL format for logo').nullish(), // Allow null or valid URL string
    org_industry: z.string().transform(sanitizePlainText).nullish(),
    org_location: z.string().transform(sanitizePlainText).nullish(),
    website: z.string().url('Invalid URL format for website').nullish()
}).partial(); // Removed the .refine() call

// --- Exported Types ---

export type OrgHandleParams = z.infer<typeof orgHandleParamSchema>;
export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;

/**
 * @openapi
 * components:
 *   schemas:
 *     OrgSettings:
 *       type: object
 *       description: Represents the settings for an organization.
 *       properties:
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier of the organization.
 *         org_name:
 *           type: string
 *           description: Name of the organization.
 *           example: "Acme Corp"
 *         org_handle:
 *           type: string
 *           description: Unique handle for the organization.
 *           example: "acme-corp"
 *         org_description:
 *           type: string
 *           nullable: true
 *           description: Description of the organization (can be HTML).
 *           example: "<p>A leading provider of innovative solutions.</p>"
 *         org_logo:
 *           type: string
 *           format: url
 *           nullable: true
 *           description: URL of the organization's logo.
 *           example: "https://example.com/logo.png"
 *         org_industry:
 *           type: string
 *           nullable: true
 *           description: Industry the organization belongs to.
 *           example: "Technology"
 *         org_location:
 *           type: string
 *           nullable: true
 *           description: Location of the organization.
 *           example: "San Francisco, CA"
 *         website:
 *           type: string
 *           format: url
 *           nullable: true
 *           description: URL of the organization's website.
 *           example: "https://acme-corp.example.com"
 *         # Add other fields that are returned by your orgSettingsService.getOrgSettings method
 *
 *     UpdateOrgSettingsInput:
 *       type: object
 *       description: Fields for updating an organization's settings. All fields are optional.
 *       properties:
 *         org_name:
 *           type: string
 *           nullable: true
 *           description: New name for the organization.
 *         org_description:
 *           type: string
 *           nullable: true
 *           description: New description for the organization (can be HTML).
 *         org_logo:
 *           type: string
 *           format: url
 *           nullable: true
 *           description: New URL for the organization's logo.
 *         org_industry:
 *           type: string
 *           nullable: true
 *           description: New industry for the organization.
 *         org_location:
 *           type: string
 *           nullable: true
 *           description: New location for the organization.
 *         website:
 *           type: string
 *           format: url
 *           nullable: true
 *           description: New URL for the organization's website.
 */ 