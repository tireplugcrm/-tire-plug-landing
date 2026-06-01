/**
 * Owner-only: log someone out / revoke their access. They'll need a fresh code.
 * action "revoke" | "approve" (manual approve without a code).
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok || !auth.user.isOwner) return res.status(403).json({ error: "Owner only." });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { email, action } = req.body || {};
  if (!email) return res.status(400).json({ error: "Missing email." });

  // Never revoke an owner.
  const { data: row } = await supabaseAdmin.from("team_access").select("is_owner").eq("email", email).single();
  if (row?.is_owner) return res.status(400).json({ error: "Can't revoke an owner." });

  const status = action === "approve" ? "approved" : "revoked";
  const patch = { status };
  if (status === "approved") { patch.approved_at = new Date().toISOString(); patch.code = null; patch.code_expires = null; }
  await supabaseAdmin.from("team_access").update(patch).eq("email", email);

  return res.status(200).json({ success: true });
}
