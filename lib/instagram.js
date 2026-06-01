/**
 * Instagram messaging (Meta Graph API) — send a DM and look up a sender's name.
 * Env: IG_PAGE_ACCESS_TOKEN (Page/Instagram access token), IG_GRAPH_VERSION (optional).
 */
// "Instagram API with Instagram login" uses graph.instagram.com.
// (The Facebook-Page version would use graph.facebook.com — override via IG_GRAPH_BASE.)
const GRAPH = `${process.env.IG_GRAPH_BASE || "https://graph.instagram.com"}/${process.env.IG_GRAPH_VERSION || "v21.0"}`;

export async function sendIgMessage({ igUserId, text }) {
  const token = process.env.IG_PAGE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "Instagram isn't connected yet (missing access token)." };
  if (!igUserId) return { ok: false, error: "No Instagram user to send to." };
  if (!text || !text.trim()) return { ok: false, error: "Message is empty." };
  try {
    const r = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: igUserId }, message: { text } }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: (data.error && data.error.message) || "Instagram send failed." };
    return { ok: true, id: data.message_id };
  } catch (e) {
    return { ok: false, error: "Could not reach Instagram." };
  }
}

// Best-effort: get the sender's name/username for a nicer lead record.
export async function getIgProfile(igUserId) {
  const token = process.env.IG_PAGE_ACCESS_TOKEN;
  if (!token || !igUserId) return null;
  try {
    const r = await fetch(`${GRAPH}/${igUserId}?fields=name,username&access_token=${encodeURIComponent(token)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return { name: d.name || d.username || null, username: d.username || null };
  } catch (e) {
    return null;
  }
}
