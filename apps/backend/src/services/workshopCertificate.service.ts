import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket } from "../config/r2.js";
import {
  WorkshopTemplateModel,
  WorkshopCertificateIssuedModel,
} from "../models/WorkshopTemplate.model.js";
import { createAuditLog } from "./audit.service.js";
import { AppError } from "../utils/AppError.js";
import type { TextFieldConfig } from "../models/WorkshopTemplate.model.js";

// ─── Template CRUD ──────────────────────────────────────────────────────────

export async function listTemplates(userId: string, isSubAdminOnly = false) {
  const filter = isSubAdminOnly ? { createdBy: userId } : {};
  return WorkshopTemplateModel.find(filter)
    .sort({ updatedAt: -1 })
    .lean()
    .exec();
}

export async function getTemplate(templateId: string) {
  const tpl = await WorkshopTemplateModel.findById(templateId).lean().exec();
  if (!tpl) throw new AppError("Template not found", 404);
  return tpl;
}

export async function createTemplate(
  data: {
    name: string;
    templateImageKey: string;
    templateImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    textFields: TextFieldConfig[];
    pages?: Array<{
      pageIndex: number;
      imageKey: string;
      imageUrl: string;
      width: number;
      height: number;
      textFields: TextFieldConfig[];
    }>;
    customFonts?: Array<{
      fontKey: string;
      name: string;
      r2Key: string;
      publicUrl: string;
      variants?: string[];
    }>;
    defaultFieldValues?: Record<string, string>;
  },
  userId: string
) {
  const tpl = await WorkshopTemplateModel.create({ ...data, createdBy: userId });
  await createAuditLog("WORKSHOP_TEMPLATE_CREATED", userId, "WorkshopTemplate", String(tpl._id));
  return tpl.toObject();
}

export async function updateTemplate(
  templateId: string,
  data: Partial<{
    name: string;
    templateImageKey: string;
    templateImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    textFields: TextFieldConfig[];
    pages: Array<{
      pageIndex: number;
      imageKey: string;
      imageUrl: string;
      width: number;
      height: number;
      textFields: TextFieldConfig[];
    }>;
    customFonts: Array<{
      fontKey: string;
      name: string;
      r2Key: string;
      publicUrl: string;
      variants?: string[];
    }>;
    defaultFieldValues: Record<string, string>;
  }>,
  userId: string
) {
  const tpl = await WorkshopTemplateModel.findByIdAndUpdate(
    templateId,
    { $set: data },
    { new: true }
  )
    .lean()
    .exec();
  if (!tpl) throw new AppError("Template not found", 404);
  await createAuditLog("WORKSHOP_TEMPLATE_UPDATED", userId, "WorkshopTemplate", templateId);
  return tpl;
}

export async function deleteTemplate(templateId: string, userId: string) {
  const tpl = await WorkshopTemplateModel.findByIdAndDelete(templateId).exec();
  if (!tpl) throw new AppError("Template not found", 404);
  await createAuditLog("WORKSHOP_TEMPLATE_DELETED", userId, "WorkshopTemplate", templateId);
  return { deleted: true };
}

// ─── Template Duplication ──────────────────────────────────────────────────

export async function duplicateTemplate(templateId: string, userId: string) {
  const src = await WorkshopTemplateModel.findById(templateId).lean().exec();
  if (!src) throw new AppError("Source template not found", 404);
  const tpl = await WorkshopTemplateModel.create({
    name: `${src.name} (Copy)`,
    templateImageKey: src.templateImageKey,
    templateImageUrl: src.templateImageUrl,
    imageWidth: src.imageWidth,
    imageHeight: src.imageHeight,
    textFields: src.textFields,
    pages: src.pages ?? [],
    customFonts: src.customFonts ?? [],
    defaultFieldValues: src.defaultFieldValues ?? {},
    generationHistory: [],
    createdBy: userId,
  });
  await createAuditLog("WORKSHOP_TEMPLATE_CREATED", userId, "WorkshopTemplate", String(tpl._id));
  return tpl.toObject();
}

// ─── Generation History ────────────────────────────────────────────────────

export async function recordGeneration(
  templateId: string,
  recipientCount: number,
  generatedBy: string
) {
  await WorkshopTemplateModel.findByIdAndUpdate(templateId, {
    $push: {
      generationHistory: {
        $each: [{ generatedAt: new Date(), recipientCount, generatedBy }],
        $slice: -50,
      },
    },
  }).exec();
}

// ─── R2 Helpers ────────────────────────────────────────────────────────────

