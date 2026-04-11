
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createStudentHandler,
  createTrainerHandler,
  createAdminHandler,
  createParentHandler,
  resetLoginHandler,
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
  getPendingPayments,
  postVerifyPayment,
  postRejectPayment,
  patchEnrollmentAccess,
  patchUserUsername,
} from "../controllers/studentAccess.controller.js";
import {
  listShopProductsAdmin,
  postShopProduct,
  patchShopProduct,
  deleteShopProduct,
} from "../controllers/shopAdmin.controller.js";
import { listCoupons, postCoupon, patchCoupon } from "../controllers/couponAdmin.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/users/student", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), createStudentHandler);
router.post("/users/trainer", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), createTrainerHandler);
router.post("/users/admin", requireRoles(ROLE.SUPER_ADMIN), createAdminHandler);
router.post("/users/parent", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), createParentHandler);
router.post("/users/:userId/reset-login", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), resetLoginHandler);

router.get("/requests", requireRoles(ROLE.SUPER_ADMIN), listRequests);
router.post("/requests/admin", requireRoles(ROLE.SUPER_ADMIN), submitAdminRequest);
router.post("/requests/super-admin", requireRoles(ROLE.SUPER_ADMIN), submitSuperAdminRequest);
router.post("/requests/:requestId/approve", requireRoles(ROLE.SUPER_ADMIN), approveRequest);
router.post("/requests/:requestId/reject", requireRoles(ROLE.SUPER_ADMIN), rejectRequest);

router.post("/license-keys", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postGenerateLicense);
router.get("/payments/pending", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), getPendingPayments);
router.post("/payments/:id/verify", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postVerifyPayment);
router.post("/payments/:id/reject", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postRejectPayment);
router.patch("/enrollments/:id/access", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), patchEnrollmentAccess);
router.patch("/users/:userId/username", requireRoles(ROLE.SUPER_ADMIN), patchUserUsername);

router.get("/shop/products", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), listShopProductsAdmin);
router.post("/shop/products", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postShopProduct);
router.patch("/shop/products/:productId", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), patchShopProduct);
router.delete("/shop/products/:productId", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), deleteShopProduct);

router.get("/coupons", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), listCoupons);
router.post("/coupons", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), postCoupon);
router.patch("/coupons/:id", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), patchCoupon);

export const adminRoutes = router;
