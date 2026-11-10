// 4-digit staff passcodes for the phone pages (/belen). SERVER ONLY.
// The code lives in app_settings `<who>_code` (set in the Supabase SQL editor, never in this repo);
// `<who>_lock` counts wrong tries so the 4 digits can't be guessed (6 tries, then 15 minutes).
import { supabaseAdmin } from "./supabaseAdmin.js";

const MAX_TRIES = 6, LOCK_MIN = 15;

async function setting(key) {
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value || "";
}

export async function checkStaffCode(who, code) {
  if (!/^[a-z]{2,20}$/.test(who)) return { ok: false, error: "Unknown page." };
  const real = String(await setting(`${who}_code`)).trim();
  if (!/^\d{4}$/.test(real)) return { ok: false, error: "The code isn't set up yet." };
  let lock = {};
  try { lock = JSON.parse((await setting(`${who}_lock`)) || "{}"); } catch { lock = {}; }
  if (lock.until && Date.now() < lock.until) return { ok: false, error: `Too many tries. Wait ${Math.ceil((lock.until - Date.now()) / 60000)} min.` };
  const save = (v) => supabaseAdmin.from("app_settings").upsert({ key: `${who}_lock`, value: JSON.stringify(v), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (String(code) === real) {
    if (lock.tries) await save({});
    return { ok: true };
  }
  const tries = (lock.until && Date.now() >= lock.until ? 0 : lock.tries || 0) + 1;
  await save(tries >= MAX_TRIES ? { tries, until: Date.now() + LOCK_MIN * 60000 } : { tries });
  return { ok: false, error: "Wrong code." };
}
