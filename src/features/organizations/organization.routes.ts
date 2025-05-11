import express from "express";
import type { Response, NextFunction } from "express";
import { authenticate, type AuthenticatedRequest } from "../../lib/auth.middleware";
import { validate } from "../../lib/validation"; // Assuming generic validation middleware
import { createOrganizationSchema, orgHandleParamSchema, inviteUserSchema, acceptInvitationSchema, createOrgRoleSchema, updateOrgRoleSchema, orgRoleIdParamSchema, assignRoleSchema, memberUserIdParamSchema } from "./organization.validation";
import { organizationService } from "./organization.service";
import { AppError } from "../../lib/errors";
import { checkPermission, setOrgIdFromHandle } from "../../lib/permission.middleware"; // Import permission middlewares

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Organizations
 *   description: API endpoints for managing organizations
 */

/**
 * @openapi
 * /organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrganizationInput' 
 *     responses:
 *       201:
 *         description: Organization created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Conflict
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authenticate, // Middleware now provides full user object on req.user
  validate.body(createOrganizationSchema), 
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // req.user should now contain id, email, and user_metadata from the updated authenticate middleware
      if (!req.user || !req.user.id || !req.user.user_metadata) { 
        // Added check for user_metadata for robustness, though email can be null
        console.error("[OrgCreationRoute] User object or essential fields (id, user_metadata) missing after authentication.", req.user);
        return next(new AppError("Authentication error: User details incomplete.", 401));
      }

      const creator = {
        id: req.user.id,
        email: req.user.email, 
        user_metadata: req.user.user_metadata
      };

      const organization = await organizationService.createOrganization(
        req.body, 
        creator
      );
      res.status(201).json(organization);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /organizations/{org_handle}/invitations:
 *   post:
 *     summary: Invite a user to an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: org_handle
 *         required: true
 *         schema:
 *           type: string
 *         description: The handle of the organization to send invitations from
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InviteUserInput' 
 *             # Ensure InviteUserInput is defined in your OpenAPI spec components
 *     responses:
 *       201:
 *         description: Invitation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               # Define your success response schema here (e.g., invitation details)
 *               type: object
 *       400:
 *         description: Invalid input (e.g., email format, role not found in org)
 *       401:
 *         description: Unauthorized (inviter not authenticated)
 *       403:
 *         description: Forbidden (inviter lacks 'members:invite' permission or not part of org)
 *       404:
 *         description: Organization not found
 *       409:
 *         description: Conflict (e.g., active invitation already exists for this email)
 *       500:
 *         description: Internal server error
 */
