
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getMyAchievements, getBadgeTypes } from "../controllers/achievement.controller.js";

const router = Router();

router.get("/badge-types", authMiddleware, getBadgeTypes);
// Any authenticated user can view their own achievements (students see badges, staff see awarded badges)
router.get("/me", authMiddleware, getMyAchievements);

export const achievementRoutes = router;
