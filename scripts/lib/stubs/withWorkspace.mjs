// Test stub for lib/withWorkspace: the real wrapper verifies a Supabase JWT and membership; here the test supplies
// the already-authenticated user and workspace through headers. Role checks are kept so 403 paths still run.
const ROLE_HEADER = 'x-test-role';

export function withWorkspace(handler, { roles } = {}) {
  return async (req, res) => {
    const userId = req.headers['x-test-user'];
    const workspaceId = req.headers['x-test-workspace'];
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized: missing token' });
    if (!workspaceId) return res.status(400).json({ ok: false, error: 'Missing workspace' });
    const role = req.headers[ROLE_HEADER] || 'owner';
    if (roles && !roles.includes(role)) return res.status(403).json({ ok: false, error: 'Forbidden' });
    req.user = { id: userId };
    req.workspaceId = workspaceId;
    req.memberRole = role;
    return handler(req, res);
  };
}

export function withAuth(handler) {
  return async (req, res) => {
    const userId = req.headers['x-test-user'];
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    req.user = { id: userId };
    return handler(req, res);
  };
}

export function requestWorkspaceId(req) {
  return req.headers['x-workspace-id'] || req.headers['x-test-workspace'] || null;
}
