/**
 * Admin auth for API routes. Two ways to be authorized:
 *   1) Owner password (CAREERS_ADMIN_PASSWORD) — the backup / owner login.
 *   2) Google session token whose email is APPROVED (or an owner) in team_access.
 *
 * requireAdmin(req) -> { ok, user } where user = { email, name, isOwner }.
 * Pass-through so existing password flow keeps working unchanged.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";

export async function requireAdmin(req) {
  const body = req.body || {};

  // 1) Owner password
  if (body.password && process.env.CAREERS_ADMIN_PASSWORD && body.password === process.env.CAREERS_ADMIN_PASSWORD) {
    return { ok: true, user: { email: "owner", name: "Owner", isOwner: true }, viaPassword: true };
  }

  // 2) Google session token (from body or Authorization header)
  const token = body.accessToken || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      const email = data?.user?.email?.toLowerCase();
      if (!error && email) {
        const { data: row } = await supabaseAdmin.from("team_access").select("*").eq("email", email).single();
        if (row && (row.status === "approved" || row.is_owner)) {
          return {
            ok: true,
            user: { email, name: row.name || data.user.user_metadata?.full_name || email, isOwner: !!row.is_owner },
          };
        }
      }
    } catch (e) { /* fall through to unauthorized */ }
  }

  return { ok: false };
}

/** Verify a Google token and return its email/name (no approval check). */
export async function getGoogleUser(req) {
  const body = req.body || {};
  const token = body.accessToken || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const email = data?.user?.email?.toLowerCase();
    if (error || !email) return null;
    return { email, name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || email };
  } catch (e) {
    return null;
  }
}
