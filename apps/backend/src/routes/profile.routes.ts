

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { lookupProfile } from "../controllers/profile.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/lookup", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), lookupProfile);

export const profileRoutes = router;
