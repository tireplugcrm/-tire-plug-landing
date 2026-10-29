/**
 * The shop TVs (/shop-tv?key=...). The page sends the key in the x-tv-key header; it must match
 * app_settings 'shop_tv_key' (see lib/workorders-schema-v2.sql).
 *   GET                             -> the board. Customers can see the TVs, so names are first name +
 *                                      last initial and phones are left out.
 *   POST { action: "complete", id } -> a tech finished the job at the TV (checked in -> completed)
 *   POST { action: "undo", id }     -> put back a job completed in the last few minutes (wrong car)
 * That's all a TV can change; everything else is done in the admin.
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { loadBoard, setJobStatus } from "../../lib/shop-floor-db.js";
import { tvBoard, TV_UNDO_MINS } from "../../lib/shop-floor.js";

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  const got = req.headers["x-tv-key"] || "";
  const { data: setting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "shop_tv_key").maybeSingle();
  if (!got || (setting?.value || "").length < 32 || !same(got, setting.value)) return res.status(401).json({ error: "This TV link is not valid." });

  try {
    if (req.method === "POST") {
      const { action, id } = req.body || {};
      const { data: job } = await supabaseAdmin.from("work_orders").select("status, done_at, archived").eq("id", id).maybeSingle();
      if (!job || job.archived) return res.status(404).json({ error: "That car isn't on the board anymore." });
      let r;
      if (action === "complete" && job.status !== "done") r = await setJobStatus(id, "done", { by: "Bay TV" });
      else if (action === "undo" && job.status === "done" && Date.now() - new Date(job.done_at).getTime() < TV_UNDO_MINS * 60000) {
        r = await setJobStatus(id, "waiting", { by: "Bay TV (undo)" });
      } else return res.status(400).json({ error: "Can't do that from the TV." });
      if (r.error) return res.status(400).json({ error: r.error });
    }
    return res.status(200).json(tvBoard(await loadBoard()));
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
