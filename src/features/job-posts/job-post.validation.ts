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

/**
 * @openapi
 * components:
 *   schemas:
 *     EmploymentTypeEnum:
 *       type: string
 *       enum:
 *         - Full-time
 *         - Part-time
 *         - Contract
 *         - Temporary
 *         - Internship
 *         - Volunteer
 *         - Apprenticeship
 *         - Per Diem
 * 
 *     JobStatusEnum:
 *       type: string
 *       enum:
 *         - draft
 *         - published
 *
 *     JobPost:
 *       type: object
 *       properties:
 *         job_info_id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the job post.
 *         org_id:
 *           type: string
 *           format: uuid
 *           description: Identifier of the organization this job post belongs to.
 *         department_id:
 *           type: string
 *           format: uuid
 *           description: Identifier of the department this job post belongs to.
 *         job_title:
 *           type: string
 *           description: Title of the job.
 *           example: "Senior Software Engineer"
 *         job_description:
 *           type: string
 *           description: Detailed description of the job (can be HTML).
 *           example: "<p>Join our team to build amazing things...</p>"
 *         location:
 *           type: string
 *           description: Location of the job.
 *           example: "Remote / San Francisco, CA"
 *         employment_type:
 *           $ref: '#/components/schemas/EmploymentTypeEnum'
 *         salary:
 *           type: string
 *           description: Salary information or range.
 *           example: "$120,000 - $150,000 per year"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags associated with the job post.
 *           example: ["TypeScript", "Node.js", "React"]
 *         citizenship_requirements:
 *           type: array
 *           items:
 *             type: string
 *           description: Citizenship requirements for the job.
 *         education_level:
 *           type: array
 *           items:
 *             type: string
 *           description: Required education level.
 *         status:
 *           $ref: '#/components/schemas/JobStatusEnum'
 *         applicant_count:
 *           type: integer
 *           description: Number of applicants for this job.
 *           example: 0
 *         comp_specific_label:
 *           type: array
 *           items:
 *             type: string
 *           description: Company-specific labels or categories.
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp of when the job post was created.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp of when the job post was last updated.
 *
 *     CreateJobPostInput: # Corresponds to createJobPostSchema
 *       type: object
 *       required:
 *         - department_id
 *         - job_title
 *         - job_description
 *         - location
 *         - employment_type
 *         - salary
 *         - tags
 *         - citizenship_requirements
 *         - education_level
 *         - comp_specific_label
 *       properties:
 *         department_id:
 *           type: string
 *           format: uuid
 *         job_title:
 *           type: string
 *         job_description:
 *           type: string
 *         location:
 *           type: string
 *         employment_type:
 *           $ref: '#/components/schemas/EmploymentTypeEnum'
 *         salary:
 *           type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         citizenship_requirements:
 *           type: array
 *           items:
 *             type: string
 *         education_level:
 *           type: array
 *           items:
 *             type: string
 *         comp_specific_label:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           $ref: '#/components/schemas/JobStatusEnum'
 *           description: Defaults to 'draft' if not provided.
 *           nullable: true
 *
 *     UpdateJobPostInput: # Corresponds to updateJobPostSchema
 *       type: object
 *       description: All fields are optional for update.
 *       properties:
 *         department_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         job_title:
 *           type: string
 *           nullable: true
 *         job_description:
 *           type: string
 *           nullable: true
 *         location:
 *           type: string
 *           nullable: true
 *         employment_type:
 *           $ref: '#/components/schemas/EmploymentTypeEnum'
 *           nullable: true
 *         salary:
 *           type: string
 *           nullable: true
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         citizenship_requirements:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         education_level:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         comp_specific_label:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         status:
 *           $ref: '#/components/schemas/JobStatusEnum'
 *           nullable: true
 */

