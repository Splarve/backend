import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import { supabase } from "./supabase";
import { AppError } from "./errors";

/**
 * Middleware to check if an authenticated user has a specific permission within an organization.
 * Assumes org_id is available (e.g., fetched from org_handle and attached to req by a previous middleware).
 * Assumes user's roles and permissions are accessible via organization_members and organization_role_permissions.
 */
export const checkPermission = (requiredPermission: string) => {
  return async (
    req: AuthenticatedRequest & { org_id?: string }, // Expect org_id to be on req
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user || !req.user.id) {
      return next(new AppError("User not authenticated.", 401));
    }
    if (!req.org_id) {
      // This middleware relies on a prior middleware to resolve org_handle to org_id
      // and attach it to the request object as req.org_id.
      console.error("org_id not found on request. Ensure a preceding middleware sets it.");
      return next(new AppError("Organization context not found for permission check.", 500));
    }

    const userId = req.user.id;
    const orgId = req.org_id;

    try {
      // Fetch the user's role_id in this organization
      const { data: memberData, error: memberError } = await supabase
        .from("organization_members")
        .select("org_role_id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .single();

      if (memberError || !memberData) {
        if (memberError && memberError.code === "PGRST116") { // Not found
          return next(new AppError("User is not a member of this organization.", 403));
        }
        console.error("Error fetching user membership:", memberError);
        return next(new AppError("Failed to verify user membership.", 500));
      }

      const userOrgRoleId = memberData.org_role_id;

      // Check if this role_id has the required permission
      const { count: permissionCount, error: permissionError } = await supabase
        .from("organization_role_permissions")
        .select("*", { count: "exact", head: true })
        .eq("org_role_id", userOrgRoleId)
        .eq("permission_id", requiredPermission);
      
      if (permissionError) {
        console.error("Error checking role permissions:", permissionError);
        return next(new AppError("Failed to verify permissions.", 500));
      }

      if (permissionCount && permissionCount > 0) {
        return next(); // User has the permission
      } else {
        return next(
          new AppError(
            `Forbidden: User does not have the required '${requiredPermission}' permission.`,
            403
          )
        );
      }
    } catch (err) {
      console.error("Unexpected error in permission middleware:", err);
      return next(new AppError("Internal server error during permission check.", 500));
    }
  };
};

// Middleware to get org_id from org_handle and attach to request
// This should run before checkPermission if org_handle is used in the route
export const setOrgIdFromHandle = async (
    req: AuthenticatedRequest & { org_id?: string }, 
    res: Response, 
    next: NextFunction, 
    orgHandleFromParams: string // Pass req.params.org_handle here
) => {
    if (!orgHandleFromParams) {
        return next(new AppError("Organization handle not provided in path.", 400));
    }
    try {
        const { data: orgData, error: orgFetchError } = await supabase
            .from("organizations")
            .select("org_id")
            .eq("org_handle", orgHandleFromParams)
            .single();

        if (orgFetchError || !orgData) {
            if (orgFetchError && orgFetchError.code === "PGRST116") { // Not found
                return next(new AppError(`Organization with handle '${orgHandleFromParams}' not found.`, 404));
            }
            console.error("Error fetching org_id from handle:", orgFetchError);
            return next(new AppError("Failed to resolve organization handle.", 500));
        }
        req.org_id = orgData.org_id; // Attach org_id to the request object
        next();
    } catch (error) {
        console.error("Unexpected error in setOrgIdFromHandle middleware:", error);
        next(new AppError("Internal server error resolving organization handle.", 500));
    }
}; 