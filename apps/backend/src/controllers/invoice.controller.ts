import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import * as invoiceService from "../services/invoice.service.js";
import * as invoiceSettingsService from "../services/invoiceSettings.service.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const getAdminInvoices = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : undefined;
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  const data = await invoiceService.listInvoicesForAdmin({ batchId, studentId });
  successRes(res, data);
});

export const getAdminInvoiceById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Invoice ID is required", 400);
  const data = await invoiceService.getInvoiceById(id);
  successRes(res, data);
});

export const postManualInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const studentId = String(req.body?.studentId ?? "").trim();
  const batchId = String(req.body?.batchId ?? "").trim();
  const courseId = String(req.body?.courseId ?? "").trim() || undefined;
  const notes = String(req.body?.notes ?? "").trim() || undefined;
  const lineDescription = String(req.body?.lineDescription ?? "").trim() || undefined;
  const lineItemTypeRaw = String(req.body?.lineItemType ?? "SERVICE").trim().toUpperCase();
  const lineItemType = lineItemTypeRaw === "GOODS" ? "GOODS" : "SERVICE";

  if (!studentId) throw new AppError("studentId is required", 400);
  if (!batchId) throw new AppError("batchId is required", 400);

  let amountInPaise: number | undefined;
  if (req.body?.amountInPaise != null) {
    amountInPaise = Math.max(0, Math.floor(Number(req.body.amountInPaise)));
  } else if (req.body?.amountRupees != null) {
    amountInPaise = Math.max(0, Math.round(Number(req.body.amountRupees) * 100));
  }

  let discountInPaise: number | undefined;
  if (req.body?.discountInPaise != null) {
    discountInPaise = Math.max(0, Math.floor(Number(req.body.discountInPaise)));
  } else if (req.body?.discountRupees != null) {
    discountInPaise = Math.max(0, Math.round(Number(req.body.discountRupees) * 100));
  }

  const data = await invoiceService.createManualInvoice({
    studentId,
    batchId,
    courseId,
    amountInPaise,
    discountInPaise,
    notes,
    lineDescription,
    lineItemType,
    createdBy,
  });
  successRes(res, data, "Invoice created", 201);
});

export const getMyInvoices = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await invoiceService.listInvoicesForStudent(studentId);
  successRes(res, data);
});

export const getMyInvoiceById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const id = req.params.id;
  if (!id) throw new AppError("Invoice ID is required", 400);
  const data = await invoiceService.getInvoiceById(id);
  if (data.studentId !== studentId) throw new AppError("Invoice not found", 404);
  successRes(res, data);
});

export const getAdminInvoiceSettings = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await invoiceSettingsService.getInvoiceSettings();
  successRes(res, data);
});

export const patchAdminInvoiceSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const updatedBy = getUserId(req);
  const data = await invoiceSettingsService.updateInvoiceSettings(req.body ?? {}, updatedBy);
  successRes(res, data, "Invoice settings saved");
});

export const downloadAdminInvoiceSamplePdf = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const buffer = await invoiceService.generateInvoiceSamplePdfBuffer();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="invoice-sample.pdf"');
  res.send(buffer);
});

export const downloadAdminInvoicePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Invoice ID is required", 400);
  const buffer = await invoiceService.generateInvoicePdfBuffer(id);
  const inv = await invoiceService.getInvoiceById(id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="invoice-${inv.invoiceNumber}.pdf"`
  );
  res.send(buffer);
});

export const downloadStudentInvoicePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const id = req.params.id;
  if (!id) throw new AppError("Invoice ID is required", 400);
  const inv = await invoiceService.getInvoiceById(id);
  if (inv.studentId !== studentId) throw new AppError("Invoice not found", 404);
  const buffer = await invoiceService.generateInvoicePdfBuffer(id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="invoice-${inv.invoiceNumber}.pdf"`
  );
  res.send(buffer);
});

export const verifyInvoicePublic = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const invoiceNumber = req.params.invoiceNumber;
  if (!invoiceNumber) throw new AppError("invoiceNumber is required", 400);
  const data = await invoiceService.verifyInvoicePublic(invoiceNumber);
  if (!data) {
    res.status(404).json({ success: false, valid: false, message: "Invoice not found or void" });
    return;
  }
  if (data.valid === false) {
    res.status(409).json({ success: false, ...data });
    return;
  }
  successRes(res, data);
});
