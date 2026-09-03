import type { Request, Response } from "express";
import * as service from "../services/workshopCertificate.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

// ─── Template CRUD ──────────────────────────────────────────────────────────

export const listTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles: string[] = req.user?.roles ?? [];
  const isSubAdminOnly =
    roles.includes(ROLE.SUB_ADMIN) &&
    !roles.includes(ROLE.ADMIN) &&
    !roles.includes(ROLE.SUPER_ADMIN);
  const templates = await service.listTemplates(userId, isSubAdminOnly);
  successRes(res, templates);
});

export const getTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { templateId } = req.params;
  if (!templateId) throw new AppError("templateId is required", 400);
  const tpl = await service.getTemplate(templateId);
  successRes(res, tpl);
});

export const createTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const {
    name, templateImageKey, templateImageUrl, imageWidth, imageHeight,
    textFields, pages, customFonts, defaultFieldValues,
  } = req.body ?? {};
  if (!name) throw new AppError("name is required", 400);
  if (!templateImageKey) throw new AppError("templateImageKey is required", 400);
  if (!templateImageUrl) throw new AppError("templateImageUrl is required", 400);
  if (!imageWidth || !imageHeight) throw new AppError("imageWidth and imageHeight are required", 400);
  if (!Array.isArray(textFields)) throw new AppError("textFields must be an array", 400);

  const tpl = await service.createTemplate(
    {
      name, templateImageKey, templateImageUrl, imageWidth, imageHeight,
      textFields, pages, customFonts, defaultFieldValues,
    },
    userId
  );
  successRes(res, tpl, "Template created", 201);
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { templateId } = req.params;
  if (!templateId) throw new AppError("templateId is required", 400);
  const {
    name, templateImageKey, templateImageUrl, imageWidth, imageHeight,
    textFields, pages, customFonts, defaultFieldValues,
  } = req.body ?? {};

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (templateImageKey !== undefined) data.templateImageKey = templateImageKey;
  if (templateImageUrl !== undefined) data.templateImageUrl = templateImageUrl;
  if (imageWidth !== undefined) data.imageWidth = imageWidth;
  if (imageHeight !== undefined) data.imageHeight = imageHeight;
  if (textFields !== undefined) data.textFields = textFields;
  if (pages !== undefined) data.pages = pages;
  if (customFonts !== undefined) data.customFonts = customFonts;
  if (defaultFieldValues !== undefined) data.defaultFieldValues = defaultFieldValues;

  const tpl = await service.updateTemplate(templateId, data, userId);
  successRes(res, tpl, "Template updated");
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { templateId } = req.params;
  if (!templateId) throw new AppError("templateId is required", 400);
  await service.deleteTemplate(templateId, userId);
  successRes(res, { deleted: true }, "Template deleted");
});

// ─── Template Duplication ──────────────────────────────────────────────────

export const duplicateTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { templateId } = req.params;
  if (!templateId) throw new AppError("templateId is required", 400);
  const tpl = await service.duplicateTemplate(templateId, userId);
  successRes(res, tpl, "Template duplicated", 201);
});

// ─── Certificate Generation ─────────────────────────────────────────────────

export const previewCertificate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { templateId, fieldValues, defaultFieldValues } = req.body ?? {};
  if (!templateId) throw new AppError("templateId is required", 400);
  if (!fieldValues || typeof fieldValues !== "object" || Array.isArray(fieldValues)) {
    throw new AppError("fieldValues must be a key-value object", 400);
  }

  const buffer = await service.generateWorkshopCertificatePdf({
    templateId,
    fieldValues,
    defaultFieldValues,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="preview.pdf"`);
  res.send(buffer);
});

export const generateSingle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { templateId, fieldValues, defaultFieldValues } = req.body ?? {};
  if (!templateId) throw new AppError("templateId is required", 400);
  if (!fieldValues || typeof fieldValues !== "object" || Array.isArray(fieldValues)) {
    throw new AppError("fieldValues must be a key-value object", 400);
  }

  // Register in registry
  const certificateId = await service.registerIssuedCertificate(templateId, fieldValues, userId);

  const buffer = await service.generateWorkshopCertificatePdf({
    templateId,
    fieldValues: { ...fieldValues, _certificateId: certificateId },
    defaultFieldValues,
  });

  // Record in history
  await service.recordGeneration(templateId, 1, userId);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="certificate-${certificateId}.pdf"`);
  res.send(buffer);
});

