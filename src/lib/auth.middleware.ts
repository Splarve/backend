import type { Request, Response, NextFunction } from "express";
import { supabase } from "./supabase"; // Assuming your Supabase client is exported from here
import { AppError } from "./errors"; // Assuming AppError class for custom errors

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    // Add other user properties you might need from Supabase user object
    aud?: string;
    email?: string;
    // ... any other fields from supabase.auth.User
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AppError("Unauthorized: No token provided", 401)
    );
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return next(new AppError("Unauthorized: Malformed token", 401));
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error("Supabase auth error:", error);
      // Map Supabase specific errors to AppError if needed
      if (error.message === "invalid_token" || error.message === "jwt expired") {
        return next(new AppError(`Unauthorized: ${error.message}`, 401));
      } 
      return next(new AppError("Unauthorized: Error validating token", 401));
    }

    if (!data || !data.user) {
      return next(new AppError("Unauthorized: User not found for token", 401));
    }

    req.user = { 
        id: data.user.id, 
        aud: data.user.aud,
        email: data.user.email,
        // ... map other necessary fields from data.user
    }; 
    next();
  } catch (err) {
    console.error("Unexpected error in auth middleware:", err);
    return next(new AppError("Internal server error during authentication", 500));
  }
}; 