
import express, { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createStudentSchema,
  createTrainerSchema,
  createAdminSchema,
  patchUserIdentitySchema,
  generateLicenseKeySchema,
  rejectPaymentSchema,
} from "../schemas/index.js";
import {
  createStudentHandler,
  createTrainerHandler,
  createSupportAgentHandler,
  createAdminHandler,
  createSubAdminHandler,
  createSuperAdminHandler,
  resetLoginHandler,
  patchUserIdentityHandler,
  listPeopleByRoleHandler,
  getPersonDetailsHandler,
  downloadPersonDetailsHandler,
  bulkDownloadPeopleHandler,
} from "../controllers/admin.controller.js";
import {
  submitAdminRequest,
  submitSuperAdminRequest,
  listRequests,
  approveRequest,
  rejectRequest,
} from "../controllers/registrationRequest.controller.js";
import {
  postGenerateLicense,
  getLicenseKeyAudit,
  getPendingPayments,
  postVerifyPayment,
  postRejectPayment,
  getAdminPaymentsFinance,
  patchEnrollmentAccess,
  patchEnrollmentCourseAccess,
  patchUserUsername,
} from "../controllers/studentAccess.controller.js";
import {
  listShopProductsAdmin,
  postShopProduct,
  patchShopProduct,
  deleteShopProduct,
  listShopOrdersAdmin,
  patchShopOrderStatus,
  getShopStockInsightsAdmin,
} from "../controllers/shopAdmin.controller.js";
import { listCoupons, postCoupon, patchCoupon, getCouponAudit } from "../controllers/couponAdmin.controller.js";
import { postGeneratePaymentQr, getPaymentQrHistory } from "../controllers/paymentQrAdmin.controller.js";
import { getStaffPickersList } from "../controllers/staffPicker.controller.js";
import {
  createShopProductSchema,
  updateShopProductSchema,
  updateShopOrderStatusSchema,
  createCouponSchema,
  updateCouponSchema,
} from "../schemas/index.js";
import {
  createBadgeDefinitionSchema,
  updateBadgeDefinitionSchema,
  awardBadgeSchema,
} from "../schemas/index.js";
import { createManualInvoiceSchema } from "../schemas/index.js";
import {
  getAdminPaymentUpiConfig,
  patchAdminPaymentUpiConfig,
  postAdminPaymentUpiChangeRequest,
  getAdminPaymentUpiChangeRequests,
  postApproveAdminPaymentUpiChangeRequest,
  postRejectAdminPaymentUpiChangeRequest,
} from "../controllers/paymentUpiAdmin.controller.js";
import {
  getBadgeDefinitionsForAdmin,
  getUserAchievementsForAdmin,
  patchBadgeDefinition,
  postAwardBadgeByAdmin,
  postCreateBadgeDefinition,
} from "../controllers/achievement.controller.js";
import {
  getAdminInvoices,
  getAdminInvoiceById,
  postManualInvoice,
  getAdminInvoiceSettings,
  patchAdminInvoiceSettings,
  downloadAdminInvoicePdf,
  downloadAdminInvoiceSamplePdf,
} from "../controllers/invoice.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/users/student", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), validateBody(createStudentSchema), createStudentHandler);
router.post("/users/trainer", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createTrainerSchema), createTrainerHandler);
router.post("/users/support-agent", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createTrainerSchema), createSupportAgentHandler);
router.post("/users/sub-admin", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), validateBody(createAdminSchema), createSubAdminHandler);
router.post("/users/admin", requireRoles(ROLE.SUPER_ADMIN), validateBody(createAdminSchema), createAdminHandler);
router.post("/users/super-admin", requireRoles(ROLE.SUPER_ADMIN), validateBody(createAdminSchema), createSuperAdminHandler);
router.post("/users/:username/reset-login", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), resetLoginHandler);
router.patch("/users/:userId/identity", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(patchUserIdentitySchema), patchUserIdentityHandler);
router.get("/people", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), listPeopleByRoleHandler);
router.get("/people/:userId", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), getPersonDetailsHandler);
router.get("/people/:userId/download", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), downloadPersonDetailsHandler);
router.post("/people/bulk-download", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), bulkDownloadPeopleHandler);