export const generateBulk = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { templateId, recipients, defaultFieldValues } = req.body ?? {};
  if (!templateId) throw new AppError("templateId is required", 400);
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new AppError("recipients array is required and must not be empty", 400);
  }
  if (recipients.length > 500) {
    throw new AppError("Maximum 500 recipients per batch", 400);
  }

  // Validate each recipient
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const fv = r.fieldValues ?? r.field_values;
    if (!fv || typeof fv !== "object" || Array.isArray(fv)) {
      throw new AppError(
        `recipients[${i}] is missing a valid fieldValues object.`,
        400
      );
    }
  }

  const archiver = (await import("archiver")).default;
  const archive = archiver("zip", { zlib: { level: 6 } });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="workshop-certificates.zip"`);
  archive.pipe(res);

  // Generate sequentially
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const fieldValues: Record<string, string> = recipient.fieldValues ?? recipient.field_values;
    const name =
      recipient.name ??
      fieldValues.name ??
      fieldValues.studentName ??
      fieldValues.student_name ??
      `recipient-${i + 1}`;
    const safeName = String(name).replace(/[/\\:*?"<>|]/g, "_").trim().slice(0, 80);

    // Register in registry
    const certificateId = await service.registerIssuedCertificate(templateId, fieldValues, userId);

    const buffer = await service.generateWorkshopCertificatePdf({
      templateId,
      fieldValues: { ...fieldValues, _certificateId: certificateId },
      defaultFieldValues,
    });

    archive.append(buffer, { name: `${safeName}-${certificateId}.pdf` });
  }

  // Record in generation history
  await service.recordGeneration(templateId, recipients.length, userId);

  await new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", reject);
    archive.finalize();
  });
});

// ─── Certificate Registry & Verification ────────────────────────────────────

export const getRegistry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { templateId } = req.params;
  if (!templateId) throw new AppError("templateId is required", 400);
  const registry = await service.getRegistryForTemplate(templateId);
  successRes(res, registry);
});

export const verifyCertificate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { certificateId } = req.params;
  if (!certificateId) throw new AppError("certificateId is required", 400);
  const data = await service.verifyWorkshopCertificate(certificateId);
  if (!data) {
    res.status(404).json({ success: false, message: "Certificate not found" });
    return;
  }
  successRes(res, data);
});

export const revokeCertificate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { certificateId } = req.params;
  if (!certificateId) throw new AppError("certificateId is required", 400);
  const data = await service.revokeCertificate(certificateId);
  successRes(res, data, "Certificate revoked");
});

// ─── Public Verification (no auth required) ───────────────────────────────

export const verifyWorkshopCertificatePublic = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { certificateId } = req.params;
    if (!certificateId) throw new AppError("certificateId is required", 400);
    const data = await service.verifyWorkshopCertificate(certificateId);
    if (!data) {
      res.status(404).json({ success: false, message: "Certificate not found or revoked" });
      return;
    }
    // Extract student name from fieldValues for public display
    const studentName =
      data.fieldValues.studentName ??
      data.fieldValues.student_name ??
      data.fieldValues.name ??
      "—";
    successRes(res, {
      valid: data.status === "ISSUED",
      certificateId: data.certificateId,
      templateName: data.templateName,
      studentName,
      fieldValues: data.fieldValues,
      issuedAt: data.issuedAt,
      status: data.status,
    });
  }
);

// ─── Student: List my workshop certificates ────────────────────────────────

export const listMyWorkshopCertificates = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Unauthorized", 401);

    // Get user name from the request (set by auth middleware)
    const userName = (req.user as any)?.name ?? (req.user as any)?.email ?? "";

    const certs = await service.listWorkshopCertificatesForStudent(userName, userId);
    successRes(res, certs);
  }
);
