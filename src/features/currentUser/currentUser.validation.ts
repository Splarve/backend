// currentUser.validation.ts
// This file will contain Zod schemas for validating request inputs
// (e.g., body, params, query) for routes in the currentUser feature.

// Currently, the existing GET routes in currentUser.routes.ts derive their necessary
// parameters from the authenticated user session (req.user) and do not have
// additional inputs that require explicit Zod schema validation via middleware.

// Example (if we were to add a route that needs it):
// import { z } from 'zod';
// export const someCurrentUserSchema = z.object({
//   someProperty: z.string().min(1),
// }); 

import { z } from "zod";

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
}); 