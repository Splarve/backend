import { z } from "zod";

export const JobIdParamSchema = z.object({
    id: z.string().uuid('Invalid job ID'),
});

export const createJobPostSchema = z.object({
    org_id : z.string().uuid('Invalid organization ID'),
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required'),
    location: z.string().min(1, 'Location is required'),
    salary_range: z.string().min(1, 'Salary range is required'),
    tags: z.array(z.string()).min(1, 'At least one tag is required'),
    comp_specific_label: z.string().min(1, 'Company-specific label is required')
});

export const updateJobPostSchema = createJobPostSchema.partial()

export type CreateJobPostInput = z.infer<typeof createJobPostSchema>;
export type UpdateJobPostInput = z.infer<typeof updateJobPostSchema>;

