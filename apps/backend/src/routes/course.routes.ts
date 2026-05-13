
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  reorderModules as reorderChapters,
  updateCourseModule as updateCourseChapter,
  duplicateCourse,
  archiveCourse,
  unarchiveCourse,
  deleteCourse,
} from "../controllers/course.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), createCourse);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listCourses);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getCourse);
router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), updateCourse);
router.patch("/:id/reorder-chapters", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), reorderChapters);
router.patch("/:id/chapters/:index", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), updateCourseChapter);
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateCourse);
router.patch("/:id/archive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), archiveCourse);
router.patch("/:id/unarchive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), unarchiveCourse);
router.delete("/:id", requireRoles(ROLE.SUPER_ADMIN), deleteCourse);

export const courseRoutes = router;
