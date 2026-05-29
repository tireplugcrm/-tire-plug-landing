/**
 * Server-only Supabase client (service-role key).
 * NEVER import this from a component that runs in the browser - the
 * service-role key bypasses row-level security. API routes only.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null;

export const RESUME_BUCKET = "resumes";
