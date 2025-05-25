import express from "express";
import type { Response, NextFunction } from "express";
import { authenticate, type AuthenticatedRequest } from "../../lib/auth.middleware";
import { validate } from "../../lib/validation";
import { 
  orgHandleParamSchema, 
  departmentIdParamSchema, 
  createDepartmentSchema, 
  updateDepartmentSchema 
} from "./department.validation";
import { departmentService } from "./department.service";
import { AppError } from "../../lib/errors";
import { setOrgIdFromRequest, checkOrganizationMembership } from "../../lib/membership.middleware";
import { checkPermission } from "../../lib/permission.middleware";

// Create a new router instance with mergeParams enabled
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * tags:
 *   name: Departments
 *   description: API endpoints for managing departments within an organization.
 */

// Middleware to handle AppErrors
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

/**
 * @openapi
 * /organizations/{org_handle}/departments:
 *   get:
 *     tags:
 *       - Departments
 *     summary: Get all departments for an organization
 *     description: Retrieves all departments for the specified organization.
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
 *         description: A list of departments.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   department_id:
 *                     type: string
 *                     format: uuid
 *                   org_id:
 *                     type: string
 *                     format: uuid
 *                   department_name:
 *                     type: string
 *       404:
 *         description: Organization not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  authenticate,
  validate.params(orgHandleParamSchema),
  setOrgIdFromRequest,
  checkOrganizationMembership,
  handleErrors(async (req: AuthenticatedRequest, res: Response) => {
    const departments = await departmentService.getAllDepartments(req.params.org_handle!);
    res.json(departments);
  })
);

/**
 * @openapi
 * /organizations/{org_handle}/departments:
 *   post:
 *     tags:
 *       - Departments
 *     summary: Create a new department
 *     description: Creates a new department for the specified organization.
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
 *             type: object
 *             properties:
 *               department_name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: The name of the department
 *             required:
 *               - department_name
 *     responses:
 *       201:
 *         description: Department created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 department_id:
 *                   type: string
 *                   format: uuid
 *                 org_id:
 *                   type: string
 *                   format: uuid
 *                 department_name:
 *                   type: string
 *       400:
 *         description: Validation error or invalid input.
 *       409:
 *         description: Department name already exists.
 *       404:
 *         description: Organization not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  authenticate,
  validate.params(orgHandleParamSchema),
  validate.body(createDepartmentSchema),
  setOrgIdFromRequest,
  checkOrganizationMembership,
  checkPermission("departments:create"),
  handleErrors(async (req: AuthenticatedRequest, res: Response) => {
    const department = await departmentService.createDepartment(req.params.org_handle!, req.body);
    res.status(201).json(department);
  })
);

/**
 * @openapi
 * /organizations/{org_handle}/departments/{department_id}:
 *   put:
 *     tags:
 *       - Departments
 *     summary: Update a department
 *     description: Updates an existing department by its ID for the specified organization.
 *     parameters:
 *       - name: org_handle
 *         in: path
 *         required: true
 *         description: The handle of the organization.
 *         schema:
 *           type: string
 *           pattern: '^[a-z0-9-]+$'
 *       - name: department_id
 *         in: path
 *         required: true
 *         description: The UUID of the department to update.
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               department_name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: The new name of the department
 *             required:
 *               - department_name
 *     responses:
 *       200:
 *         description: Department updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 department_id:
 *                   type: string
 *                   format: uuid
 *                 org_id:
 *                   type: string
 *                   format: uuid
 *                 department_name:
 *                   type: string
 *       400:
 *         description: Validation error or invalid input.
 *       409:
 *         description: Department name already exists.
 *       404:
 *         description: Organization or Department not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:department_id",
  authenticate,
  validate.params(orgHandleParamSchema.merge(departmentIdParamSchema)),
  validate.body(updateDepartmentSchema),
  setOrgIdFromRequest,
  checkOrganizationMembership,
  checkPermission("departments:edit"),
  handleErrors(async (req: AuthenticatedRequest, res: Response) => {
    const department = await departmentService.updateDepartment(
      req.params.org_handle!, 
      req.params.department_id!, 
      req.body
    );
    res.json(department);
  })
);

/**
 * @openapi
 * /organizations/{org_handle}/departments/{department_id}:
 *   delete:
 *     tags:
 *       - Departments
 *     summary: Delete a department
 *     description: Deletes a department by its ID for the specified organization. Cannot delete departments with existing job posts.
 *     parameters:
 *       - name: org_handle
 *         in: path
 *         required: true
 *         description: The handle of the organization.
 *         schema:
 *           type: string
 *           pattern: '^[a-z0-9-]+$'
 *       - name: department_id
 *         in: path
 *         required: true
 *         description: The UUID of the department to delete.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Department deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 department_id:
 *                   type: string
 *                   format: uuid
 *                 org_id:
 *                   type: string
 *                   format: uuid
 *                 department_name:
 *                   type: string
 *       409:
 *         description: Cannot delete department with existing job posts.
 *       404:
 *         description: Organization or Department not found.
 *       500:
 *         description: Internal Server Error.
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:department_id",
  authenticate,
  validate.params(orgHandleParamSchema.merge(departmentIdParamSchema)),
  setOrgIdFromRequest,
  checkOrganizationMembership,
  checkPermission("departments:delete"),
  handleErrors(async (req: AuthenticatedRequest, res: Response) => {
    const department = await departmentService.deleteDepartment(
      req.params.org_handle!, 
      req.params.department_id!
    );
    res.json(department);
  })
);

export default router; 