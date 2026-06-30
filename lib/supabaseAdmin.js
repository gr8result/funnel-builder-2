// lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }

  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

let cachedAdmin = null;

export function createSupabaseAdmin() {
  if (!cachedAdmin) cachedAdmin = getSupabaseAdminClient();
  return cachedAdmin;
}

export const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    return createSupabaseAdmin()[prop];
  },
});

export const supabase = supabaseAdmin;