router.post(
  "/:org_handle/invitations",
  authenticate,                         // 1. Authenticate the user
  validate.params(orgHandleParamSchema), // 2. Validate org_handle from path params *first*
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // 3. Custom middleware to set org_id
    // At this point, req.params.org_handle is validated and should be a string
    setOrgIdFromHandle(req, res, next, req.params.org_handle as string); // Cast to string for safety, though validation should ensure it
  },
  checkPermission("members:invite"),    // 4. Check if inviter has permission (needs req.org_id)
  validate.body(inviteUserSchema),      // 5. Validate invitation payload
  async (req: AuthenticatedRequest & { org_id?: string }, res: Response, next: NextFunction) => { // Adjusted req type slightly for the final handler
    try {
      if (!req.user || !req.user.id) { 
        return next(new AppError("Authentication error: User ID not found.", 401));
      }
      if (!req.org_id) { // Safeguard: org_id should be set by prior middlewares
        return next(new AppError("Organization ID not found on request.", 500));
      }
      const inviterUserId = req.user.id;
      
      const invitation = await organizationService.inviteUserToOrganization(
        req.org_id, 
        inviterUserId,
        req.body 
      );
      res.status(201).json(invitation);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /organizations/{org_handle}/roles:
 *   post:
 *     summary: Create a new role within an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: org_handle
 *         required: true
 *         schema:
 *           type: string
 *         description: The handle of the organization where the role will be created
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrgRoleInput' 
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Invalid input (e.g., role name exists, invalid permission IDs)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user lacks 'roles:create' permission)
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/:org_handle/roles",
  authenticate,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // Middleware to set org_id
    setOrgIdFromHandle(req, res, next, req.params.org_handle as string);
  },
  validate.params(orgHandleParamSchema), // Validate org_handle
  checkPermission("roles:create"),      // Check permission to create roles
  validate.body(createOrgRoleSchema),   // Validate role creation payload
  async (req: AuthenticatedRequest & { org_id?: string }, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) { 
        return next(new AppError("Authentication error: User ID not found.", 401));
      }
      if (!req.org_id) { 
        return next(new AppError("Organization ID not found on request.", 500));
      }
      
      const newRole = await organizationService.createOrganizationRole(
        req.org_id, 
        req.body 
      );
      res.status(201).json(newRole);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /organizations/{org_handle}/roles:
 *   get:
 *     summary: List all roles within an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: org_handle
 *         required: true
 *         schema:
 *           type: string
 *         description: The handle of the organization
 *     responses:
 *       200:
 *         description: A list of organization roles with their permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                  # Define your role object schema here
 *                  type: object 
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user lacks 'members:read' permission)
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:org_handle/roles",
  authenticate,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // Middleware to set org_id
    setOrgIdFromHandle(req, res, next, req.params.org_handle as string);
  },
  validate.params(orgHandleParamSchema), // Validate org_handle
  checkPermission("members:read"),      // Check permission (e.g., members:read or a new roles:read)
  async (req: AuthenticatedRequest & { org_id?: string }, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) { 
        return next(new AppError("Authentication error: User ID not found.", 401));
      }
      if (!req.org_id) { 
        return next(new AppError("Organization ID not found on request.", 500));
      }
      
      const roles = await organizationService.listOrganizationRoles(req.org_id); 
      res.status(200).json(roles);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /organizations/{org_handle}/roles/{org_role_id}:
 *   put:
 *     summary: Update an existing role within an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: org_handle
 *         required: true
 *         schema:
 *           type: string
 *         description: The handle of the organization
 *       - in: path
 *         name: org_role_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateOrgRoleInput' 
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               # Define updated role object schema here
 *               type: object
 *       400:
 *         description: Invalid input (e.g., role name exists, invalid permission IDs, changing system role name)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user lacks 'roles:edit' permission)
 *       404:
 *         description: Organization or Role not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:org_handle/roles/:org_role_id",
  authenticate,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // Middleware to set org_id
    setOrgIdFromHandle(req, res, next, req.params.org_handle as string);
  },
  validate.params(orgHandleParamSchema.merge(orgRoleIdParamSchema)), // Validate both params
  checkPermission("roles:edit"),      // Check permission to edit roles
  validate.body(updateOrgRoleSchema),   // Validate role update payload
  async (req: AuthenticatedRequest & { org_id?: string }, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) { 
        return next(new AppError("Authentication error: User ID not found.", 401));
      }
      if (!req.org_id) { 
        return next(new AppError("Organization ID not found on request.", 500));
      }
      const { org_role_id } = req.params; // Already validated by validate.params

      // Add assertion or check
      if (!org_role_id) {
        // This should technically be caught by validate.params, but belts and braces for TS
        return next(new AppError("Role ID is required in path.", 400));
      }
      
      const updatedRole = await organizationService.updateOrganizationRole(
        req.org_id, 
        org_role_id, // Now guaranteed to be string by the check above
        req.body 
      );
      res.status(200).json(updatedRole);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /organizations/{org_handle}/roles/{org_role_id}:
 *   delete:
 *     summary: Delete a custom role within an organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: org_handle
 *         required: true
 *         schema:
 *           type: string
 *         description: The handle of the organization
 *       - in: path
 *         name: org_role_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the role to delete
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  message: 
 *                    type: string 
 *       400:
 *         description: Bad Request (e.g., trying to delete a system role)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user lacks 'roles:delete' permission)
 *       404:
 *         description: Organization or Role not found
 *       409:
 *         description: Conflict (e.g., role is still assigned to members)
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:org_handle/roles/:org_role_id",
  authenticate,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // Middleware to set org_id
    setOrgIdFromHandle(req, res, next, req.params.org_handle as string);
  },
  validate.params(orgHandleParamSchema.merge(orgRoleIdParamSchema)), // Validate both params
  checkPermission("roles:delete"),      // Check permission to delete roles
  async (req: AuthenticatedRequest & { org_id?: string }, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) { 
        return next(new AppError("Authentication error: User ID not found.", 401));
      }
      if (!req.org_id) { 
        return next(new AppError("Organization ID not found on request.", 500));
      }
      const { org_role_id } = req.params; 
      if (!org_role_id) {
        return next(new AppError("Role ID is required in path.", 400));
      }
      
      const result = await organizationService.deleteOrganizationRole(
        req.org_id, 
        org_role_id
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /organizations/{org_handle}/members/{member_user_id}/role:
 *   put:
 *     summary: Assign or change a member's role within an organization
 *     tags: [Organizations, Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: org_handle
 *         required: true
 *         schema:
 *           type: string
 *         description: The handle of the organization
 *       - in: path
 *         name: member_user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The User ID of the member whose role is being changed
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignRoleInput' 
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               # Define updated member object schema here?
 *               type: object
 *       400:
 *         description: Invalid input (e.g., Role ID not found in org)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user lacks 'roles:assign' permission)
 *       404:
 *         description: Organization or Member or specified Role not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:org_handle/members/:member_user_id/role",
  authenticate,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // Middleware to set org_id
    setOrgIdFromHandle(req, res, next, req.params.org_handle as string);
  },
  validate.params(orgHandleParamSchema.merge(memberUserIdParamSchema)), // Validate path params
  checkPermission("roles:assign"),    // Check permission to assign roles
  validate.body(assignRoleSchema),      // Validate payload (the new role ID)
  async (req: AuthenticatedRequest & { org_id?: string }, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) { 
        return next(new AppError("Authentication error: User ID not found.", 401));
      }
      if (!req.org_id) { 
        return next(new AppError("Organization ID not found on request.", 500));
      }
      const { member_user_id } = req.params; 
      const { org_role_id: newRoleId } = req.body; // The new role to assign

      if (!member_user_id) {
        return next(new AppError("Member User ID is required in path.", 400));
      }
       if (!newRoleId) {
        return next(new AppError("Role ID is required in request body.", 400));
      }
      
      const updatedMembership = await organizationService.assignOrganizationMemberRole(
        req.org_id, 
        member_user_id,
        newRoleId
      );
      res.status(200).json(updatedMembership);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /organizations/{org_handle}/member-permissions:
 *   get:
 *     summary: Get the current authenticated user's permissions for the organization
 *     tags: [Organizations, Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: org_handle
 *         required: true
 *         schema:
 *           type: string
 *         description: The handle of the organization
 *     responses:
 *       200:
 *         description: An array of permission strings for the user in this organization.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["org:read", "members:read", "members:invite"]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user not a member of the organization perhaps - service will return empty array)
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:org_handle/member-permissions",
  authenticate, // Ensure user is logged in
  validate.params(orgHandleParamSchema), // Validate the org_handle
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // Middleware to set org_id
    setOrgIdFromHandle(req, res, next, req.params.org_handle as string);
  },
  // No specific checkPermission here, as we are GETTING permissions, not acting on one.
  // The service layer will correctly return empty if user is not a member.
  async (req: AuthenticatedRequest & { org_id?: string }, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError("Authentication error: User ID not found.", 401));
      }
      if (!req.org_id) {
        return next(new AppError("Organization ID not found on request.", 500));
      }

      const permissions = await organizationService.getUserPermissionsForOrganization(
        req.user.id,
        req.org_id
      );
      res.status(200).json(permissions);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /organizations/{org_handle}/members:
 *   get:
 *     summary: List all members of an organization
 *     tags: [Organizations, Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: org_handle
 *         required: true
 *         schema:
 *           type: string
 *         description: The handle of the organization
 *     responses:
 *       200:
 *         description: An array of organization members with their user details and roles.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId: 
 *                     type: string
 *                     format: uuid
 *                   email:
 *                     type: string
 *                     format: email
 *                   displayName:
 *                     type: string
 *                     description: The display name of the member.
 *                   last_active_status:
 *                     type: string
 *                     description: The last active status/date of the member (e.g., YYYY-MM-DD).
 *                   roleId:
 *                     type: string
 *                     format: uuid
 *                   roleName:
 *                     type: string
 *                 example:
 *                   - userId: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "member1@example.com"
 *                     displayName: "Member One"
 *                     last_active_status: "10/26/2023"
 *                     roleId: "abcdef01-e89b-12d3-a456-426614174000"
 *                     roleName: "Editor"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (user lacks 'members:read' permission)
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:org_handle/members",
  authenticate,                         
  validate.params(orgHandleParamSchema), 
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { 
    setOrgIdFromHandle(req, res, next, req.params.org_handle as string);
  },
  checkPermission("members:read"),    
  async (req: AuthenticatedRequest & { org_id?: string }, res: Response, next: NextFunction) => {
    try {
      if (!req.org_id) { 
        return next(new AppError("Organization ID not found on request.", 500));
      }
      
      const members = await organizationService.listOrganizationMembers(req.org_id);
      res.status(200).json(members);
    } catch (error) {
      next(error);
    }
  }
);

