import { requireUser } from '../../../lib/social/auth';

async function listAllStorageEntries(admin, bucket, prefix) {
  const entries = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: 'created_at', order: 'asc' } });

    if (error) throw error;

    const batch = data || [];
    entries.push(...batch);
    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return entries;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  try {
    return res.status(200).json({
      ok: true,
      removedTemplateFiles: 0,
      message: 'Template reset is disabled to protect user-owned library images.',
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Could not reset template library images' });
  }
}