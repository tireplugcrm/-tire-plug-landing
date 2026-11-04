/**
 * ElevenLabs post-call webhook for the phone AI (Mary): every finished call lands in phone_calls
 * (lib/phone-calls-schema.sql), and its recording in the private "phone-calls" bucket.
 *   post_call_transcription -> the call row (lib/phone-calls.js rowFromCall), plus a backup price recap
 *                              text when Mary quoted tires but didn't text the caller
 *   post_call_audio         -> phone-calls/<conversation_id>.mp3 (short calls; see fetchRecording)
 * ElevenLabs sends header x-voice-key = VOICE_AGENT_KEY (set on the workspace webhook by
 * scripts/voice-agent-setup.mjs).
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { rowFromCall } from "../../lib/phone-calls.js";
import { sendSms } from "../../lib/sms.js";
import { sizeToSlug } from "../../lib/tire-catalog.js";
import { SITE } from "../../lib/invoices.js";
import { PAYMENT } from "./voice-agent.js";

export const config = { api: { bodyParser: { sizeLimit: "4.5mb" } } };
export const maxDuration = 60;
export const BUCKET = "phone-calls";

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Recordings over ~3 minutes are too big for a webhook body (Vercel caps requests at 4.5 MB), so the
// recording is pulled from ElevenLabs once the transcript arrives. Needs ELEVENLABS_AGENTS_KEY
// (Agents read); without it only short calls get the audio webhook's copy.
async function fetchRecording(id) {
  if (!process.env.ELEVENLABS_AGENTS_KEY) return;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${id}/audio`, {
      headers: { "xi-api-key": process.env.ELEVENLABS_AGENTS_KEY }, signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return console.error(`voice-calls: recording ${id} -> ${r.status}`);
    const path = `${id}.mp3`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, Buffer.from(await r.arrayBuffer()), { contentType: "audio/mpeg", upsert: true });
    if (error) throw error;
    await supabaseAdmin.from("phone_calls").update({ recording_path: path }).eq("id", id);
  } catch (err) {
    console.error(`voice-calls: recording ${id}:`, err);
  }
}

// Every caller who got a tire price gets a recap text (owner, 11-03), booked or not. Mary sends the full
// breakdown on the call (text_link); if she didn't, this sends the two best per-tire prices from
// what she quoted. Brake callers get their recap from Mary and the exact quote from Jarvis.
async function backupRecap(row) {
  if (!row.quoted || row.text_sent || row.data?.recap_sent_at || !row.caller || !row.quotes?.length) return;
  const q = row.quotes[row.quotes.length - 1];
  const opts = (q.in_stock.length ? q.in_stock : q.next_day).filter((t) => t.price != null).slice(0, 2);
  if (!opts.length) return;
  const qty = q.quantity || 4;
  const body = [
    `Thanks for calling The Tire Plug${row.caller_name ? `, ${row.caller_name}` : ""}! Your quote for ${qty} tires, ${q.size}:`,
    ...opts.map((t) => `${t.brand} ${t.model}: $${t.price} a tire${q.in_stock.length ? "" : " (next-day)"}`),
    "Mount & balance: $25 a wheel. Plus tax.",
    row.booked ? "See you at your appointment!" : `Book here: ${SITE}/tires/${sizeToSlug(q.size)} or reply to this text.`,
    PAYMENT,
    "2331 E Olympic Blvd, Los Angeles. 562-500-4625",
  ].join("\n");
  const r = await sendSms({ to: row.caller, body });
  console.log(`voice-calls: backup recap to ...${row.caller.slice(-4)} ${r.ok ? "sent" : `failed: ${r.error}`}`);
  if (r.ok) await supabaseAdmin.from("phone_calls").update({ text_sent: true, data: { ...(row.data || {}), recap_sent_at: new Date().toISOString() } }).eq("id", row.id);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const key = process.env.VOICE_AGENT_KEY || "";
  if (key.length < 32 || !same(req.headers["x-voice-key"] || "", key)) return res.status(401).end();
  if (!supabaseAdmin) return res.status(500).json({ error: "Database not configured." });
  const { type, data } = req.body || {};
  if (!data?.conversation_id) return res.status(400).json({ error: "no conversation" });
  const id = data.conversation_id;

  try {
    if (type === "post_call_transcription") {
      const row = rowFromCall(data);
      // Keep the backup-recap stamp across webhook retries so a caller never gets it twice.
      const { data: prev } = await supabaseAdmin.from("phone_calls").select("data").eq("id", id).maybeSingle();
      row.data = { ...(row.data || {}), recap_sent_at: prev?.data?.recap_sent_at || null };
      const { error } = await supabaseAdmin.from("phone_calls").upsert(row, { onConflict: "id" });
      if (error) throw error;
      await backupRecap(row);
      await fetchRecording(id);
      console.log(`voice-calls: ${id} ${row.duration_secs}s ${row.intent || "?"} booked=${row.booked} quality=${row.quality_score}`);
      return res.status(200).json({ ok: true });
    }
    if (type === "post_call_audio" && data.full_audio) {
      const path = `${id}.mp3`;
      const { error: upErr } = await supabaseAdmin.storage.from(BUCKET)
        .upload(path, Buffer.from(data.full_audio, "base64"), { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw upErr;
      // The audio can arrive before the transcript: make the row now, the transcript fills it in.
      const { data: hit } = await supabaseAdmin.from("phone_calls").update({ recording_path: path }).eq("id", id).select("id");
      if (!hit?.length) await supabaseAdmin.from("phone_calls").insert({ id, started_at: new Date().toISOString(), recording_path: path });
      return res.status(200).json({ ok: true });
    }
    return res.status(200).json({ ok: true, ignored: type });
  } catch (err) {
    console.error("voice-calls:", err);
    return res.status(500).json({ error: "save failed" }); // ElevenLabs retries
  }
}
