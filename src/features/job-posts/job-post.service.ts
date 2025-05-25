import { supabase } from "../../lib/supabase";
import type { CreateJobPostInput, UpdateJobPostInput } from "./job-post.validation";
import { AppError } from "../../lib/errors"; // Assuming an AppError class for custom errors

// Helper function to get org_id from handle
async function _getOrgIdByHandle(orgHandle: string): Promise<string> {
    const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('org_id')
        .eq('org_handle', orgHandle)
        .single();

    if (orgError || !orgData) {
        throw new AppError('Organization not found', 404, { handle: orgHandle });
    }
    return orgData.org_id;
}

export const jobPostService = {

    async getAllJobPosts(
        orgHandle: string
    ) {
        const orgId = await _getOrgIdByHandle(orgHandle);
        const { data, error } = await supabase
            .from("job_info")
            .select("*") // Consider selecting specific columns for performance
            .eq("org_id", orgId);

        if (error) {
            console.error("Supabase error fetching job posts:", error);
            throw new AppError('Failed to fetch job posts', 500);
        }

        return data;
    },

    async getJobPostById(
        orgHandle: string,
        jobId: string
    ) {
        const orgId = await _getOrgIdByHandle(orgHandle);
        const { data, error } = await supabase
            .from("job_info")
            .select("*") // Consider selecting specific columns
            .eq("job_info_id", jobId)
            .eq("org_id", orgId) // Ensure job belongs to the org
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Not found
                throw new AppError('Job post not found in this organization', 404, { jobId, orgHandle });
            }
            console.error("Supabase error fetching job post:", error);
            throw new AppError('Failed to fetch job post', 500);
        }

        return data;
    },

    async createJobPost(
        orgHandle: string,
        input: CreateJobPostInput
    ) {
        const orgId = await _getOrgIdByHandle(orgHandle);
        const jobData = { ...input, org_id: orgId };

        // Validate that department_id belongs to the orgId
        const { count: deptCount, error: deptError } = await supabase
            .from('departments')
            .select('* ', { count: 'exact', head: true })
            .eq('department_id', input.department_id)
            .eq('org_id', orgId);

        if (deptError || deptCount === 0) {
             throw new AppError('Department not found or does not belong to the organization', 400, { departmentId: input.department_id, orgHandle });
        }

        const { data, error } = await supabase
            .from("job_info")
            .insert(jobData)
            .select("*") // Select columns needed
            .single();

        if (error) {
            console.error("Supabase error creating job post:", error);
            // Add more specific error handling based on potential DB errors (e.g., constraint violations)
            throw new AppError('Failed to create job post', 500);
        }

        return data;
    },

    async updateJobPost(
        orgHandle: string,
        jobId: string,
        input: UpdateJobPostInput
    ) {
        const orgId = await _getOrgIdByHandle(orgHandle);

        // If department_id is being updated, validate it belongs to the org
        if (input.department_id) {
            const { count: deptCount, error: deptError } = await supabase
                .from('departments')
                .select('* ', { count: 'exact', head: true })
                .eq('department_id', input.department_id)
                .eq('org_id', orgId);

            if (deptError || deptCount === 0) {
                 throw new AppError('Department not found or does not belong to the organization', 400, { departmentId: input.department_id, orgHandle });
            }
        }

        const { data, error } = await supabase
            .from("job_info")
            .update(input)
            .eq("job_info_id", jobId)
            .eq("org_id", orgId) // Ensure update happens only for the correct org
            .select("*") // Select columns needed
            .single();

        if (error) {
             if (error.code === 'PGRST116') { // Rows matched = 0
                 throw new AppError('Job post not found in this organization or no changes detected', 404, { jobId, orgHandle });
            }
            console.error("Supabase error updating job post:", error);
            throw new AppError('Failed to update job post', 500);
        }

        return data;
    },

    async deleteJobPost(
        orgHandle: string,
        jobId: string
    ) {
        const orgId = await _getOrgIdByHandle(orgHandle);
        const { data, error } = await supabase
            .from("job_info")
            .delete()
            .eq("job_info_id", jobId)
            .eq("org_id", orgId) // Ensure delete happens only for the correct org
            .select("*") // Select columns needed
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Rows matched = 0
                 throw new AppError('Job post not found in this organization', 404, { jobId, orgHandle });
            }
            console.error("Supabase error deleting job post:", error);
            throw new AppError('Failed to delete job post', 500);
        }

        return data; // Returns the deleted record
    },

    async searchJobPosts(orgHandle: string, query: string) {
        const orgId = await _getOrgIdByHandle(orgHandle);
        // Call the updated RPC function with the orgId filter
        const { data, error } = await supabase.rpc('search_job_posts', {
            search_query: query,
            org_id_filter: orgId
         });

        if (error) {
            console.error("Supabase error searching job posts:", error);
            throw new AppError(`Failed to search job posts`, 500);
        }
        return data || [];
    },

    async getDepartments(orgHandle: string) {
        const orgId = await _getOrgIdByHandle(orgHandle);
        const { data, error } = await supabase
            .from("departments")
            .select("department_id, department_name")
            .eq("org_id", orgId)
            .order("department_name");

        if (error) {
            console.error("Supabase error fetching departments:", error);
            throw new AppError('Failed to fetch departments', 500);
        }

        return data || [];
    }
}