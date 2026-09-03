import mongoose, { Schema } from "mongoose";

export interface TextFieldConfig {
  /** Unique key for this text field, e.g. "studentName", "date", "custom1" */
  key: string;
  /** Display label in the designer */
  label: string;
  /** X position as fraction of image width (0-1) */
  x: number;
  /** Y position as fraction of image height (0-1) */
  y: number;
  /** Font size in points */
  fontSize: number;
  /** Font family name — can be a built-in or a custom uploaded font key */
  fontFamily: string;
  /** Font weight */
  fontWeight: "normal" | "bold";
  /** Text alignment */
  align: "left" | "center" | "right";
  /** Text color as hex (e.g. "#000000") */
  color: string;
  /** Max width as fraction of image width (0-1) — text wraps within this box */
  maxWidth: number;
  /** Field type: "text" (default) or "qr_code" for verification QR */
  fieldType?: "text" | "qr_code";
  /** QR code size in pixels (only for qr_code type) */
  qrSize?: number;
}

const textFieldConfigSchema = new Schema<TextFieldConfig>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    fontSize: { type: Number, required: true, default: 16 },
    fontFamily: { type: String, required: true, default: "Helvetica" },
    fontWeight: { type: String, enum: ["normal", "bold"], default: "normal" },
    align: { type: String, enum: ["left", "center", "right"], default: "center" },
    color: { type: String, required: true, default: "#000000" },
    maxWidth: { type: Number, required: true, default: 0.6 },
    fieldType: { type: String, enum: ["text", "qr_code"], default: "text" },
    qrSize: { type: Number, default: 150 },
  },
  { _id: false }
);

export interface CustomFontEntry {
  /** Unique key used to reference this font in textFields */
  fontKey: string;
  /** Display name */
  name: string;
  /** R2 object key for the font file */
  r2Key: string;
  /** Public URL for serving the font */
  publicUrl: string;
  /** Font weight variants stored */
  variants: string[];
}

const customFontSchema = new Schema<CustomFontEntry>(
  {
    fontKey: { type: String, required: true },
    name: { type: String, required: true },
    r2Key: { type: String, required: true },
    publicUrl: { type: String, required: true },
    variants: { type: [String], default: ["normal"] },
  },
  { _id: false }
);

export interface TemplatePageConfig {
  /** Page index (0-based) */
  pageIndex: number;
  /** R2 key of the page image */
  imageKey: string;
  /** Public URL for serving */
  imageUrl: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Text fields placed on this page */
  textFields: TextFieldConfig[];
}

const templatePageSchema = new Schema<TemplatePageConfig>(
  {
    pageIndex: { type: Number, required: true },
    imageKey: { type: String, required: true },
    imageUrl: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    textFields: { type: [textFieldConfigSchema], default: [] },
  },
  { _id: false }
);

export interface WorkshopTemplateDocument extends mongoose.Document {
  name: string;
  /** R2 key of the uploaded template image (page 0 — kept for backward compat) */
  templateImageKey: string;
  /** Public URL for serving the template image */
  templateImageUrl: string;
  /** Width of the template image in pixels */
  imageWidth: number;
  /** Height of the template image in pixels */
  imageHeight: number;
  /** Text field configurations placed on the template (page 0 — kept for backward compat) */
  textFields: TextFieldConfig[];
  /** Multi-page support: additional pages beyond page 0 */
  pages: TemplatePageConfig[];
  /** Custom fonts uploaded for this template */
  customFonts: CustomFontEntry[];
  /** Pre-filled default field values applied to all recipients during generation */
  defaultFieldValues: Record<string, string>;
  /** Generation history summary */
  generationHistory: Array<{
    generatedAt: Date;
    recipientCount: number;
    generatedBy: string;
    templateId?: string;
  }>;
  /** The user who created this template */
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const workshopTemplateSchema = new Schema<WorkshopTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    templateImageKey: { type: String, required: true },
    templateImageUrl: { type: String, required: true },
    imageWidth: { type: Number, required: true },
    imageHeight: { type: Number, required: true },
    textFields: { type: [textFieldConfigSchema], required: true, default: [] },
    pages: { type: [templatePageSchema], default: [] },
    customFonts: { type: [customFontSchema], default: [] },
    defaultFieldValues: { type: Schema.Types.Mixed, default: {} },
    generationHistory: {
      type: [
        new Schema(
          {
            generatedAt: { type: Date, required: true },
            recipientCount: { type: Number, required: true },
            generatedBy: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

workshopTemplateSchema.index({ createdBy: 1 });

export const WorkshopTemplateModel = mongoose.model(
  "WorkshopTemplate",
  workshopTemplateSchema
);

// ─── Workshop Certificate Registry ──────────────────────────────────────────

export interface WorkshopCertificateIssuedDocument extends mongoose.Document {
  /** Unique certificate identifier */
  certificateId: string;
  /** Reference to the workshop template */
  templateId: string;
  /** The field values used to generate this certificate */
  fieldValues: Record<string, string>;
  /** Who generated it */
  generatedBy: string;
  /** When it was generated */
  generatedAt: Date;
  /** Status */
  status: "ISSUED" | "REVOKED";
}

const workshopCertIssuedSchema = new Schema<WorkshopCertificateIssuedDocument>(
  {
    certificateId: { type: String, required: true, unique: true },
    templateId: { type: String, required: true },
    fieldValues: { type: Schema.Types.Mixed, required: true },
    generatedBy: { type: String, required: true },
    generatedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["ISSUED", "REVOKED"], default: "ISSUED" },
  },
  { timestamps: false }
);

workshopCertIssuedSchema.index({ templateId: 1, generatedAt: -1 });
workshopCertIssuedSchema.index({ certificateId: 1 }, { unique: true });

export const WorkshopCertificateIssuedModel = mongoose.model(
  "WorkshopCertificateIssued",
  workshopCertIssuedSchema
);
