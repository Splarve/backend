import express from "express";
import type { Response, NextFunction } from "express";
import { authenticate, type AuthenticatedRequest } from "../../lib/auth.middleware";
import { currentUserService } from "./currentUser.service";
import { AppError } from "../../lib/errors";

const currentUserRouter = express.Router();

/**
 * @openapi
 * tags:
 *   name: Current User
 *   description: API endpoints related to the authenticated user
 */

/**
 * @openapi
 * /me/organizations/memberships:
 *   get:
 *     summary: Get organization memberships for the current user
 *     tags: [Current User, Organizations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of organizations the user is a member of, with their role.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object # Define OrganizationMembership schema if not already globally available
 *                 properties:
 *                   org_id:
 *                     type: string
 *                     format: uuid
 *                   org_name:
 *                     type: string
 *                   org_handle:
 *                     type: string
 *                   org_logo:
 *                     type: string
 *                     nullable: true
 *                   role_name:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
currentUserRouter.get(
  "/organizations/memberships",
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError("Authentication error: User ID not found.", 401));
      }
      const memberships = await currentUserService.getUserOrganizationMemberships(req.user.id);
      res.status(200).json(memberships);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /me/invitations:
 *   get:
 *     summary: List pending invitations for current user
 *     tags: [Current User, Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of pending invitations for the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserInvitation' # Define UserInvitation schema if not globally available
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
currentUserRouter.get(
  "/invitations",
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.email) {
        return next(new AppError("Authentication error: User email not found.", 401));
      }
      const invitations = await currentUserService.getUserInvitations(req.user.email);
      res.status(200).json(invitations);
    } catch (error) {
      next(error);
    }
  }
);

export { currentUserRouter }; 