
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { overrideProgressSchema } from "../schemas/index.js";
import { overrideProgressHandler } from "../controllers/progressOverride.controller.js";

const router = Router();

router.use(authMiddleware, requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN));

router.patch("/override", validateBody(overrideProgressSchema), overrideProgressHandler);

export const progressRoutes = router;
