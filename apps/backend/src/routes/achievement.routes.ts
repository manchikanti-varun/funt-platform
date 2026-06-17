
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getMyAchievements, getBadgeTypes } from "../controllers/achievement.controller.js";

const router = Router();

router.get("/badge-types", authMiddleware, getBadgeTypes);
// Any authenticated user can view their own achievements
router.get("/me", authMiddleware, getMyAchievements);
// Legacy alias — LMS frontend uses /my
router.get("/my", authMiddleware, getMyAchievements);

export const achievementRoutes = router;
