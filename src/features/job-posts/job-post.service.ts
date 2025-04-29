import { supabase } from "../../lib/supabase";
import type { CreateJobPostInput, UpdateJobPostInput } from "./job-post.validation";

export const jobPostService = {
    
    async getJobPostById(
        id: string
    ) {
        const { data, error } = await supabase
            .from("job_info")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    },

    async createJobPost(
        input: CreateJobPostInput
    ) {
        const { data, error } = await supabase
            .from("job_info")
            .insert(input)
            .select("*")
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    },

    async updateJobPost(
        id: string,
        input: UpdateJobPostInput
    ) {
        const { data, error } = await supabase
            .from("job_info")
            .update(input)
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    },

    async deleteJobPost(
        id: string
    ) {
        const { data, error } = await supabase
            .from("job_info")
            .delete()
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    }
}