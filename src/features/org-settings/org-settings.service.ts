// org-settings.service.ts
import { supabase } from "../../lib/supabase";
import type { UpdateOrgSettingsInput } from "./org-settings.validation";
import { AppError } from "../../lib/errors";

// Helper function to get org_id from handle (Replicated from job-posts)
async function _getOrgIdByHandle(orgHandle: string): Promise<string> {
    const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('org_id')
        .eq('org_handle', orgHandle)
        .single();

    if (orgError || !orgData) {
        // Use code PGRADST116? or just a generic message?
        throw new AppError('Organization not found', 404, { handle: orgHandle });
    }
    return orgData.org_id;
}

export const orgSettingsService = {

    async getOrgSettings(orgHandle: string) {
        // Fetch org_id first to ensure the handle exists
        const orgId = await _getOrgIdByHandle(orgHandle);

        // Fetch settings
        const { data, error } = await supabase
            .from("organizations")
            .select(`
                org_id,
                org_name,
                org_handle,
                org_description,
                org_logo,
                org_industry,
                org_location,
                website
            `)
            .eq("org_id", orgId)
            .single();

        if (error) {
             // This case might be redundant if _getOrgIdByHandle worked,
             // but good for safety.
            if (error.code === 'PGRST116') {
                throw new AppError('Organization settings not found', 404, { orgHandle });
            }
            console.error("Supabase error fetching org settings:", error);
            throw new AppError('Failed to fetch organization settings', 500);
        }

        return data;
    },

    async updateOrgSettings(orgHandle: string, input: UpdateOrgSettingsInput) {
        const orgId = await _getOrgIdByHandle(orgHandle);

        const { data, error } = await supabase
            .from("organizations")
            .update(input)
            .eq("org_id", orgId)
            .select(`
                org_id,
                org_name,
                org_handle,
                org_description,
                org_logo,
                org_industry,
                org_location,
                website
            `)
            .single();

        if (error) {
            // PGRST116 might mean not found, or just no change if input matches current data
            if (error.code === 'PGRST116') {
                 throw new AppError('Organization not found or no changes detected', 404, { orgHandle });
            }
            // Handle potential constraint violations (e.g., duplicate name if we add UNIQUE later)
            console.error("Supabase error updating org settings:", error);
            throw new AppError('Failed to update organization settings', 500);
        }

        return data;
    },
}; 