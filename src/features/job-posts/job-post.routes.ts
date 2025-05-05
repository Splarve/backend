import express from "express";
import {
    orgHandleParamSchema,
    jobIdParamSchema,
    createJobPostSchema,
    updateJobPostSchema,
    searchQuerySchema
} from "./job-post.validation";
import { jobPostService } from "./job-post.service";
import { validate } from "../../lib/validation";
import { AppError } from "../../lib/errors";
import type { Request, Response, NextFunction } from "express";

// Create a new router instance with mergeParams enabled
const router = express.Router({ mergeParams: true });

// Define the base path for this feature router
// All routes defined here will be prefixed with /workspaces/:org_handle/job-posts
// mergeParams: true allows this router to access :org_handle from the mount point

// Middleware to handle AppErrors
const handleErrors = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
        if (err instanceof AppError) {
            res.status(err.statusCode).json({ error: err.message, context: err.context });
        } else if (err instanceof Error) {
            // Log unexpected errors
            console.error("Unexpected error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        } else {
            // Handle non-Error exceptions
            console.error("Unexpected non-error thrown:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });
};

// Get all job posts for the workspace
router.get(
  "/",
  validate.params(orgHandleParamSchema),
  handleErrors(async (req: Request, res: Response) => {
    const jobPosts = await jobPostService.getAllJobPosts(req.params.org_handle!);
    res.json(jobPosts);
  })
);

// Full text search for job posts within the workspace
// IMPORTANT: Search route must be defined before routes with specific IDs like /:jobId
router.get(
  "/search",
  validate.params(orgHandleParamSchema),
  validate.query(searchQuerySchema),
  handleErrors(async (req: Request, res: Response) => {
    const { org_handle } = req.params;
    const validatedQuery = res.locals.validatedQuery as { q: string };
    const results = await jobPostService.searchJobPosts(org_handle!, validatedQuery.q);
    res.json(results);
  })
);

// Get specific job post by ID within the workspace
router.get(
  "/:jobId",
  validate.params(orgHandleParamSchema.merge(jobIdParamSchema)),
  handleErrors(async (req: Request, res: Response) => {
    const { org_handle, jobId } = req.params;
    const jobPost = await jobPostService.getJobPostById(org_handle!, jobId!);
    res.json(jobPost);
  })
);

// Create a new job post within the workspace
router.post(
  "/",
  validate.params(orgHandleParamSchema),
  validate.body(createJobPostSchema),
  handleErrors(async (req: Request, res: Response) => {
    const { org_handle } = req.params;
    const newJobPost = await jobPostService.createJobPost(org_handle!, req.body);
    res.status(201).json(newJobPost);
  })
);

// Update a job post within the workspace
router.put(
  "/:jobId",
  validate.params(orgHandleParamSchema.merge(jobIdParamSchema)),
  validate.body(updateJobPostSchema),
  handleErrors(async (req: Request, res: Response) => {
    const { org_handle, jobId } = req.params;
    const updatedJobPost = await jobPostService.updateJobPost(org_handle!, jobId!, req.body);
    res.json(updatedJobPost);
  })
);

// Delete a job post within the workspace
router.delete(
  "/:jobId",
  validate.params(orgHandleParamSchema.merge(jobIdParamSchema)),
  handleErrors(async (req: Request, res: Response) => {
    const { org_handle, jobId } = req.params;
    const deletedJobPost = await jobPostService.deleteJobPost(org_handle!, jobId!);
    res.json(deletedJobPost);
  })
);

// Export the router to be mounted in the main application file
export const jobPostRouter = router;