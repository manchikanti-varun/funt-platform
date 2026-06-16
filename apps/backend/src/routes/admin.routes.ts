
import { Router } from "express";
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
  createAdminHandler,
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

router.post("/users/student", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createStudentSchema), createStudentHandler);
router.post("/users/trainer", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createTrainerSchema), createTrainerHandler);
router.post("/users/admin", requireRoles(ROLE.SUPER_ADMIN), validateBody(createAdminSchema), createAdminHandler);
router.post("/users/super-admin", requireRoles(ROLE.SUPER_ADMIN), validateBody(createAdminSchema), createSuperAdminHandler);
router.post("/users/:username/reset-login", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), resetLoginHandler);
router.patch("/users/:userId/identity", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(patchUserIdentitySchema), patchUserIdentityHandler);
router.get("/people", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), listPeopleByRoleHandler);
router.get("/people/:userId", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getPersonDetailsHandler);
router.get("/people/:userId/download", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), downloadPersonDetailsHandler);
router.post("/people/bulk-download", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), bulkDownloadPeopleHandler);

router.get("/requests", requireRoles(ROLE.SUPER_ADMIN), listRequests);
router.post("/requests/admin", requireRoles(ROLE.SUPER_ADMIN), submitAdminRequest);
router.post("/requests/super-admin", requireRoles(ROLE.SUPER_ADMIN), submitSuperAdminRequest);
router.post("/requests/:requestId/approve", requireRoles(ROLE.SUPER_ADMIN), approveRequest);
router.post("/requests/:requestId/reject", requireRoles(ROLE.SUPER_ADMIN), rejectRequest);

router.get("/license-keys/audit", requireRoles(ROLE.SUPER_ADMIN), getLicenseKeyAudit);
router.post("/license-keys", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(generateLicenseKeySchema), postGenerateLicense);
router.get("/payments/pending", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getPendingPayments);
router.get("/payments/finance", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getAdminPaymentsFinance);
router.get("/invoices/settings", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getAdminInvoiceSettings);
router.patch("/invoices/settings", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), patchAdminInvoiceSettings);
router.get("/invoices", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getAdminInvoices);
router.get("/invoices/sample/pdf", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), downloadAdminInvoiceSamplePdf);
router.get("/invoices/:id/pdf", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), downloadAdminInvoicePdf);
router.get("/invoices/:id", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getAdminInvoiceById);
router.post("/invoices", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createManualInvoiceSchema), postManualInvoice);
router.post("/payments/:id/verify", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postVerifyPayment);
router.post("/payments/:id/reject", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(rejectPaymentSchema), postRejectPayment);
router.patch("/enrollments/:id/access", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), patchEnrollmentAccess);
router.patch("/enrollments/:id/course-access", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), patchEnrollmentCourseAccess);
router.patch("/users/:userId/username", requireRoles(ROLE.SUPER_ADMIN), patchUserUsername);

router.get("/staff-picker", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getStaffPickersList);

router.get("/shop/products", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), listShopProductsAdmin);
router.post("/shop/products", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createShopProductSchema), postShopProduct);
router.patch("/shop/products/:productId", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(updateShopProductSchema), patchShopProduct);
router.delete("/shop/products/:productId", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), deleteShopProduct);
router.get("/shop/orders", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), listShopOrdersAdmin);
router.patch("/shop/orders/:orderId/status", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(updateShopOrderStatusSchema), patchShopOrderStatus);
router.get("/shop/stock-insights", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getShopStockInsightsAdmin);

router.get("/coupons", requireRoles(ROLE.SUPER_ADMIN), listCoupons);
router.get("/coupons/audit", requireRoles(ROLE.SUPER_ADMIN), getCouponAudit);
router.post("/coupons", requireRoles(ROLE.SUPER_ADMIN), validateBody(createCouponSchema), postCoupon);
router.patch("/coupons/:id", requireRoles(ROLE.SUPER_ADMIN), validateBody(updateCouponSchema), patchCoupon);
router.post("/generate-qr", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postGeneratePaymentQr);
router.get("/qr-history", requireRoles(ROLE.SUPER_ADMIN), getPaymentQrHistory);
router.get("/payment-upi/config", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getAdminPaymentUpiConfig);
router.patch("/payment-upi/config", requireRoles(ROLE.SUPER_ADMIN), patchAdminPaymentUpiConfig);
router.post("/payment-upi/change-requests", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postAdminPaymentUpiChangeRequest);
router.get("/payment-upi/change-requests", requireRoles(ROLE.SUPER_ADMIN), getAdminPaymentUpiChangeRequests);
router.post("/payment-upi/change-requests/:id/approve", requireRoles(ROLE.SUPER_ADMIN), postApproveAdminPaymentUpiChangeRequest);
router.post("/payment-upi/change-requests/:id/reject", requireRoles(ROLE.SUPER_ADMIN), postRejectAdminPaymentUpiChangeRequest);

router.get("/badges", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getBadgeDefinitionsForAdmin);
router.post("/badges", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(createBadgeDefinitionSchema), postCreateBadgeDefinition);
router.patch("/badges/:badgeType", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(updateBadgeDefinitionSchema), patchBadgeDefinition);
router.post("/badges/award", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), validateBody(awardBadgeSchema), postAwardBadgeByAdmin);
router.get("/users/:userId/achievements", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getUserAchievementsForAdmin);

export const adminRoutes = router;
