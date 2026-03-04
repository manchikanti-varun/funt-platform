/**
 * User routes – protected by JWT.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getMe, getQr } from "../controllers/user.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/me", getMe);
router.get("/:id/qr", getQr);

export const userRoutes = router;
