import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { listShopProducts, listMyShopOrders, postPurchaseWithCoins } from "../controllers/shop.controller.js";

const router = Router();

router.use(authMiddleware, requireRoles(ROLE.STUDENT));

router.get("/products", listShopProducts);
router.get("/orders", listMyShopOrders);
router.post("/purchase", postPurchaseWithCoins);

export const shopRoutes = router;
