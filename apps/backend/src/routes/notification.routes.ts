import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  getNotifications,
  patchMarkRead,
  patchMarkAllRead,
} from "../controllers/notification.controller.js";

const router = Router();
router.use(authMiddleware);

const ALL_STAFF = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER] as const;

router.get("/", requireRoles(...ALL_STAFF), getNotifications);
router.patch("/read-all", requireRoles(...ALL_STAFF), patchMarkAllRead);
router.patch("/:id/read", requireRoles(...ALL_STAFF), patchMarkRead);

export const notificationRoutes = router;
