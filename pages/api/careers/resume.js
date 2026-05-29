/**
 * Owner dashboard — get a short-lived signed URL to view a stored resume.
 */
import { supabaseAdmin, RESUME_BUCKET } from "../../../lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password, path } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin || !path) return res.status(400).json({ error: "Missing config or path." });

  const { data, error } = await supabaseAdmin.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, 60 * 10); // 10 minutes

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ url: data.signedUrl });
}
