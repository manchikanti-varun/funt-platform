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

// All authenticated roles can read their own notifications
// (students receive ticket reply notifications, staff receive assignment/leave alerts)
const ALL_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN, ROLE.TRAINER, ROLE.STUDENT, ROLE.PARENT, ROLE.SUPPORT_AGENT, ROLE.FRANCHISE_ADMIN] as const;

router.get("/", requireRoles(...ALL_ROLES), getNotifications);
router.patch("/read-all", requireRoles(...ALL_ROLES), patchMarkAllRead);
router.patch("/:id/read", requireRoles(...ALL_ROLES), patchMarkRead);

export const notificationRoutes = router;
