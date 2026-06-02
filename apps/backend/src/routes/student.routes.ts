
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
  getStudentMediaPlaybackRedirect,
  getGeneralAssignments,
  getAssignmentForStudent,
  getTrainers,
  postMarkChapterComplete,
  postSubmitGlobalAssignment,
  postEnrollmentRequest,
  getMySubmissions,
} from "../controllers/enrollment.controller.js";
import {
  postRedeemLicense,
  postSubmitPayment,
  getStudentPaymentPending,
  getStudentPaymentTimelineView,
  getMyCoinGrants,
  getCourseCheckout,
  postStudentRazorpayOrder,
  postStudentRazorpayConfirm,
} from "../controllers/studentAccess.controller.js";
import { getMyCertificates, postGenerateMyCertificate } from "../controllers/certificate.controller.js";
import {
  getMyInvoices,
  getMyInvoiceById,
  downloadStudentInvoicePdf,
} from "../controllers/invoice.controller.js";

import { validateBody } from "../middleware/validate.middleware.js";
import { markChapterCompleteSchema, submitAssignmentSchema, enrollmentRequestSchema } from "../schemas/index.js";

const router = Router();

// Media playback uses short-lived signed tokens and may be loaded in cross-site iframes/videos
// where auth cookies are not sent reliably.
router.get("/media/play", getStudentMediaPlaybackRedirect);

router.use(authMiddleware, requireRoles(ROLE.STUDENT));

router.get("/batches", getExploreBatches);
router.get("/batches/:batchId/course", getBatchCourse);
router.get("/courses", getMyCourses);
router.get("/courses/explore", getExploreCourses);
router.get("/courses/:courseId/checkout", getCourseCheckout);
router.get("/courses/:courseId", getCourseByCourseId);
router.post("/batches/:batchId/progress", validateBody(markChapterCompleteSchema), postMarkChapterComplete);
router.post("/batches/:batchId/chapters/progress", validateBody(markChapterCompleteSchema), postMarkChapterComplete);
router.post("/enrollment-requests", validateBody(enrollmentRequestSchema), postEnrollmentRequest);
router.post("/enroll/license", postRedeemLicense);
router.post("/payments/razorpay/order", postStudentRazorpayOrder);
router.post("/payments/razorpay/confirm", postStudentRazorpayConfirm);
router.post("/payments", postSubmitPayment);
router.get("/payments/pending", getStudentPaymentPending);
router.get("/payments/timeline", getStudentPaymentTimelineView);
router.get("/invoices", getMyInvoices);
router.get("/invoices/:id/pdf", downloadStudentInvoicePdf);
router.get("/invoices/:id", getMyInvoiceById);
router.get("/coin-grants", getMyCoinGrants);
router.get("/assignments/general", getGeneralAssignments);
router.get("/assignments/my-submissions", getMySubmissions);
router.get("/assignments/my-chapter-submissions", getMySubmissions);
router.get("/assignments/:assignmentId", getAssignmentForStudent);
router.post("/assignments/general/submit", validateBody(submitAssignmentSchema), postSubmitGlobalAssignment);
router.get("/trainers", getTrainers);
router.get("/certificates", getMyCertificates);
router.post("/certificates/generate", postGenerateMyCertificate);

export const studentRoutes = router;