async function getR2Buffer(key: string): Promise<Buffer> {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const stream = response.Body;
  if (!stream) throw new AppError("Object not found in R2", 404);
  const chunks: Uint8Array[] = [];
  const reader = stream.transformToWebStream().getReader();
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) chunks.push(result.value);
  }
  return Buffer.concat(chunks);
}

// ─── Font Helpers ──────────────────────────────────────────────────────────

function mapBuiltinFont(cssFont: string, weight: "normal" | "bold"): string {
  const lower = cssFont.toLowerCase().trim();
  if (
    lower === "times" || lower === "times new roman" || lower === "times-roman" || lower === "georgia" ||
    (lower.includes("serif") && !lower.includes("sans-serif"))
  ) {
    return weight === "bold" ? "Times-Bold" : "Times-Roman";
  }
  if (lower === "courier" || lower.includes("courier") || lower.includes("mono")) {
    return weight === "bold" ? "Courier-Bold" : "Courier";
  }
  return weight === "bold" ? "Helvetica-Bold" : "Helvetica";
}

// ─── QR Code ───────────────────────────────────────────────────────────────

async function generateQrCodePng(data: string, size: number): Promise<Buffer> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toBuffer(data, {
    width: size,
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

// ─── Certificate Generation ─────────────────────────────────────────────────

export interface GenerateWorkshopCertInput {
  templateId: string;
  fieldValues: Record<string, string>;
  defaultFieldValues?: Record<string, string>;
  pageIndices?: number[];
}

export async function generateWorkshopCertificatePdf(
  input: GenerateWorkshopCertInput
): Promise<Buffer> {
  const tpl = await WorkshopTemplateModel.findById(input.templateId).lean().exec();
  if (!tpl) throw new AppError("Template not found", 404);

  // Merge defaults: template defaults < input defaults < explicit values
  const mergedValues: Record<string, string> = {
    ...(tpl.defaultFieldValues ?? {}),
    ...(input.defaultFieldValues ?? {}),
    ...input.fieldValues,
  };

  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const PDFDocument = require("pdfkit");

  // Build pages list
  const pagesToRender: Array<{
    imageKey: string;
    width: number;
    height: number;
    textFields: TextFieldConfig[];
  }> = [
    {
      imageKey: tpl.templateImageKey,
      width: tpl.imageWidth,
      height: tpl.imageHeight,
      textFields: tpl.textFields,
    },
  ];

  if (tpl.pages && tpl.pages.length > 0) {
    const indices = input.pageIndices ?? tpl.pages.map((p) => p.pageIndex);
    for (const idx of indices) {
      const page = tpl.pages.find((p) => p.pageIndex === idx);
      if (page) {
        pagesToRender.push({
          imageKey: page.imageKey,
          width: page.width,
          height: page.height,
          textFields: page.textFields,
        });
      }
    }
  }

  // Preload image buffers
  const imageBuffers = new Map<string, Buffer>();
  for (const page of pagesToRender) {
    if (!imageBuffers.has(page.imageKey)) {
      imageBuffers.set(page.imageKey, await getR2Buffer(page.imageKey));
    }
  }

  // Preload custom font buffers
  const customFontBuffers = new Map<string, Buffer>();
  if (tpl.customFonts && tpl.customFonts.length > 0) {
    for (const font of tpl.customFonts) {
      try {
        customFontBuffers.set(font.fontKey, await getR2Buffer(font.r2Key));
      } catch {
        /* skip missing fonts */
      }
    }
  }

  // Verification base URL
  const backendUrl = (process.env.BACKEND_PUBLIC_URL || "https://api.funt.in").replace(/\/$/, "");

  // Generate QR codes for qr_code fields
  const qrBuffers = new Map<string, Buffer>();
  for (const page of pagesToRender) {
    for (const field of page.textFields) {
      if (field.fieldType === "qr_code" && !qrBuffers.has(field.key)) {
        const certId = mergedValues._certificateId || "preview";
        const qrValue = mergedValues[field.key] || `${backendUrl}/verify/workshop/${certId}`;
        try {
          qrBuffers.set(field.key, await generateQrCodePng(qrValue, field.qrSize ?? 150));
        } catch {
          /* skip broken QR */
        }
      }
    }
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (const pageConfig of pagesToRender) {
      doc.addPage({ size: [pageConfig.width, pageConfig.height], margin: 0 });

      // Background image
      const imgBuf = imageBuffers.get(pageConfig.imageKey)!;
      doc.image(imgBuf, 0, 0, { width: pageConfig.width, height: pageConfig.height });

      // Render each field
      for (const field of pageConfig.textFields) {
        if (field.fieldType === "qr_code") {
          const qrBuf = qrBuffers.get(field.key);
          if (!qrBuf) continue;
          const qrSize = field.qrSize ?? 150;
          const qrX = field.x * pageConfig.width - qrSize / 2;
          const qrY = field.y * pageConfig.height - qrSize / 2;
          doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });
          continue;
        }

        // Text field
        const value = mergedValues[field.key] ?? "";
        if (!value.trim()) continue;

        const anchorX = field.x * pageConfig.width;
        const anchorY = field.y * pageConfig.height;
        const maxW = field.maxWidth * pageConfig.width;

        // Register custom font if available
        let fontName: string;
        const isCustom = customFontBuffers.has(field.fontFamily);
        if (isCustom) {
          const fontBuf = customFontBuffers.get(field.fontFamily)!;
          const tag = `custom_${field.fontFamily}_${field.fontWeight}`;
          try {
            doc.registerFont(tag, fontBuf);
            fontName = tag;
          } catch {
            fontName = mapBuiltinFont(field.fontFamily, field.fontWeight);
          }
        } else {
          fontName = mapBuiltinFont(field.fontFamily, field.fontWeight);
        }

        // Auto-shrink to fit
        let fontSize = field.fontSize;
        doc.font(fontName).fontSize(fontSize);
        while (fontSize > 6 && doc.widthOfString(value) > maxW) {
          fontSize -= 0.5;
          doc.font(fontName).fontSize(fontSize);
        }

        // Position: center the text block at the anchor
        let textX: number;
        if (field.align === "center") textX = anchorX - maxW / 2;
        else if (field.align === "right") textX = anchorX - maxW;
        else textX = anchorX;

        const approxLineHeight = fontSize * 1.2;
        const textY = anchorY - approxLineHeight / 2;

        doc
          .font(fontName)
          .fontSize(fontSize)
          .fillColor(field.color)
          .text(value, textX, textY, {
            width: maxW,
            align: field.align,
            lineBreak: true,
          });
      }
    }

    doc.end();
  });
}

