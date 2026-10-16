/**
 * Unsubscribe endpoint. Public; the signed ?e=&t= pair in every email is the guard.
 *   POST  — Gmail/Yahoo one-click unsubscribe (List-Unsubscribe-Post), and the /unsubscribe page button.
 *   GET   — someone pasted the header link into a browser: send them to the friendly page.
 */
import { readUnsub, suppress } from "../../lib/email.js";

export default async function handler(req, res) {
  const params = { e: req.query.e || req.body?.e, t: req.query.t || req.body?.t };
  if (req.method === "GET") {
    return res.redirect(302, `/unsubscribe?e=${encodeURIComponent(params.e || "")}&t=${encodeURIComponent(params.t || "")}`);
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const email = readUnsub(params);
  if (!email) return res.status(400).json({ error: "This unsubscribe link is invalid or incomplete." });
  try {
    await suppress(email, "unsubscribed");
  } catch (e) {
    console.error("Unsubscribe error:", e);
    return res.status(500).json({ error: "Something went wrong. Reply to the email with STOP and we'll remove you." });
  }
  return res.status(200).json({ ok: true, email });
}
