// Auth restoration/refresh can finish after the workspace has mounted.
export async function requestApprovedCatalogue({ auth, workspaceId, fetcher = fetch, signal, session = null }) {
  // The auth observer already provides a validated client session. Reuse that
  // snapshot instead of contending for the cross-tab auth lock on every feed load.
  const sessionResult = session ? { data: { session } } : await auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  let token = sessionResult.data?.session?.access_token;
  if (!token) throw new Error('Sign in to load the builder approved quotation catalogue.');
  const url = `/api/product-library/approved-client-selection-catalogue?workspace_id=${encodeURIComponent(workspaceId)}`;
  const request = () => fetcher(url, { signal, headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  let response = await request();
  if (response.status === 401) {
    const refreshed = await auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    token = refreshed.data?.session?.access_token;
    if (!token) throw new Error('Sign in again to load the builder approved quotation catalogue.');
    response = await request();
  }
  if (!response.ok) {
    let message = '';
    try { message = (await response.json()).error || ''; } catch {}
    throw new Error(`Approved quotation catalogue: HTTP ${response.status}${message ? ` - ${message}` : ''}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.products)) throw new Error('Approved quotation catalogue returned an invalid product list.');
  return payload;
}
