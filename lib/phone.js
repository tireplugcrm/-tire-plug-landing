/** Phone helpers for matching leads to texts (US numbers). */

// Last 10 digits — the stable key we match a customer's number on.
export function digits10(phone) {
  if (!phone) return "";
  const d = String(phone).replace(/\D/g, "");
  return d.slice(-10);
}

// E.164 for Twilio (+1XXXXXXXXXX). Returns null if not a usable 10-digit US number.
export function toE164(phone) {
  const d = digits10(phone);
  return d.length === 10 ? `+1${d}` : null;
}
