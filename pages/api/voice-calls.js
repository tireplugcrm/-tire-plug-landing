/**
 * ElevenLabs post-call webhook for the phone AI (Mary): every finished call lands in phone_calls
 * (lib/phone-calls-schema.sql), and its recording in the private "phone-calls" bucket.
 *   post_call_transcription -> the call row (lib/phone-calls.js rowFromCall)
 *   post_call_audio         -> phone-calls/<conversation_id>.mp3 (short calls; see fetchRecording)
 * ElevenLabs sends header x-voice-key = VOICE_AGENT_KEY (set on the workspace webhook by
 * scripts/voice-agent-setup.mjs).
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { rowFromCall } from "../../lib/phone-calls.js";

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
      const { error } = await supabaseAdmin.from("phone_calls").upsert(row, { onConflict: "id" });
      if (error) throw error;
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
