import mongoose, { Schema } from "mongoose";

const invoiceSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "ACTIVE" },
    legalName: { type: String, default: "Funt Robotics" },
    address: {
      type: String,
      default:
        "1st Floor, 2-20-2/211, Ganesh Nagar, Sai Nagar, Uppal, Hyderabad, Telangana 500039",
    },
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    placeOfSupply: { type: String, default: "Telangana (36)" },
    hsnCode: { type: String, default: "" },
    sacCode: { type: String, default: "999293" },
    hsnSac: { type: String, required: false },
    cgstPercent: { type: Number, default: 0, min: 0, max: 100 },
    sgstPercent: { type: Number, default: 0, min: 0, max: 100 },
    igstPercent: { type: Number, default: 18, min: 0, max: 100 },
    defaultNotes: { type: String, default: "" },
    systemFooterText: {
      type: String,
      default:
        "This is a system generated invoice and does not require a signature or a digital signature",
    },
    showLegalName: { type: Boolean, default: true },
    showAddress: { type: Boolean, default: true },
    showGstin: { type: Boolean, default: true },
    showPan: { type: Boolean, default: false },
    showRecipient: { type: Boolean, default: true },
    showRecipientEmail: { type: Boolean, default: true },
    showRecipientAddress: { type: Boolean, default: true },
    showRecipientPhone: { type: Boolean, default: true },
    showHsn: { type: Boolean, default: true },
    showSac: { type: Boolean, default: true },
    showHsnSac: { type: Boolean, required: false },
    showTaxableValue: { type: Boolean, default: true },
    showCgst: { type: Boolean, default: false },
    showSgst: { type: Boolean, default: false },
    showIgst: { type: Boolean, default: true },
    showTotalInWords: { type: Boolean, default: false },
    showSystemFooter: { type: Boolean, default: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const InvoiceSettingsModel = mongoose.model("InvoiceSettings", invoiceSettingsSchema);
