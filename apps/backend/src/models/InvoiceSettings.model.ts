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
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    placeOfSupply: { type: String, default: "Telangana (36)" },
    terms: { type: String, default: "Due on Receipt" },
    hsnSac: { type: String, default: "999293" },
    igstPercent: { type: Number, default: 0, min: 0, max: 100 },
    defaultNotes: { type: String, default: "Thanks for your business." },
    signatoryName: { type: String, default: "Funt Robotics" },
    showLegalName: { type: Boolean, default: true },
    showAddress: { type: Boolean, default: true },
    showGstin: { type: Boolean, default: true },
    showPan: { type: Boolean, default: false },
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    showInvoiceMeta: { type: Boolean, default: true },
    showTerms: { type: Boolean, default: true },
    showDueDate: { type: Boolean, default: true },
    showPlaceOfSupply: { type: Boolean, default: true },
    showBillTo: { type: Boolean, default: true },
    showShipTo: { type: Boolean, default: false },
    showHsnSac: { type: Boolean, default: true },
    showIgst: { type: Boolean, default: false },
    showTotalInWords: { type: Boolean, default: true },
    showNotes: { type: Boolean, default: true },
    showBalanceDue: { type: Boolean, default: true },
    showDigitalSignature: { type: Boolean, default: true },
    showVerifyLink: { type: Boolean, default: false },
    showDocumentHash: { type: Boolean, default: false },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const InvoiceSettingsModel = mongoose.model("InvoiceSettings", invoiceSettingsSchema);
