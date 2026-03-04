
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";

const router = Router();

router.use(authMiddleware, requireRoles(ROLE.PARENT));

export const parentRoutes = router;
