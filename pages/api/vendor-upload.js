/**
 * Distributor catalog upload straight from a signed-in portal page (Jarvis's vendor sync, or Claude on the shop PC).
 * The page reads its own search results and posts them here, so thousands of rows never pass through an agent.
 *   POST /api/vendor-upload?t=<pass>&vendor=Turbo&eta_days=1&append=1    body: JSON [{ size, brand, model, load_speed, qty, cost }]
 * The pass is a short-lived token from /api/agent "vendor-upload-token" (app_settings vendor_upload_token, 2 hours), so the
 * Jarvis key never sits on a third-party page. Sent as text/plain so the browser posts it without a CORS preflight.
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { loadVendor } from "../../lib/vendor-tires.js";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.setHeader("Access-Control-Allow-Headers", "content-type"); return res.status(204).end(); }
  if (req.method !== "POST") return res.status(405).end();
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "vendor_upload_token").maybeSingle();
  let pass = null;
  try { pass = JSON.parse(data?.value || "null"); } catch {}
  if (!pass?.token || Date.parse(pass.expires) < Date.now() || !same(req.query.t || "", pass.token)) return res.status(401).json({ error: "expired or wrong pass" });
  const vendor = String(req.query.vendor || "").slice(0, 40);
  let rows = req.body;
  if (typeof rows === "string") { try { rows = JSON.parse(rows); } catch { return res.status(400).json({ error: "bad JSON" }); } }
  if (!vendor || !Array.isArray(rows)) return res.status(400).json({ error: "vendor and rows are required" });
  const r = await loadVendor(vendor, rows, Number(req.query.eta_days) || 1, req.query.append === "1");
  await supabaseAdmin.from("agent_log").insert({ agent: "vendor-upload", message: `${vendor}: ${r.ok ? `${r.loaded} tires${req.query.append === "1" ? " (batch)" : ""}` : `error ${r.error}`}` });
  return res.status(r.ok ? 200 : 400).json(r);
}
