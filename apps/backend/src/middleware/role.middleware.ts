/**
 * Role-based access control middleware.
 * Denies access if request user does not have one of the allowed roles.
 */

import type { Request, Response, NextFunction } from "express";
import type { ROLE } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";

export function requireRoles(...allowedRoles: ROLE[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Unauthorized", 401));
      return;
    }
    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      next(new AppError("Forbidden: insufficient role", 403));
      return;
    }
    next();
  };
}
