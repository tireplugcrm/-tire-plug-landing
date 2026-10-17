/**
 * Open appointment times for the booking form (public).
 * GET -> { days: [{ date, label, slots: [{ at, label }] }] }  (see lib/booking.js)
 */
import { openSlots } from "../../../lib/booking.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");
  try {
    return res.status(200).json({ days: await openSlots() });
  } catch (e) {
    console.error("slots error:", e);
    return res.status(500).json({ error: "Could not load times. Please call 562-500-4625." });
  }
}
