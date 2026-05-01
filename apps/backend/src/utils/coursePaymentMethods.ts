export type CoursePaymentMethodCode = "UPI_MANUAL" | "RAZORPAY";

/** Legacy / missing snapshot field → both methods (backward compatible). */
export function normalizeAllowedPaymentMethods(raw: unknown): CoursePaymentMethodCode[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return ["UPI_MANUAL", "RAZORPAY"];
  }
  const u = raw.filter((x): x is CoursePaymentMethodCode => x === "UPI_MANUAL" || x === "RAZORPAY");
  if (u.length === 0) return ["UPI_MANUAL", "RAZORPAY"];
  return [...new Set(u)];
}

export function formatPaymentMethodsLabel(allowed: CoursePaymentMethodCode[]): string {
  const parts: string[] = [];
  if (allowed.includes("UPI_MANUAL")) parts.push("Manual UPI");
  if (allowed.includes("RAZORPAY")) parts.push("Razorpay");
  return parts.join(" · ") || "—";
}
