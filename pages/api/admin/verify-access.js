/**
 * The person enters the code the owner gave them. If it matches and hasn't
 * expired, mark them approved.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { getGoogleUser } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const gu = await getGoogleUser(req);
  if (!gu) return res.status(401).json({ error: "Sign in with Google first." });

  const code = String((req.body || {}).code || "").trim();
  if (!code) return res.status(400).json({ error: "Enter the code." });

  const { data: row } = await supabaseAdmin.from("team_access").select("*").eq("email", gu.email).single();
  if (!row) return res.status(400).json({ error: "No access request found — try signing in again." });
  if (row.status === "approved" || row.is_owner) return res.status(200).json({ status: "approved" });

  if (!row.code || row.code !== code) return res.status(400).json({ error: "That code isn't right." });
  if (row.code_expires && new Date(row.code_expires) < new Date()) {
    return res.status(400).json({ error: "That code expired — sign in again to get a new one." });
  }

  await supabaseAdmin.from("team_access")
    .update({ status: "approved", approved_at: new Date().toISOString(), code: null, code_expires: null, last_active: new Date().toISOString() })
    .eq("email", gu.email);

  return res.status(200).json({ status: "approved" });
}
