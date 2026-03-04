/**
 * Skill profile routes – my profile (student), or by studentId (admin).
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { getMySkillProfile, getSkillProfile } from "../controllers/skillProfile.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/me", requireRoles(ROLE.STUDENT), getMySkillProfile);
router.get("/:studentId", getSkillProfile);

export const skillProfileRoutes = router;
