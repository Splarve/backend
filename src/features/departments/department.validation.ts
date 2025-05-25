import { z } from 'zod';

export const orgHandleParamSchema = z.object({
  org_handle: z.string().regex(/^[a-z0-9-]+$/, 'Invalid organization handle format'),
});

export const departmentIdParamSchema = z.object({
  department_id: z.string().uuid('Invalid department ID format'),
});

export const createDepartmentSchema = z.object({
  department_name: z.string()
    .min(1, 'Department name is required')
    .max(100, 'Department name must be less than 100 characters')
    .trim(),
});

export const updateDepartmentSchema = z.object({
  department_name: z.string()
    .min(1, 'Department name is required')
    .max(100, 'Department name must be less than 100 characters')
    .trim(),
}); 