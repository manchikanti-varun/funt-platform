export const INVOICE_SOURCE = {
  AUTO_ENROLLMENT: "AUTO_ENROLLMENT",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  MANUAL_ADMIN: "MANUAL_ADMIN",
} as const;

export type InvoiceSource = (typeof INVOICE_SOURCE)[keyof typeof INVOICE_SOURCE];

export const INVOICE_STATUS = {
  ISSUED: "ISSUED",
  VOID: "VOID",
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];
