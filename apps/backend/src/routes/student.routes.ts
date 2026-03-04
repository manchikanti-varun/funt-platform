/**
 * Student routes – course access, assignment submit. Protected by JWT + STUDENT role.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  getBatchCourse,
  getExploreBatches,
  getExploreCourses,
  getMyCourses,
  getCourseByCourseId,
  getGeneralAssignments,
  getAssignmentForStudent,
  getTrainers,
  postMarkModuleComplete,
  postSubmitGlobalAssignment,
  postEnrollmentRequest,
  getMySubmissions,
} from "../controllers/enrollment.controller.js";
import { getMyCertificates, postGenerateMyCertificate } from "../controllers/certificate.controller.js";

const router = Router();

router.use(authMiddleware, requireRoles(ROLE.STUDENT));

router.get("/batches", getExploreBatches);
router.get("/batches/:batchId/course", getBatchCourse);
router.get("/courses", getMyCourses);
router.get("/courses/explore", getExploreCourses);
router.get("/courses/:courseId", getCourseByCourseId);
router.post("/batches/:batchId/progress", postMarkModuleComplete);
router.post("/enrollment-requests", postEnrollmentRequest);
router.get("/assignments/general", getGeneralAssignments);
router.get("/assignments/my-submissions", getMySubmissions);
router.get("/assignments/:assignmentId", getAssignmentForStudent);
router.post("/assignments/general/submit", postSubmitGlobalAssignment);
router.get("/trainers", getTrainers);
router.get("/certificates", getMyCertificates);
router.post("/certificates/generate", postGenerateMyCertificate);

export const studentRoutes = router;
