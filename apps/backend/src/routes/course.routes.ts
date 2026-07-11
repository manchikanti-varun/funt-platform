
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { createCourseSchema, updateCourseSchema } from "../schemas/index.js";
import {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  reorderModules as reorderChapters,
  updateCourseModule as updateCourseChapter,
  addChapter,
  removeChapter,
  duplicateCourse,
  archiveCourse,
  unarchiveCourse,
  setLaunchingSoon,
  deleteCourse,
  bulkDeleteCourses,
} from "../controllers/course.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), validateBody(createCourseSchema), createCourse);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listCourses);
router.post("/bulk-delete", requireRoles(ROLE.SUPER_ADMIN), bulkDeleteCourses);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getCourse);
router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), validateBody(updateCourseSchema), updateCourse);
router.patch("/:id/reorder-chapters", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), reorderChapters);
router.patch("/:id/chapters/:index", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), updateCourseChapter);
router.post("/:id/chapters", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), addChapter);
router.delete("/:id/chapters/:index", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), removeChapter);
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateCourse);
router.patch("/:id/archive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), archiveCourse);
router.patch("/:id/unarchive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), unarchiveCourse);
router.patch("/:id/set-launching-soon", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), setLaunchingSoon);
router.delete("/:id", requireRoles(ROLE.SUPER_ADMIN), deleteCourse);

export const courseRoutes = router;
