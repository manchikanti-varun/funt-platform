
import type { ROLE } from "@funt-platform/constants";

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
      user?: {
        userId: string;
        username: string;
        roles: ROLE[];
      };
      /** Set by `parentDelegateAuthMiddleware` — Mongo user id of the student being viewed. */
      parentDelegateStudentId?: string;
    }
  }
}

export {};
