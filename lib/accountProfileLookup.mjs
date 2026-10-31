const ACCOUNT_PROFILE_SELECT = "business_name, business_logo, business_logo_url, business_avatar, business_avatar_url, approved, is_approved, status, subscription_status";

function normalizeAccountProfile(account) {
  if (!account || typeof account !== "object") return account || null;
  return {
    onboarding_completed: true,
    phone_verified: true,
    email_verified: true,
    ...account,
  };
}

export async function loadAccountProfile(db, userId) {
  let query = db
    .from("accounts")
    .select(ACCOUNT_PROFILE_SELECT)
    .eq("user_id", userId);
  if (typeof AbortSignal !== "undefined" && typeof query.abortSignal === "function") {
    query = query.abortSignal(AbortSignal.timeout(8000));
  }
  const { data, error } = await query.maybeSingle();
  return { data: normalizeAccountProfile(data), error: error || null };
}
