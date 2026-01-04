// /pages/_guard.js
// Access control and onboarding gatekeeper for all protected pages

import { supabase } from "../utils/supabase-client";

export async function requireOnboardedUser(ctx) {
  // Get active user session
  const { data: { session } } = await supabase.auth.getSession();

  // If no session, redirect to login
  if (!session?.user) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  // Fetch profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("approved")
    .eq("user_id", session.user.id)
    .single();

  // If no profile found or not approved, redirect to onboarding
  if (error || !profile || profile.approved === false) {
    return {
      redirect: {
        destination: "/account",
        permanent: false,
      },
    };
  }

  // Allow access
  return { props: { user: session.user } };
}
