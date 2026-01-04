// /lib/entitlements.js
// Central place to work out which modules a user has access to.

import { supabase } from "../utils/supabase-client";

export async function getEntitlements() {
  try {
    // Get the current session (browser-side)
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      console.error("getEntitlements: error getting session", sessionError);
      return new Set();
    }

    const session = sessionData?.session;
    if (!session?.user?.id) {
      // not logged in
      return new Set();
    }

    // Look up which modules this user has enabled
    const { data, error } = await supabase
      .from("user_modules")
      .select("module_id")
      .eq("user_id", session.user.id);

    if (error) {
      console.error("getEntitlements: error loading user_modules", error);
      return new Set();
    }

    return new Set((data || []).map((row) => row.module_id));
  } catch (err) {
    console.error("getEntitlements: unexpected error", err);
    return new Set();
  }
}
