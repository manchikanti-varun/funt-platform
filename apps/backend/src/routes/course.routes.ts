/**
 * Course routes – CRUD, reorder, duplicate, archive. Admin/Super Admin only.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  reorderModules,
  updateCourseModule,
  duplicateCourse,
  archiveCourse,
} from "../controllers/course.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), createCourse);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listCourses);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getCourse);
router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), updateCourse);
router.patch("/:id/reorder", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), reorderModules);
router.patch("/:id/modules/:index", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), updateCourseModule);
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateCourse);
router.patch("/:id/archive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), archiveCourse);

export const courseRoutes = router;