// This new router will handle global invitation actions like accepting/declining
// It's separate because it's not tied to a specific organization context via org_handle in the path
// for the person *accepting* the invite.
const invitationActionsRouter = express.Router(); 

/**
 * @openapi
 * tags:
 *   name: Invitations
 *   description: API endpoints for managing organization invitations (accepting/declining)
 */

/**
 * @openapi
 * /invitations/accept:
 *   post:
 *     summary: Accept an organization invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: [] # User must be authenticated to accept
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcceptInvitationInput' 
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *       400:
 *         description: Invalid input (e.g., missing token)
 *       401:
 *         description: Unauthorized (user not authenticated)
 *       403:
 *         description: Forbidden (e.g., email mismatch)
 *       404:
 *         description: Invitation not found or invalid
 *       409:
 *         description: Conflict (e.g., invitation already used, or user already a member)
 *       410:
 *         description: Invitation expired
 *       500:
 *         description: Internal server error
 */
invitationActionsRouter.post(
  "/accept",
  authenticate, // User must be logged in to accept
  validate.body(acceptInvitationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id || !req.user.email) {
        return next(new AppError("Authentication error: User ID or email not found.", 401));
      }
      const { token } = req.body;
      const result = await organizationService.acceptInvitation(
        token,
        req.user.id,
        req.user.email
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /invitations/decline:
 *   post:
 *     summary: Decline an organization invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: [] # User must be authenticated to decline
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcceptInvitationInput' # Reusing schema for token
 *     responses:
 *       200:
 *         description: Invitation declined successfully
 *       400:
 *         description: Invalid input (e.g., missing token)
 *       401:
 *         description: Unauthorized (user not authenticated)
 *       403:
 *         description: Forbidden (e.g., email mismatch)
 *       404:
 *         description: Invitation not found or invalid
 *       409:
 *         description: Conflict (e.g., invitation not pending)
 *       410:
 *         description: Invitation expired
 *       500:
 *         description: Internal server error
 */
invitationActionsRouter.post(
  "/decline",
  authenticate, // User must be logged in to decline
  validate.body(acceptInvitationSchema), // Reusing schema as it just needs the token
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.email) { // User and their email are needed for verification
        return next(new AppError("Authentication error: User email not found.", 401));
      }
      const { token } = req.body;
      const result = await organizationService.declineInvitation(
        token,
        req.user.email
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Mount this new router in your main app (index.ts) under a suitable path like /api/v1/invitations

const appPermissionsRouter = express.Router(); // New router for app-level permissions

/**
 * @openapi
 * tags:
 *   name: Application Permissions
 *   description: API endpoints for listing available application permissions
 */

/**
 * @openapi
 * /app-permissions:
 *   get:
 *     summary: List all available application permissions
 *     tags: [Application Permissions]
 *     security:
 *       - bearerAuth: [] # Authenticated users can see available permissions
 *     responses:
 *       200:
 *         description: A list of application permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   permission_id: 
 *                     type: string
 *                   description:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
appPermissionsRouter.get(
    "/", 
    authenticate, 
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const permissions = await organizationService.listAppPermissions();
        res.status(200).json(permissions);
    } catch (error) {
        next(error);
    }
});

// Modify the existing export to potentially include the new router if it's kept in this file,
// or export it separately.
// For now, assuming organizationRouter is the main export from this file.
export { router as organizationRouter, invitationActionsRouter, appPermissionsRouter }; 