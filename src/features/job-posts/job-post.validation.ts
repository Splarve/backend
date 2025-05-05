import { z } from "zod";
import { sanitizeHtml, sanitizePlainText } from "../../lib/sanitize";

// --- Parameter Schemas ---

export const orgHandleParamSchema = z.object({
    org_handle: z.string().min(1, 'Organization handle is required').regex(/^[a-z0-9-]+$/, 'Invalid handle format'),
});

export const jobIdParamSchema = z.object({
    jobId: z.string().uuid('Invalid job ID'),
});

// --- Payload Schemas ---

// Define ENUM values based on the database schema
const employmentTypes = [
    'Full-time',
    'Part-time',
    'Contract',
    'Temporary',
    'Internship',
    'Volunteer',
    'Apprenticeship',
    'Per Diem'
] as const; // Use 'as const' for literal types

const jobStatuses = ['draft', 'published'] as const;

export const createJobPostSchema = z.object({
    // org_id is derived from org_handle in the route/service
    department_id: z.string().uuid('Invalid department ID'),
    job_title: z.string().min(1, 'Job title is required').transform(sanitizePlainText),
    job_description: z.string().min(1, 'Job description is required').transform(sanitizeHtml),
    location: z.string().min(1, 'Location is required').transform(sanitizePlainText),
    employment_type: z.enum(employmentTypes),
    salary: z.string().min(1, 'Salary information is required').transform(sanitizePlainText),
    tags: z.array(z.string().transform(sanitizePlainText)).min(1, 'At least one tag is required'),
    citizenship_requirements: z.array(z.string().transform(sanitizePlainText)).min(1, 'Citizenship requirements are required'),
    education_level: z.array(z.string().transform(sanitizePlainText)).min(1, 'Education level is required'),
    comp_specific_label: z.array(z.string().transform(sanitizePlainText)).min(1, 'At least one company-specific label is required'),
    status: z.enum(jobStatuses).optional(), // Default is 'draft' in DB
});

export const updateJobPostSchema = createJobPostSchema.partial().extend({
    // Ensure specific fields cannot be unset during partial update if needed
    // For now, standard partial allows all fields to be optional
});

// --- Query Schemas ---

export const searchQuerySchema = z.object({
  q: z
    .string()
    .min(2, "Search query must be at least 2 characters long")
    .max(100, "Search query must be no more than 100 characters long")
    .trim()
    .refine(q => /^[\w\s\-\.,'"!?()&]+$/i.test(q), {
      message: "Search query contains invalid characters"
    })
});

// --- Exported Types ---

export type OrgHandleParams = z.infer<typeof orgHandleParamSchema>;
export type JobIdParams = z.infer<typeof jobIdParamSchema>;
export type CreateJobPostInput = z.infer<typeof createJobPostSchema>;
export type UpdateJobPostInput = z.infer<typeof updateJobPostSchema>;
export type SearchQueryParams = z.infer<typeof searchQuerySchema>;

