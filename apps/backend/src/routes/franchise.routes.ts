/**
 * Franchise Routes
 *
 * Two route groups:
 *  1. /api/franchise/admin/* — Super Admin manages franchise centers, payouts
 *  2. /api/franchise/*       — Franchise Admin operates their center
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createFranchiseCenterSchema,
  updateFranchiseCenterSchema,
  createPayoutSchema,
  approveKeyRequestSchema,
  rejectKeyRequestSchema,
  directAllocateKeysSchema,
  franchiseCreateBatchSchema,
  franchiseRegisterEnrollSchema,
  franchiseEnrollExistingSchema,
  franchiseRecordOfflinePaymentSchema,
  franchiseRequestKeysSchema,
  franchiseAssignKeySchema,
  franchiseCreateTrainerSchema,
  franchiseUpdateTrainerStatusSchema,
} from "../schemas/index.js";
import {
  // Super Admin: center management
  createFranchiseCenter,
  listFranchiseCenters,
  getFranchiseCenter,
  updateFranchiseCenter,
  deleteFranchiseCenter,
  createPayout,
  listPayouts,
  // Super Admin: key request management
  listPendingKeyRequests,
  approveKeyRequest,
  rejectKeyRequest,
  directAllocateKeys,
  // Franchise Admin: operations
  getMyDashboard,
  listGlobalCourses,
  createBatch,
  listMyBatches,
  registerAndEnrollStudent,
  enrollExistingStudent,
  listMyStudents,
  getMyEarnings,
  recordOfflinePayment,
  // Franchise Admin: key pool
  getMyKeyPools,
  requestKeys,
  listMyKeyRequests,
  getPaymentProofUploadUrl,
  assignKeyToStudent,
  // Franchise Admin: trainers
  createTrainer,
  listTrainers,
  updateTrainerStatus,
} from "../controllers/franchise.controller.js";

// ─── Super Admin Routes (manage franchise centers) ───────────────────────────
const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN));

adminRouter.post("/centers", validateBody(createFranchiseCenterSchema), createFranchiseCenter);
adminRouter.get("/centers", listFranchiseCenters);
adminRouter.get("/centers/:franchiseId", getFranchiseCenter);
adminRouter.put("/centers/:franchiseId", validateBody(updateFranchiseCenterSchema), updateFranchiseCenter);
adminRouter.delete("/centers/:franchiseId", deleteFranchiseCenter);
adminRouter.post("/centers/:franchiseId/payouts", validateBody(createPayoutSchema), createPayout);
adminRouter.get("/centers/:franchiseId/payouts", listPayouts);
adminRouter.get("/key-requests", listPendingKeyRequests);
adminRouter.post("/key-requests/:requestId/approve", validateBody(approveKeyRequestSchema), approveKeyRequest);
adminRouter.post("/key-requests/:requestId/reject", validateBody(rejectKeyRequestSchema), rejectKeyRequest);
adminRouter.post("/centers/:franchiseId/allocate-keys", validateBody(directAllocateKeysSchema), directAllocateKeys);

// Franchise report download
adminRouter.get("/centers/:franchiseId/report", async (req, res, next) => {
  try {
    const { generateFranchiseReport } = await import("../services/franchiseReport.service.js");
    const { csv, filename } = await generateFranchiseReport(req.params.franchiseId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// ─── Franchise Admin Routes (operate their own center) ───────────────────────
const franchiseRouter = Router();
franchiseRouter.use(authMiddleware);
franchiseRouter.use(requireRoles(ROLE.FRANCHISE_ADMIN));

franchiseRouter.get("/dashboard", getMyDashboard);
franchiseRouter.get("/courses", listGlobalCourses);
franchiseRouter.post("/batches", validateBody(franchiseCreateBatchSchema), createBatch);
franchiseRouter.get("/batches", listMyBatches);
franchiseRouter.post("/students/register-enroll", validateBody(franchiseRegisterEnrollSchema), registerAndEnrollStudent);
franchiseRouter.post("/students/enroll", validateBody(franchiseEnrollExistingSchema), enrollExistingStudent);
franchiseRouter.get("/students", listMyStudents);
franchiseRouter.get("/earnings", getMyEarnings);
franchiseRouter.post("/payments/offline", validateBody(franchiseRecordOfflinePaymentSchema), recordOfflinePayment);
franchiseRouter.get("/key-pool", getMyKeyPools);
franchiseRouter.post("/key-requests", validateBody(franchiseRequestKeysSchema), requestKeys);
franchiseRouter.get("/key-requests", listMyKeyRequests);
franchiseRouter.post("/upload-proof", getPaymentProofUploadUrl);
franchiseRouter.post("/students/assign-key", validateBody(franchiseAssignKeySchema), assignKeyToStudent);
franchiseRouter.post("/trainers", validateBody(franchiseCreateTrainerSchema), createTrainer);
franchiseRouter.get("/trainers", listTrainers);
franchiseRouter.patch("/trainers/:trainerId/status", validateBody(franchiseUpdateTrainerStatusSchema), updateTrainerStatus);

export { adminRouter as franchiseAdminRoutes, franchiseRouter as franchiseRoutes };
