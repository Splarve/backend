import express from "express";
import { createJobPostSchema, updateJobPostSchema, jobIdParamSchema } from "./job-post.validation";
import { jobPostService } from "./job-post.service";
import { validate } from "../../lib/validation";
import type { UUID } from "crypto";

export const jobPostRouter = express.Router();

// Get all job posts for an organization
jobPostRouter.get(
  "/org/:orgId",
  async (req, res, next) => {
    try {
      const jobPosts = await jobPostService.getAllJobPosts(req.params.orgId as UUID);
      res.json(jobPosts);
    } catch (error) {
      next(error);
    }
  }
);

// Get job post by ID
jobPostRouter.get(
  "/:id",
  validate.params(jobIdParamSchema),
  async (req, res, next) => {
    try {
      const jobPost = await jobPostService.getJobPostById(req.params.id as string);
      res.json(jobPost);
    } catch (error) {
      next(error);  
    }
  }
);

// Create a new job post
jobPostRouter.post(
  "/",
  validate.body(createJobPostSchema),
  async (req, res, next) => {
    try {
      const newJobPost = await jobPostService.createJobPost(req.body);
      res.status(201).json(newJobPost);
    } catch (error) {
      next(error);
    }
  }
);

// Update a job post
jobPostRouter.put(
  "/:id",
  validate.params(jobIdParamSchema),
  validate.body(updateJobPostSchema),
  async (req, res, next) => {
    try {
      const updatedJobPost = await jobPostService.updateJobPost(req.params.id as string, req.body);
      res.json(updatedJobPost);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a job post
jobPostRouter.delete(
  "/:id",
  validate.params(jobIdParamSchema),
  async (req, res, next) => {
    try {
      const deletedJobPost = await jobPostService.deleteJobPost(req.params.id as string);
      res.json(deletedJobPost);
    } catch (error) {
      next(error);
    }
  }
);