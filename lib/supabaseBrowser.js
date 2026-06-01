/**
 * Browser-side Supabase client (public anon key) — used only for Google login
 * on the admin page. Safe to ship to the browser.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseBrowser =
  url && anon ? createClient(url, anon, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;
