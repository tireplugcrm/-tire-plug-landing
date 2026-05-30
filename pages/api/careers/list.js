/**
 * Owner dashboard — list applicants (password gated).
 * Sorted: live candidates by strength score (desc), then knockouts.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { data, error } = await supabaseAdmin
    .from("applicants")
    .select("*")
    .order("strength_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ applicants: data });
}
