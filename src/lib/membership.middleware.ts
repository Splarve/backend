import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import { supabase } from "./supabase";
import { AppError } from "./errors";

/**
 * Middleware to set org_id on the request object.
 * It can derive org_id from either req.params.org_id directly
 * or by fetching from the organizations table using req.params.org_handle.
 */
export const setOrgIdFromRequest = async (
  req: AuthenticatedRequest & { org_id?: string },
  res: Response,
  next: NextFunction
) => {
  const orgIdFromParams = req.params.org_id;
  const orgHandleFromParams = req.params.org_handle;

  if (orgIdFromParams) {
    req.org_id = orgIdFromParams;
    return next();
  }

  if (orgHandleFromParams) {
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
      req.org_id = orgData.org_id;
      return next();
    } catch (error) {
      console.error("Unexpected error in setOrgIdFromRequest (handle lookup):", error);
      return next(new AppError("Internal server error resolving organization handle.", 500));
    }
  }
  
  // If neither org_id nor org_handle is present in params, it might be an issue with route configuration
  // or the middleware is used inappropriately. For now, we'll pass through but log a warning.
  // Depending on strictness, could throw an error here.
  console.warn("setOrgIdFromRequest: Neither org_id nor org_handle found in request params.");
  return next();
};


/**
 * Middleware to check if an authenticated user is a member of the specified organization.
 * Assumes org_id is available on req.org_id (set by a previous middleware like setOrgIdFromRequest).
 * Assumes user authentication (req.user.id) is handled by a preceding auth middleware.
 */
export const checkOrganizationMembership = async (
  req: AuthenticatedRequest & { org_id?: string },
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.user.id) {
    // This should ideally be caught by the auth.middleware, but good for defense.
    return next(new AppError("User not authenticated.", 401));
  }

  if (!req.org_id) {
    console.error(
      "org_id not found on request. Ensure setOrgIdFromRequest or similar middleware runs before checkOrganizationMembership."
    );
    return next(
      new AppError(
        "Organization context not found for membership check.",
        400 // 400 Bad Request as org_id is essential for this op
      )
    );
  }

  const userId = req.user.id;
  const orgId = req.org_id;

  try {
    const { count, error: memberCheckError } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("user_id", userId);

    if (memberCheckError) {
      console.error("Error checking organization membership:", memberCheckError);
      return next(new AppError("Failed to verify organization membership.", 500));
    }

    if (count && count > 0) {
      return next(); // User is a member
    } else {
      return next(
        new AppError(
          "Forbidden: User is not a member of this organization.",
          403
        )
      );
    }
  } catch (err) {
    console.error("Unexpected error in checkOrganizationMembership middleware:", err);
    return next(new AppError("Internal server error during membership check.", 500));
  }
}; 