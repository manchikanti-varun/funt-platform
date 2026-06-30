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
import { ROLE } from "@funt-platform/constants";
import {
  // Super Admin: center management
  createFranchiseCenter,
  listFranchiseCenters,
  getFranchiseCenter,
  updateFranchiseCenter,
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
  // Franchise Admin: trainers
  createTrainer,
  listTrainers,
  updateTrainerStatus,
} from "../controllers/franchise.controller.js";

// ─── Super Admin Routes (manage franchise centers) ───────────────────────────
const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN));

adminRouter.post("/centers", createFranchiseCenter);
adminRouter.get("/centers", listFranchiseCenters);
adminRouter.get("/centers/:franchiseId", getFranchiseCenter);
adminRouter.put("/centers/:franchiseId", updateFranchiseCenter);
adminRouter.post("/centers/:franchiseId/payouts", createPayout);
adminRouter.get("/centers/:franchiseId/payouts", listPayouts);
adminRouter.get("/key-requests", listPendingKeyRequests);
adminRouter.post("/key-requests/:requestId/approve", approveKeyRequest);
adminRouter.post("/key-requests/:requestId/reject", rejectKeyRequest);
adminRouter.post("/centers/:franchiseId/allocate-keys", directAllocateKeys);

// ─── Franchise Admin Routes (operate their own center) ───────────────────────
const franchiseRouter = Router();
franchiseRouter.use(authMiddleware);
franchiseRouter.use(requireRoles(ROLE.FRANCHISE_ADMIN));

franchiseRouter.get("/dashboard", getMyDashboard);
franchiseRouter.get("/courses", listGlobalCourses);
franchiseRouter.post("/batches", createBatch);
franchiseRouter.get("/batches", listMyBatches);
franchiseRouter.post("/students/register-enroll", registerAndEnrollStudent);
franchiseRouter.post("/students/enroll", enrollExistingStudent);
franchiseRouter.get("/students", listMyStudents);
franchiseRouter.get("/earnings", getMyEarnings);
franchiseRouter.post("/payments/offline", recordOfflinePayment);
franchiseRouter.get("/key-pool", getMyKeyPools);
franchiseRouter.post("/key-requests", requestKeys);
franchiseRouter.get("/key-requests", listMyKeyRequests);
franchiseRouter.post("/trainers", createTrainer);
franchiseRouter.get("/trainers", listTrainers);
franchiseRouter.patch("/trainers/:trainerId/status", updateTrainerStatus);

export { adminRouter as franchiseAdminRoutes, franchiseRouter as franchiseRoutes };
