/**
 * Presence ping — the dashboard calls this every ~30s so the "Recently Active"
 * board knows who's around. Updates last_active for the signed-in Google user.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  // Only Google users have a presence row (password = owner backup, anonymous).
  if (supabaseAdmin && auth.user.email && auth.user.email !== "owner") {
    await supabaseAdmin.from("team_access").update({ last_active: new Date().toISOString() }).eq("email", auth.user.email);
  }
  return res.status(200).json({ ok: true });
}
