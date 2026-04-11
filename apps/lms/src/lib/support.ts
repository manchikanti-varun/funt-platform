/** Support contacts — single source of truth for LMS copy and links. */
export const SUPPORT_EMAIL = "support@funt.in";

/** WhatsApp (international format without + for wa.me) */
export const SUPPORT_WHATSAPP_WA_ME = "916305930640";

export const SUPPORT_WHATSAPP_DISPLAY = "+91 63059 30640";

export function supportWhatsAppHref(message?: string): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_WA_ME}`;
  if (message?.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}
