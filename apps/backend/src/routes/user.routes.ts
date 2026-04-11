
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getMe, getQr, patchMe } from "../controllers/user.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/me", getMe);
router.patch("/me", patchMe);
router.get("/:id/qr", getQr);

export const userRoutes = router;
