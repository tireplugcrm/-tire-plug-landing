/**
 * A Google-signed-in user requests access. If they're already approved/owner,
 * return approved. Otherwise generate a one-time code, store it, and send it to
 * the OWNER (email via Resend + text via Twilio). The owner relays the code to
 * the person if they trust them.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { getGoogleUser } from "../../../lib/adminAuth.js";
import { sendSms } from "../../../lib/sms.js";

const OWNER_EMAIL = process.env.ADMIN_ALERT_EMAIL || "alejandro.l@tirexchange.org";
const OWNER_PHONE = process.env.ADMIN_ALERT_PHONE || "562-500-4625";

function gen6() {
  // 6-digit code, zero-padded.
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

async function emailOwner(code, who) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "The Tire Plug <deals@tireplugla.com>",
        to: OWNER_EMAIL,
        subject: `🔐 Admin access request — code ${code}`,
        text: `${who} is trying to log into the Tire Plug admin.\n\nAccess code: ${code}\n\nGive this code to them ONLY if you trust them. It expires in 20 minutes. If this wasn't expected, ignore this email and don't share the code.`,
      }),
    });
  } catch (e) { console.error("owner email error:", e); }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const gu = await getGoogleUser(req);
  if (!gu) return res.status(401).json({ error: "Sign in with Google first." });

  // Already approved or owner?
  const { data: existing } = await supabaseAdmin.from("team_access").select("*").eq("email", gu.email).single();
  if (existing && (existing.status === "approved" || existing.is_owner)) {
    return res.status(200).json({ status: "approved", name: existing.name || gu.name, isOwner: !!existing.is_owner });
  }
  if (existing && existing.status === "revoked") {
    // Revoked users can re-request; owner must re-approve with a fresh code.
  }

  const code = gen6();
  const expires = new Date(Date.now() + 20 * 60000).toISOString();

  await supabaseAdmin.from("team_access").upsert(
    { email: gu.email, name: gu.name, status: "pending", code, code_expires: expires },
    { onConflict: "email" }
  );

  const who = `${gu.name || "Someone"} (${gu.email})`;
  await emailOwner(code, who);
  // Text the owner too (works once the A2P campaign is approved; harmless if not).
  try { await sendSms({ to: OWNER_PHONE, body: `Tire Plug admin: ${who} wants access. Code: ${code} (expires 20 min). Share only if you trust them.` }); } catch (e) {}

  return res.status(200).json({ status: "pending" });
}
