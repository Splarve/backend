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

/**
 * @openapi
 * tags:
 *   name: Job Posts
 *   description: API endpoints for managing job posts within an organization.
 */

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
/**
 * @openapi
 * /workspaces/{org_handle}/job-posts:
 *   get:
 *     tags:
 *       - Job Posts
 *     summary: Get all job posts for an organization
 *     description: Retrieves a list of all job posts associated with the specified organization handle.
 *     parameters:
 *       - name: org_handle
 *         in: path
 *         required: true
 *         description: The handle of the organization.
 *         schema:
 *           type: string
 *           pattern: '^[a-z0-9-]+$'
 *     responses:
 *       200:
 *         description: A list of job posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/JobPost'
 *       404:
 *         description: Organization not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *     security:
 *       - bearerAuth: []
 */
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
/**
 * @openapi
 * /workspaces/{org_handle}/job-posts/search:
 *   get:
 *     tags:
 *       - Job Posts
 *     summary: Search job posts within an organization
 *     description: Performs a full-text search for job posts based on a query string for the specified organization.
 *     parameters:
 *       - name: org_handle
 *         in: path
 *         required: true
 *         description: The handle of the organization.
 *         schema:
 *           type: string
 *           pattern: '^[a-z0-9-]+$'
 *       - name: q
 *         in: query
 *         required: true
 *         description: The search query string (min 2, max 100 characters).
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           pattern: "^[\\w\\s\\-\\.,'\"!?()&]+$"
 *     responses:
 *       200:
 *         description: A list of matching job posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/JobPost' # Or a specific search result schema if different
 *       400:
 *         description: Invalid search query.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
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
/**
 * @openapi
 * /workspaces/{org_handle}/job-posts/{jobId}:
 *   get:
 *     tags:
 *       - Job Posts
 *     summary: Get a specific job post by ID
 *     description: Retrieves a single job post by its ID for the specified organization.
 *     parameters:
 *       - name: org_handle
 *         in: path
 *         required: true
 *         description: The handle of the organization.
 *         schema:
 *           type: string
 *           pattern: '^[a-z0-9-]+$'
 *       - name: jobId
 *         in: path
 *         required: true
 *         description: The UUID of the job post.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: The requested job post.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobPost'
 *       404:
 *         description: Organization or Job post not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
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
/**
 * @openapi
 * /workspaces/{org_handle}/job-posts:
 *   post:
 *     tags:
 *       - Job Posts
 *     summary: Create a new job post
 *     description: Creates a new job post for the specified organization.
 *     parameters:
 *       - name: org_handle
 *         in: path
 *         required: true
 *         description: The handle of the organization.
 *         schema:
 *           type: string
 *           pattern: '^[a-z0-9-]+$'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateJobPostInput'
 *     responses:
 *       201:
 *         description: Job post created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobPost'
 *       400:
 *         description: Validation error or invalid input (e.g., department not found).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Organization not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
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
/**
 * @openapi
 * /workspaces/{org_handle}/job-posts/{jobId}:
 *   put:
 *     tags:
 *       - Job Posts
 *     summary: Update an existing job post
 *     description: Updates an existing job post by its ID for the specified organization.
 *     parameters:
 *       - name: org_handle
 *         in: path
 *         required: true
 *         description: The handle of the organization.
 *         schema:
 *           type: string
 *           pattern: '^[a-z0-9-]+$'
 *       - name: jobId
 *         in: path
 *         required: true
 *         description: The UUID of the job post to update.
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateJobPostInput'
 *     responses:
 *       200:
 *         description: Job post updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobPost'
 *       400:
 *         description: Validation error or invalid input.
 *       404:
 *         description: Organization or Job post not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
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
/**
 * @openapi
 * /workspaces/{org_handle}/job-posts/{jobId}:
 *   delete:
 *     tags:
 *       - Job Posts
 *     summary: Delete a job post
 *     description: Deletes a job post by its ID for the specified organization.
 *     parameters:
 *       - name: org_handle
 *         in: path
 *         required: true
 *         description: The handle of the organization.
 *         schema:
 *           type: string
 *           pattern: '^[a-z0-9-]+$'
 *       - name: jobId
 *         in: path
 *         required: true
 *         description: The UUID of the job post to delete.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job post deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobPost' # Typically returns the deleted item
 *       204:
 *         description: Job post deleted successfully (No Content).
 *       404:
 *         description: Organization or Job post not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
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