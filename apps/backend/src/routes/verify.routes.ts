
import { Router } from "express";
import { verifyCertificatePublic } from "../controllers/certificate.controller.js";
import { verifyInvoicePublic } from "../controllers/invoice.controller.js";

const router = Router();

router.get("/invoice/:invoiceNumber", verifyInvoicePublic);
router.get("/:certificateId", verifyCertificatePublic);

export const verifyRoutes = router;
