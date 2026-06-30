// lib/social/apiUtils.js
// Shared fetch helper for the social media module.
// Guarantees that callers always get a parsed object back, NEVER a raw
// SyntaxError — even when the server returns an HTML error page.

/**
 * Fetch a JSON API endpoint with a Bearer token.
 * Returns a plain object. Never throws a JSON parse error.
 *
 * On success: returns the parsed JSON body.
 * On HTTP error or HTML body: returns { ok: false, error: "<description>" }
 */
export async function apiFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    return { success: false, ok: false, error: `Network error: ${networkErr.message}` };
  }

  // Try to parse JSON; if the server returned HTML, extract a useful message.
  let body;
  try {
    const text = await res.text();
    if (!text) return { success: res.ok, ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };

    try {
      body = JSON.parse(text);
    } catch {
      // Server returned non-JSON (HTML error page, plain text, etc.)
      const title  = text.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim();
      const detail = title || text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      return {
        success: false,
        ok:    false,
        error: `Server error (HTTP ${res.status})${detail ? `: ${detail}` : ''}. Please try again.`,
      };
    }
  } catch (readErr) {
    return { success: false, ok: false, error: `Could not read response: ${readErr.message}` };
  }

  if (body && typeof body === 'object') {
    if (body.ok === undefined && body.success !== undefined) body.ok = body.success;
    if (body.success === undefined && body.ok !== undefined) body.success = body.ok;
  }

  if (!res.ok && body?.success !== false && body?.ok !== false) {
    body = { ...body, success: false, ok: false };
  }

  return { ...body, _status: res.status, _ok: res.ok };
}

/**
 * Build authorization headers from a Supabase session token.
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
