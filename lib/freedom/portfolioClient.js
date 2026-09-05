export async function portfolioHeaders(auth, json = false) {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readCollection(fetcher, url, key, options) {
  const response = await fetcher(url, options);
  const body = await response.json().catch(() => null);
  if (response.status !== 200 || body?.ok === false || !Array.isArray(body?.[key])) {
    const detail = body?.error || body?.errors?.join(" ") || "Invalid portfolio response.";
    const error = new Error(`${url} (${response.status}): ${detail}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }
  return { data: body[key], archivedHoldings: body.archivedHoldings || [] };
}

export const PORTFOLIO_COLLECTIONS = {
  holdings: { url: "/api/freedom/long-term", key: "holdings" },
  pendingBuyOrders: { url: "/api/freedom/trades?type=PENDING_BUY_ORDER", key: "trades" },
  shortTermHoldings: { url: "/api/freedom/trades?type=ACTIVE_HOLDING", key: "trades" },
};

export async function loadPortfolio({ auth, fetcher = fetch, signal, onCollection, collections = Object.keys(PORTFOLIO_COLLECTIONS) } = {}) {
  let headers;
  let authError;
  try { headers = await portfolioHeaders(auth); } catch (error) { authError = error; }
  const settled = await Promise.allSettled(collections.map(async name => {
    const { url, key } = PORTFOLIO_COLLECTIONS[name];
    let result;
    try {
      if (authError) throw authError;
      const collection = await readCollection(fetcher, url, key, { headers, signal, cache: "no-store" });
      result = { status: "success", ...collection, error: null };
    } catch (error) {
      result = { status: "error", data: [], error: { message: error.message, status: error.status || null, url } };
    }
    if (!signal?.aborted) onCollection?.(name, result);
    return [name, result];
  }));
  return Object.fromEntries(settled.filter(result => result.status === "fulfilled").map(result => result.value));
}
