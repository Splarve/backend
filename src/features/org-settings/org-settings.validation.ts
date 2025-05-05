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