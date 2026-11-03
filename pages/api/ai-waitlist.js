/**
 * AI video waitlist (tireplugla.com/ai). Saves the questionnaire, grades it, and emails a confirmation.
 *
 * POST { first_name, email, has_business: "yes"|"no", business, instagram, goal: "customers"|"story"|"teach", website (honeypot) }
 *   -> { ok, qualified }
 * Grades: no business = X (doesn't qualify), customers = A, story = B, teach = C. Table: aip_waitlist (lib/ai-waitlist-schema.sql).
 */
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { sendOne } from "../../lib/email.js";

const GRADES = { customers: "A", story: "B", teach: "C" };
const clean = (v, n = 120) => String(v || "").trim().slice(0, n);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body || {};
  if (clean(b.website)) return res.json({ ok: true, qualified: true }); // bot
  if (!supabaseAdmin) return res.status(500).json({ error: "Signups open in a few minutes. Try again soon." });

  const email = clean(b.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
  const has_business = b.has_business === "yes";
  if (b.has_business !== "yes" && b.has_business !== "no") return res.status(400).json({ error: "Do you have a business? Pick yes or no." });
  const goal = has_business ? (GRADES[b.goal] ? b.goal : null) : null;
  if (has_business && !goal) return res.status(400).json({ error: "Pick your main goal." });
  const business = has_business ? clean(b.business) : null;
  if (has_business && !business) return res.status(400).json({ error: "Tell us what your business is." });

  const row = {
    email, has_business, goal, business,
    first_name: clean(b.first_name, 80) || null,
    instagram: clean(b.instagram, 60).replace(/^@/, "") || null,
    grade: has_business ? GRADES[goal] : "X",
    qualified: has_business,
    source: clean(b.source, 40) || "tireplug-story",
  };
  const { error } = await supabaseAdmin.from("aip_waitlist").upsert(row, { onConflict: "email" });
  if (error) { console.error("ai-waitlist:", error.message); return res.status(500).json({ error: "Couldn't save that. Please try again." }); }

  if (has_business) {
    const name = esc(row.first_name || "there");
    await sendOne({
      to: email, transactional: true, tags: { kind: "ai-waitlist" },
      subject: "You're on the AI video waitlist",
      html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#111;max-width:520px">
<p>Hey ${name},</p>
<p>You're on the list. On <b>Sunday, November 8, before midnight</b>, I'm emailing you a PDF with the tools I use to make the AI videos for my tire shop.</p>
<p>Watch for it from this address. If it's not in your inbox by Monday morning, check your spam or promotions folder.</p>
<p>See you Sunday,<br>The Tire Plug x The AI Plug</p>
<p style="font-size:12px;color:#777">You got this because you joined the waitlist at tireplugla.com/ai. All the videos are made with AI tools.</p></div>`,
      text: `Hey ${row.first_name || "there"},\n\nYou're on the list. On Sunday, November 8, before midnight, I'm emailing you a PDF with the tools I use to make the AI videos for my tire shop.\n\nIf it's not in your inbox by Monday morning, check your spam or promotions folder.\n\nThe Tire Plug x The AI Plug`,
    }).catch((e) => console.error("ai-waitlist email:", e.message));
  }
  return res.json({ ok: true, qualified: has_business });
}