router.get("/requests", requireRoles(ROLE.SUPER_ADMIN), listRequests);
router.post("/requests/admin", requireRoles(ROLE.SUPER_ADMIN), submitAdminRequest);
router.post("/requests/super-admin", requireRoles(ROLE.SUPER_ADMIN), submitSuperAdminRequest);
router.post("/requests/:requestId/approve", requireRoles(ROLE.SUPER_ADMIN), approveRequest);
router.post("/requests/:requestId/reject", requireRoles(ROLE.SUPER_ADMIN), rejectRequest);

router.get("/license-keys/audit", requireRoles(ROLE.SUPER_ADMIN), getLicenseKeyAudit);
router.post("/license-keys", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(generateLicenseKeySchema), postGenerateLicense);
router.get("/payments/pending", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), getPendingPayments);
router.get("/payments/finance", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getAdminPaymentsFinance);
router.get("/invoices/settings", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getAdminInvoiceSettings);
router.patch("/invoices/settings", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), patchAdminInvoiceSettings);
router.get("/invoices", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), getAdminInvoices);
router.get("/invoices/sample/pdf", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), downloadAdminInvoiceSamplePdf);
router.get("/invoices/:id/pdf", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), downloadAdminInvoicePdf);
router.get("/invoices/:id", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), getAdminInvoiceById);
router.post("/invoices", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), validateBody(createManualInvoiceSchema), postManualInvoice);
router.post("/payments/:id/verify", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), postVerifyPayment);
router.post("/payments/:id/reject", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), validateBody(rejectPaymentSchema), postRejectPayment);
router.patch("/enrollments/:id/access", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), patchEnrollmentAccess);
router.patch("/enrollments/:id/course-access", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), patchEnrollmentCourseAccess);
router.patch("/users/:userId/username", requireRoles(ROLE.SUPER_ADMIN), patchUserUsername);

// Delete user account (Super Admin only)
router.delete("/users/:userId", requireRoles(ROLE.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { AppError } = await import("../utils/AppError.js");
    const { UserModel } = await import("../models/User.model.js");
    const { EnrollmentModel } = await import("../models/Enrollment.model.js");
    const { ChapterProgressModel } = await import("../models/ModuleProgress.model.js");
    const { createAuditLog } = await import("../services/audit.service.js");
    const { successRes } = await import("../utils/response.js");
    const { cacheDel, CACHE_KEYS } = await import("../utils/cache.js");

    const targetId = req.params.userId;
    const performedBy = req.user?.userId;
    if (!targetId || !/^[a-fA-F0-9]{24}$/.test(targetId)) throw new AppError("Valid userId is required", 400);

    const user = await UserModel.findById(targetId).select("username name roles").exec();
    if (!user) throw new AppError("User not found", 404);

    // Prevent deleting yourself
    if (targetId === performedBy) throw new AppError("You cannot delete your own account", 400);

    // Prevent deleting other super admins (safety)
    if (user.roles.includes(ROLE.SUPER_ADMIN)) {
      throw new AppError("Cannot delete a Super Admin account. Demote first.", 400);
    }

    // Delete associated data across collections
    const { EnrollmentRequestModel } = await import("../models/EnrollmentRequest.model.js");
    const { NotificationModel } = await import("../models/Notification.model.js");

    await Promise.allSettled([
      EnrollmentModel.deleteMany({ studentId: targetId }).exec(),
      ChapterProgressModel.deleteMany({ studentId: targetId }).exec(),
      EnrollmentRequestModel.deleteMany({ studentId: targetId }).exec(),
      NotificationModel.deleteMany({ userId: targetId }).exec(),
      cacheDel(CACHE_KEYS.studentCourses(targetId)),
      cacheDel(CACHE_KEYS.user(targetId)),
    ]);

    // Delete the user
    await UserModel.deleteOne({ _id: targetId }).exec();

    await createAuditLog("USER_DELETED" as Parameters<typeof createAuditLog>[0], performedBy ?? "unknown", "User", targetId, {
      action: "DELETED",
      deletedUsername: user.username,
      deletedName: user.name,
      deletedRoles: user.roles,
    }).catch(() => {});

    successRes(res, { deletedUserId: targetId, username: user.username }, "User account deleted");
  } catch (err) { next(err); }
});