// ─── Certificate Registry ──────────────────────────────────────────────────

export async function registerIssuedCertificate(
  templateId: string,
  fieldValues: Record<string, string>,
  generatedBy: string
): Promise<string> {
  const certificateId = `WS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await WorkshopCertificateIssuedModel.create({
    certificateId,
    templateId,
    fieldValues,
    generatedBy,
    generatedAt: new Date(),
    status: "ISSUED",
  });
  return certificateId;
}

export async function revokeCertificate(certificateId: string) {
  const cert = await WorkshopCertificateIssuedModel.findOneAndUpdate(
    { certificateId, status: "ISSUED" },
    { $set: { status: "REVOKED" } },
    { new: true }
  ).exec();
  if (!cert) throw new AppError("Certificate not found or already revoked", 404);
  return cert.toObject();
}

export async function getRegistryForTemplate(templateId: string) {
  return WorkshopCertificateIssuedModel.find({ templateId })
    .sort({ generatedAt: -1 })
    .lean()
    .exec();
}

export async function verifyWorkshopCertificate(certificateId: string) {
  const cert = await WorkshopCertificateIssuedModel.findOne({ certificateId }).lean().exec();
  if (!cert) return null;
  const tpl = await WorkshopTemplateModel.findById(cert.templateId).select("name").lean().exec();
  return {
    certificateId: cert.certificateId,
    templateName: tpl?.name ?? "Unknown",
    fieldValues: cert.fieldValues,
    issuedAt: cert.generatedAt,
    status: cert.status,
  };
}

export interface WorkshopCertRecipient {
  index: number;
  name: string;
  fieldValues: Record<string, string>;
}

export async function generateBulkWorkshopCertificates(
  templateId: string,
  recipients: WorkshopCertRecipient[],
  generatedBy: string,
  defaultFieldValues?: Record<string, string>
): Promise<Array<{ index: number; name: string; buffer: Buffer; certificateId: string }>> {
  const results: Array<{ index: number; name: string; buffer: Buffer; certificateId: string }> = [];
  for (const recipient of recipients) {
    const certificateId = await registerIssuedCertificate(templateId, recipient.fieldValues, generatedBy);
    const buffer = await generateWorkshopCertificatePdf({
      templateId,
      fieldValues: { ...recipient.fieldValues, _certificateId: certificateId },
      defaultFieldValues,
    });
    results.push({ index: recipient.index, name: recipient.name, buffer, certificateId });
  }
  await recordGeneration(templateId, recipients.length, generatedBy);
  return results;
}
