
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { getMyAchievements, getBadgeTypes } from "../controllers/achievement.controller.js";

const router = Router();

router.get("/badge-types", authMiddleware, getBadgeTypes);
router.get("/me", authMiddleware, requireRoles(ROLE.STUDENT), getMyAchievements);

export const achievementRoutes = router;
