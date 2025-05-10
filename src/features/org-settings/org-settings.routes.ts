// org-settings.routes.ts
import express from "express";
import {
    orgHandleParamSchema,
    updateOrgSettingsSchema
} from "./org-settings.validation";
import { orgSettingsService } from "./org-settings.service";
import { validate } from "../../lib/validation";
import { AppError } from "../../lib/errors";
import type { Request, Response, NextFunction } from "express";
import { authenticate, type AuthenticatedRequest } from "../../lib/auth.middleware";
import {
  setOrgIdFromRequest,
  checkOrganizationMembership,
} from "../../lib/membership.middleware";
import { checkPermission } from "../../lib/permission.middleware";

// Create router with mergeParams enabled
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * tags:
 *   name: Organization Settings
 *   description: API endpoints for managing organization settings.
 */

// Error handling wrapper (Replicated from job-posts)
const handleErrors = (fn: Function) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
        if (err instanceof AppError) {
            res.status(err.statusCode).json({ error: err.message, context: err.context });
        } else if (err instanceof Error) {
            console.error("Unexpected error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        } else {
            console.error("Unexpected non-error thrown:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });
};

// GET /api/v1/organizations/:org_handle/settings
/**
 * @openapi
 * /organizations/{org_handle}/settings:
 *   get:
 *     tags:
 *       - Organization Settings
 *     summary: Get organization settings
 *     description: Retrieves the settings for the specified organization.
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
 *         description: The organization's settings.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrgSettings'
 *       404:
 *         description: Organization not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error' # Defined in index.ts or a shared schema file
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
    authenticate,
    validate.params(orgHandleParamSchema),
    setOrgIdFromRequest,
    checkOrganizationMembership,
    checkPermission("org:read"),
    handleErrors(async (req: AuthenticatedRequest, res: Response) => {
        const settings = await orgSettingsService.getOrgSettings(req.params.org_handle!); // Added non-null assertion
        res.json(settings);
    })
);

// PUT /api/v1/organizations/:org_handle/settings
/**
 * @openapi
 * /organizations/{org_handle}/settings:
 *   put:
 *     tags:
 *       - Organization Settings
 *     summary: Update organization settings
 *     description: Updates the settings for the specified organization.
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
 *             $ref: '#/components/schemas/UpdateOrgSettingsInput'
 *     responses:
 *       200:
 *         description: Organization settings updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrgSettings'
 *       400:
 *         description: Validation error or invalid input.
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
router.put(
    "/",
    authenticate,
    validate.params(orgHandleParamSchema),
    validate.body(updateOrgSettingsSchema),
    handleErrors(async (req: AuthenticatedRequest, res: Response) => {
        const updatedSettings = await orgSettingsService.updateOrgSettings(
            req.params.org_handle!, // Added non-null assertion
            req.body
        );
        res.json(updatedSettings);
    })
);

// Export the router
export const orgSettingsRouter = router; 