/**
 * Owner dashboard — update an applicant (notes, status, reviewed flag).
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

const ALLOWED_STATUS = ["scored", "rejected_knockout", "needs_review", "hired", "archived"];
const ALLOWED_STAGE = ["new", "contacted", "interview", "trial", "hired"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password, id, owner_notes, status, reviewed, stage } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin || !id) return res.status(400).json({ error: "Missing config or id." });

  const patch = {};
  if (owner_notes !== undefined) patch.owner_notes = owner_notes;
  if (reviewed !== undefined) patch.reviewed = !!reviewed;
  if (status !== undefined && ALLOWED_STATUS.includes(status)) patch.status = status;
  if (stage !== undefined && ALLOWED_STAGE.includes(stage)) patch.stage = stage;

  const { error } = await supabaseAdmin.from("applicants").update(patch).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
