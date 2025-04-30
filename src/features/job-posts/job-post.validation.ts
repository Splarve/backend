import { z } from "zod";
import { sanitizeHtml, sanitizePlainText } from "../../lib/sanitize";

export const jobIdParamSchema = z.object({
    id: z.string().uuid('Invalid job ID'),
});

export const createJobPostSchema = z.object({
    org_id : z.string().uuid('Invalid organization ID'),
    title: z.string().min(1, 'Title is required').transform(sanitizePlainText),
    description: z.string().min(1, 'Description is required').transform(sanitizeHtml),
    location: z.string().min(1, 'Location is required').transform(sanitizePlainText),
    salary_range: z.string().min(1, 'Salary range is required').transform(sanitizePlainText),
    tags: z.array(z.string().transform(sanitizePlainText)).min(1, 'At least one tag is required'),
    comp_specific_label: z.string().min(1, 'Company-specific label is required').transform(sanitizePlainText)
});

export const updateJobPostSchema = createJobPostSchema.partial()

export type CreateJobPostInput = z.infer<typeof createJobPostSchema>;
export type UpdateJobPostInput = z.infer<typeof updateJobPostSchema>;