router.get("/staff-picker", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN, ROLE.TRAINER), getStaffPickersList);

router.get("/shop/products", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), listShopProductsAdmin);
router.post("/shop/products", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createShopProductSchema), postShopProduct);
router.patch("/shop/products/:productId", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(updateShopProductSchema), patchShopProduct);
router.delete("/shop/products/:productId", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), deleteShopProduct);
router.get("/shop/orders", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), listShopOrdersAdmin);
router.patch("/shop/orders/:orderId/status", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), validateBody(updateShopOrderStatusSchema), patchShopOrderStatus);
router.get("/shop/stock-insights", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), getShopStockInsightsAdmin);

router.get("/coupons", requireRoles(ROLE.SUPER_ADMIN), listCoupons);
router.get("/coupons/audit", requireRoles(ROLE.SUPER_ADMIN), getCouponAudit);
router.post("/coupons", requireRoles(ROLE.SUPER_ADMIN), validateBody(createCouponSchema), postCoupon);
router.patch("/coupons/:id", requireRoles(ROLE.SUPER_ADMIN), validateBody(updateCouponSchema), patchCoupon);
router.post("/generate-qr", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), postGeneratePaymentQr);
router.get("/qr-history", requireRoles(ROLE.SUPER_ADMIN), getPaymentQrHistory);
router.get("/payment-upi/config", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), getAdminPaymentUpiConfig);
router.patch("/payment-upi/config", requireRoles(ROLE.SUPER_ADMIN), patchAdminPaymentUpiConfig);
router.post("/payment-upi/change-requests", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUB_ADMIN), postAdminPaymentUpiChangeRequest);
router.get("/payment-upi/change-requests", requireRoles(ROLE.SUPER_ADMIN), getAdminPaymentUpiChangeRequests);
router.post("/payment-upi/change-requests/:id/approve", requireRoles(ROLE.SUPER_ADMIN), postApproveAdminPaymentUpiChangeRequest);
router.post("/payment-upi/change-requests/:id/reject", requireRoles(ROLE.SUPER_ADMIN), postRejectAdminPaymentUpiChangeRequest);

router.get("/badges", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getBadgeDefinitionsForAdmin);
router.post("/badges", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createBadgeDefinitionSchema), postCreateBadgeDefinition);
router.patch("/badges/:badgeType", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(updateBadgeDefinitionSchema), patchBadgeDefinition);
router.post("/badges/award", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(awardBadgeSchema), postAwardBadgeByAdmin);
router.get("/users/:userId/achievements", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getUserAchievementsForAdmin);

// ── Git Backup (Super Admin only) ─────────────────────────────────────────────
router.post("/backup/run", requireRoles(ROLE.SUPER_ADMIN), async (_req, res, next) => {
  try {
    const { runFullBackup } = await import("../services/gitBackup.service.js");
    const result = await runFullBackup();
    res.json({ success: result.success, data: result, message: result.message });
  } catch (err) { next(err); }
});

// ── Restore from Git Backup (Super Admin only) ────────────────────────────────
router.post("/backup/restore", requireRoles(ROLE.SUPER_ADMIN), async (_req, res, next) => {
  try {
    const { restoreFromGitBackup } = await import("../services/gitBackup.service.js");
    const result = await restoreFromGitBackup();
    res.json({ success: result.success, data: result, message: result.message });
  } catch (err) { next(err); }
});

// ── Restore from uploaded backup data (Super Admin only) ──────────────────────
router.post("/backup/restore-upload", requireRoles(ROLE.SUPER_ADMIN), express.json({ limit: "50mb" }), async (req, res, next) => {
  try {
    const { restoreFromUpload } = await import("../services/gitBackup.service.js");
    const body = req.body as { collections?: Record<string, unknown[]>; skipCollections?: string[] };
    if (!body.collections || typeof body.collections !== "object") {
      res.status(400).json({ success: false, message: "Request body must include 'collections' object with { collectionName: docs[] }" });
      return;
    }
    const result = await restoreFromUpload(body.collections, { skipCollections: body.skipCollections });
    res.json({ success: result.success, data: result, message: result.message });
  } catch (err) { next(err); }
});

export const adminRoutes = router;
