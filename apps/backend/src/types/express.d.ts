
import type { ROLE } from "@funt-platform/constants";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        roles: ROLE[];
      };
    }
  }
}

export {};
