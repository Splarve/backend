import { supabase } from '../../lib/supabase';
import { AppError } from '../../lib/errors';

interface CreateDepartmentInput {
  department_name: string;
}

interface UpdateDepartmentInput {
  department_name: string;
}

interface Department {
  department_id: string;
  org_id: string;
  department_name: string;
}

// Helper function to get organization ID by handle
async function _getOrgIdByHandle(orgHandle: string): Promise<string> {
  const { data, error } = await supabase
    .from('organizations')
    .select('org_id')
    .eq('org_handle', orgHandle)
    .single();

  if (error || !data) {
    throw new AppError('Organization not found', 404, { orgHandle });
  }

  return data.org_id;
}

export const departmentService = {
  async getAllDepartments(orgHandle: string): Promise<Department[]> {
    const orgId = await _getOrgIdByHandle(orgHandle);
    
    const { data, error } = await supabase
      .from('departments')
      .select('department_id, org_id, department_name')
      .eq('org_id', orgId)
      .order('department_name');

    if (error) {
      console.error('Supabase error fetching departments:', error);
      throw new AppError('Failed to fetch departments', 500);
    }

    return data || [];
  },

  async createDepartment(orgHandle: string, input: CreateDepartmentInput): Promise<Department> {
    const orgId = await _getOrgIdByHandle(orgHandle);

    // Check if department name already exists in this organization
    const { data: existingDept, error: checkError } = await supabase
      .from('departments')
      .select('department_id')
      .eq('org_id', orgId)
      .eq('department_name', input.department_name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing department:', checkError);
      throw new AppError('Failed to validate department name', 500);
    }

    if (existingDept) {
      throw new AppError('Department name already exists in this organization', 409, { 
        departmentName: input.department_name 
      });
    }

    const { data, error } = await supabase
      .from('departments')
      .insert({
        org_id: orgId,
        department_name: input.department_name,
      })
      .select('department_id, org_id, department_name')
      .single();

    if (error) {
      console.error('Supabase error creating department:', error);
      if (error.code === '23505') {
        throw new AppError('Department name already exists in this organization', 409);
      }
      throw new AppError('Failed to create department', 500);
    }

    return data;
  },

  async updateDepartment(
    orgHandle: string, 
    departmentId: string, 
    input: UpdateDepartmentInput
  ): Promise<Department> {
    const orgId = await _getOrgIdByHandle(orgHandle);

    // Check if department exists and belongs to the organization
    const { data: existingDept, error: existsError } = await supabase
      .from('departments')
      .select('department_id')
      .eq('department_id', departmentId)
      .eq('org_id', orgId)
      .single();

    if (existsError || !existingDept) {
      throw new AppError('Department not found in this organization', 404, { 
        departmentId, 
        orgHandle 
      });
    }

    // Check if new name conflicts with existing departments (excluding current one)
    const { data: conflictDept, error: conflictError } = await supabase
      .from('departments')
      .select('department_id')
      .eq('org_id', orgId)
      .eq('department_name', input.department_name)
      .neq('department_id', departmentId)
      .single();

    if (conflictError && conflictError.code !== 'PGRST116') {
      console.error('Error checking department name conflict:', conflictError);
      throw new AppError('Failed to validate department name', 500);
    }

    if (conflictDept) {
      throw new AppError('Department name already exists in this organization', 409, { 
        departmentName: input.department_name 
      });
    }

    const { data, error } = await supabase
      .from('departments')
      .update({ department_name: input.department_name })
      .eq('department_id', departmentId)
      .eq('org_id', orgId)
      .select('department_id, org_id, department_name')
      .single();

    if (error) {
      console.error('Supabase error updating department:', error);
      throw new AppError('Failed to update department', 500);
    }

    return data;
  },

  async deleteDepartment(orgHandle: string, departmentId: string): Promise<Department> {
    const orgId = await _getOrgIdByHandle(orgHandle);

    // Check if department has any job posts
    const { count: jobCount, error: jobCountError } = await supabase
      .from('job_info')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', departmentId);

    if (jobCountError) {
      console.error('Error checking job posts for department:', jobCountError);
      throw new AppError('Failed to validate department deletion', 500);
    }

    if (jobCount && jobCount > 0) {
      throw new AppError(
        'Cannot delete department with existing job posts. Please reassign or delete job posts first.', 
        409, 
        { departmentId, jobCount }
      );
    }

    const { data, error } = await supabase
      .from('departments')
      .delete()
      .eq('department_id', departmentId)
      .eq('org_id', orgId)
      .select('department_id, org_id, department_name')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Department not found in this organization', 404, { 
          departmentId, 
          orgHandle 
        });
      }
      console.error('Supabase error deleting department:', error);
      throw new AppError('Failed to delete department', 500);
    }

    return data;
  },
}; 