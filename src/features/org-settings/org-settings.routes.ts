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

// Create router with mergeParams enabled
const router = express.Router({ mergeParams: true });

// Error handling wrapper (Replicated from job-posts)
const handleErrors = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
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

// GET /api/v1/workspaces/:org_handle/settings
router.get(
    "/",
    validate.params(orgHandleParamSchema),
    handleErrors(async (req: Request, res: Response) => {
        const settings = await orgSettingsService.getOrgSettings(req.params.org_handle!); // Added non-null assertion
        res.json(settings);
    })
);

// PUT /api/v1/workspaces/:org_handle/settings
router.put(
    "/",
    validate.params(orgHandleParamSchema),
    validate.body(updateOrgSettingsSchema),
    handleErrors(async (req: Request, res: Response) => {
        const updatedSettings = await orgSettingsService.updateOrgSettings(
            req.params.org_handle!, // Added non-null assertion
            req.body
        );
        res.json(updatedSettings);
    })
);

// Export the router
export const orgSettingsRouter = router; 