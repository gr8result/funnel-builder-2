import { requireUser } from '../../../lib/social/auth';
import {
  buildDeletedTemplateMarkerName,
  extractTemplateSourceHashFromTags,
  isTemplateSharedMedia,
  hashText,
  canonicalSourceUrl,
  clearMaterializationCaches,
} from '../../../lib/sharedMediaLibrary';

function resolveStorageTarget(storagePath = '') {
  const raw = String(storagePath || '');
  if (!raw) return null;
  if (raw.startsWith('assets:')) return { bucket: 'assets', path: raw.slice('assets:'.length) };
  return { bucket: 'social-images', path: raw };
}

function parseGenericLibrarySourceHash(assetPath = '') {
  const match = String(assetPath || '').match(/generic\/library-(\d+)-[a-f0-9]{20,64}\.[a-z0-9]+$/i);
  return match ? match[1] : '';
}

async function writeDeletedTemplateMarker(admin, markerPath = '') {
  if (!markerPath) return;
  await admin.storage.from('assets').upload(markerPath, Buffer.from('deleted', 'utf8'), {
    contentType: 'text/plain',
    upsert: true,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  // Hardcoded generic library entries (id = "generic:...") have no storage file;
  // deleting them writes a deleted-source-hash marker so they are suppressed from future loads.
  if (String(id).startsWith('generic:')) {
    if (!auth.isDeveloper) {
      return res.status(403).json({ ok: false, error: 'Only the developer account can delete template library images.' });
    }
    const sourceUrl = String(req.query.url || '');
    if (!sourceUrl) return res.status(400).json({ ok: false, error: 'url is required for generic entries' });
    const sourceHash = String(hashText(canonicalSourceUrl(sourceUrl)));
    if (!sourceHash) return res.status(400).json({ ok: false, error: 'Could not compute source hash for this entry' });
    await writeDeletedTemplateMarker(auth.admin, `generic/${buildDeletedTemplateMarkerName(sourceHash)}`);
    clearMaterializationCaches();
    return res.json({ ok: true });
  }

  if (String(id).startsWith('asset:')) {
    const assetPath = String(id).slice('asset:'.length);
    if (isTemplateSharedMedia(`assets:${assetPath}`) && !auth.isDeveloper) {
      return res.status(403).json({ ok: false, error: 'Only the developer account can delete template library images.' });
    }
    const storagePath = `assets:${assetPath}`;
    const { data: publicData } = auth.admin.storage.from('assets').getPublicUrl(assetPath);
    const publicUrl = publicData?.publicUrl || '';
    const genericSourceHash = parseGenericLibrarySourceHash(assetPath);
    if (genericSourceHash) {
      await writeDeletedTemplateMarker(auth.admin, `generic/${buildDeletedTemplateMarkerName(genericSourceHash)}`);
    }

    const { error: storageError } = await auth.admin.storage.from('assets').remove([assetPath]);
    if (storageError) return res.status(500).json({ ok: false, error: storageError.message });

    await auth.admin
      .from('social_image_library')
      .delete()
      .eq('user_id', auth.user.id)
      .or(`storage_path.eq.${storagePath},url.eq.${publicUrl}`);

    clearMaterializationCaches();
    return res.json({ ok: true });
  }

  // Get storage_path before deleting so we can remove from storage too
  const { data: img } = await auth.admin
    .from('social_image_library')
    .select('id, storage_path, user_id, tags')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (!img) return res.status(404).json({ ok: false, error: 'Image not found' });
  if (isTemplateSharedMedia(img.storage_path) && !auth.isDeveloper) {
    return res.status(403).json({ ok: false, error: 'Only the developer account can delete template library images.' });
  }

  // Remove from storage if uploaded there
  if (img.storage_path) {
    const templateSourceHash = extractTemplateSourceHashFromTags(img.tags);
    // Write marker using the template-source-hash tag (tracks the original template source URL).
    if (templateSourceHash) {
      await writeDeletedTemplateMarker(auth.admin, `${auth.user.id}/${buildDeletedTemplateMarkerName(templateSourceHash)}`).catch(() => {});
    }
    // Write a second marker using the storage path hash as a fallback — prevents
    // re-materialization even if the template-source-hash tag is absent or the
    // source URL changed (e.g. CDN migration). The materialization code checks both.
    const storagePathHash = String(hashText(img.storage_path));
    if (storagePathHash) {
      await writeDeletedTemplateMarker(auth.admin, `${auth.user.id}/${buildDeletedTemplateMarkerName(storagePathHash)}`).catch(() => {});
    }
    const target = resolveStorageTarget(img.storage_path);
    if (target?.path) await auth.admin.storage.from(target.bucket).remove([target.path]);
    await auth.admin
      .from('social_image_library')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('storage_path', img.storage_path);
    clearMaterializationCaches();
    return res.json({ ok: true });
  }

  const { error } = await auth.admin
    .from('social_image_library')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id);

  if (error) return res.status(500).json({ ok: false, error: error.message });

  return res.json({ ok: true });
}
