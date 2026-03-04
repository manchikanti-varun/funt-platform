/**
 * Profile routes – lookup user by FUNT ID for admin dashboard.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { lookupProfile } from "../controllers/profile.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/lookup", lookupProfile);

export const profileRoutes = router;
