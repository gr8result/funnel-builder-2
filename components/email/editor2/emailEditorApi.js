import { supabase } from "../../../utils/supabase-client";

export async function getEmailEditorAccessToken(errorMessage = "Sign in required.") {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  if (!token) throw new Error(errorMessage);
  return token;
}

export async function emailEditorFetch(url, options = {}, config = {}) {
  const token = await getEmailEditorAccessToken(config.authErrorMessage);
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  return fetch(url, {
    ...options,
    credentials: options.credentials || "same-origin",
    headers,
  });
}
