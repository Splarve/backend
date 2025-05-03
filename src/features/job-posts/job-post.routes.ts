import express from "express";
import { orgIdParamSchema, createJobPostSchema, updateJobPostSchema, jobIdParamSchema, searchQuerySchema } from "./job-post.validation";
import { jobPostService } from "./job-post.service";
import { validate } from "../../lib/validation";
import type { Request, Response, NextFunction } from "express";

export const jobPostRouter = express.Router();

// Get all job posts for an organization
jobPostRouter.get(
  "/org/:orgId",
  validate.params(orgIdParamSchema),
  async (req, res, next) => {
    try {
      const jobPosts = await jobPostService.getAllJobPosts(req.params.orgId as string);
      res.json(jobPosts);
    } catch (error) {
      next(error);
    }
  }
);

// Full text search for job posts
// MUST be defined before the /:id route
jobPostRouter.get(
  "/search",
  validate.query(searchQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedQuery = res.locals.validatedQuery as { q: string };
      const q = validatedQuery.q;

      const results = await jobPostService.searchJobPosts(q);
      res.json(results);
    } catch (error) {
      // Intentionally leaving basic error log here for route-level debugging
      // console.error("Error in /search route handler:", error); 
      next(error); // Pass error to the global error handler
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