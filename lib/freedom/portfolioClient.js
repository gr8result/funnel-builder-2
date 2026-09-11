/**
 * The browser side of the Freedom authentication contract.
 *
 * Every Freedom API route is guarded (M2.1) and requires
 * `Authorization: Bearer <Supabase access token>`. That token comes from the
 * session the user already holds - there is no second credential and no bypass.
 *
 * Two rules keep the contract honest:
 *
 *   1. A Freedom request is never sent without a token. Sending one anyway
 *      produced a bare "401 Authentication required" that read like a broken
 *      guard when the real state was "this browser has no session". The request
 *      is now refused locally, with a message that says so.
 *
 *   2. A token the server rejects is refreshed once and the request retried
 *      once. One refresh is shared across a whole load, so three collections
 *      failing together cause one refresh, not three.
 */

/** A local, pre-flight authentication failure. Mirrors the guard's own codes. */
export class FreedomAuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "FreedomAuthError";
    this.code = code;
    this.status = 401;
  }
}

export const SIGNED_OUT_MESSAGE = "You are not signed in, so Freedom cannot load your data. Sign in and try again.";
export const SESSION_REJECTED_MESSAGE = "Your session is no longer valid. Sign in again to load Freedom.";

/** The current access token, or null when this browser has no session. */
export async function accessToken(auth) {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  return data?.session?.access_token || null;
}

/**
 * Headers for a Freedom request, omitting Authorization when there is no
 * session. Callers that must not proceed unauthenticated should use
 * {@link authenticatedHeaders} instead.
 */
export async function portfolioHeaders(auth, json = false) {
  const token = await accessToken(auth);
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Headers for a Freedom request that cannot succeed without a session.
 * Throws before the request is sent, so a signed-out browser reports being
 * signed out rather than reporting the guard's 401.
 */
export async function authenticatedHeaders(auth, json = false) {
  const headers = await portfolioHeaders(auth, json);
  if (!headers.Authorization) throw new FreedomAuthError(SIGNED_OUT_MESSAGE, "no_token");
  return headers;
}

async function readCollection(fetcher, url, key, options) {
  const response = await fetcher(url, options);
  const body = await response.json().catch(() => null);
  if (response.status !== 200 || body?.ok === false || !Array.isArray(body?.[key])) {
    const detail = body?.error || body?.errors?.join(" ") || "Invalid portfolio response.";
    const error = new Error(`${url} (${response.status}): ${detail}`);
    error.status = response.status;
    error.code = body?.code || null;
    error.url = url;
    throw error;
  }
  return {
    data: body[key],
    archivedHoldings: body.archivedHoldings || [],
    brokerPortfolioSnapshot: body.brokerPortfolioSnapshot || null,
  };
}

export const PORTFOLIO_COLLECTIONS = {
  holdings: { url: "/api/freedom/long-term", key: "holdings" },
  pendingBuyOrders: { url: "/api/freedom/trades?type=PENDING_BUY_ORDER", key: "trades" },
  pendingSellOrders: { url: "/api/freedom/trades?type=PENDING_SELL_ORDER", key: "trades" },
  shortTermHoldings: { url: "/api/freedom/trades?type=ACTIVE_HOLDING", key: "trades" },
  closedShortTermTrades: { url: "/api/freedom/trades?type=CLOSED", key: "trades" },
};

/** True when the server rejected the token we sent, rather than finding none. */
function tokenWasRejected(error) {
  return error?.status === 401 && error?.code === "invalid_token";
}

export async function loadPortfolio({ auth, fetcher = fetch, signal, onCollection, collections = Object.keys(PORTFOLIO_COLLECTIONS) } = {}) {
  let headers;
  let authError;
  try { headers = await authenticatedHeaders(auth); } catch (error) { authError = error; }

  // One refresh for the whole load. Collections run in parallel, so without this
  // a rejected token would trigger a refresh per collection.
  let refresh = null;
  const refreshedHeaders = () => {
    if (!refresh) {
      refresh = (async () => {
        const { error } = await auth.refreshSession();
        if (error) throw new FreedomAuthError(SESSION_REJECTED_MESSAGE, "invalid_token");
        return authenticatedHeaders(auth);
      })();
    }
    return refresh;
  };

  const settled = await Promise.allSettled(collections.map(async name => {
    const { url, key } = PORTFOLIO_COLLECTIONS[name];
    let result;
    try {
      if (authError) throw authError;
      let collection;
      try {
        collection = await readCollection(fetcher, url, key, { headers, signal, cache: "no-store" });
      } catch (error) {
        if (!tokenWasRejected(error) || signal?.aborted) throw error;
        collection = await readCollection(fetcher, url, key, { headers: await refreshedHeaders(), signal, cache: "no-store" });
      }
      result = { status: "success", ...collection, error: null };
    } catch (error) {
      result = { status: "error", data: [], error: { message: error.message, status: error.status || null, code: error.code || null, url } };
    }
    if (!signal?.aborted) onCollection?.(name, result);
    return [name, result];
  }));
  return Object.fromEntries(settled.filter(result => result.status === "fulfilled").map(result => result.value));
}
