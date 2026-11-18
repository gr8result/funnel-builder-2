// Call before creating clients or making requests. Acceptance never uses shared services.
export function requireQuotationAcceptanceEnvironment({ origin, supabaseUrl, workspaceId }) {
  const local = new Set(['localhost', '127.0.0.1', '[::1]']);
  for (const [name, value] of [['app', origin], ['Supabase', supabaseUrl]]) {
    let url;
    try { url = new URL(value); } catch { throw new Error(`Isolated ${name} URL is required.`); }
    if (!local.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)
      || !url.port || url.port === '3000' || url.username || url.password) {
      throw new Error(`${name} must use an explicit local non-3000 port. Refusing shared or production acceptance.`);
    }
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId || '')) {
    throw new Error('QB_ACCEPTANCE_WORKSPACE_ID must identify a disposable workspace in the isolated database.');
  }
}
