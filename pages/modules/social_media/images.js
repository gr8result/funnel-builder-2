import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';
import { getFunnelTemplateLibraryAssets } from '../../../lib/funnelSections';
import { getWebsiteTemplateLibraryAssets } from '../../../lib/website-builder/templateLibraryAssets';
import ImageEditorCard from '../../../components/image-editor/ImageEditorCard';

const AUTO_SEED_VERSION = 'shared-generic-library-v7';

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

export default function ImageLibrary() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [images, setImages]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [notice, setNotice]     = useState('');
  const [deleting, setDeleting] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [preview, setPreview]   = useState(null); // full-screen preview
  const [editingImage, setEditingImage] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [permissions, setPermissions] = useState({ canManageTemplateImages: false });
  const fileRef = useRef();

  useEffect(() => {
    let mounted = true;
    let authSubscription;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data?.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });
    authSubscription = data?.subscription;

    return () => {
      mounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapLibrary = async () => {
      await loadImages();
      if (cancelled) return;
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          if (cancelled) return;
          seedGenericLibrary().then((didSeed) => {
            if (didSeed && !cancelled) {
              loadImages({ showLoader: false });
            }
          });
        }, 0);
      }
    };

    if (session?.user?.id) {
      bootstrapLibrary();
    } else {
      setLoading(false);
      setImages([]);
    }

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function seedGenericLibrary() {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      const token = session?.access_token || '';
      const userId = session?.user?.id;
      if (!token || !userId) return false;

      const syncKey = `gr8:shared-media-sync:${userId}:${AUTO_SEED_VERSION}`;
      if (typeof window !== 'undefined' && window.localStorage.getItem(syncKey)) return false;
      setSyncing(true);

      const genericAssets = [...getFunnelTemplateLibraryAssets(), ...getWebsiteTemplateLibraryAssets()];
      const dedupedAssets = Array.from(new Map(genericAssets.map((asset) => [String(asset?.src || '').trim(), asset])).values());

      for (let index = 0; index < dedupedAssets.length; index += 20) {
        const chunk = dedupedAssets.slice(index, index + 20).map((asset) => ({
          assetKey: asset.id,
          name: asset.name,
          imageUrl: asset.src,
        }));

        const res = await fetch('/api/assets/import-library', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ assets: chunk }),
        });

        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || 'Could not seed shared media library');
        }
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(syncKey, String(Date.now()));
      }
      return true;
    } catch (err) {
      setNotice((current) => current || err?.message || 'Could not seed generic library images.');
      return false;
    } finally {
      setSyncing(false);
    }
  }

  async function loadImages(options = {}) {
    const { showLoader = true } = options;
    if (showLoader) setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setNotice('Sign in to view your image library.');
        if (showLoader) setLoading(false);
        return;
      }
      const res  = await fetch('/api/social/list-images', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load images');
      setImages(json.images || []);
      setPermissions(json.permissions || { canManageTemplateImages: false });
    } catch (err) { setNotice(err.message); }
    finally { if (showLoader) setLoading(false); }
  }

  async function deleteImage(id) {
    if (!confirm('Delete this image? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const token = await getToken();
      const res  = await fetch(`/api/social/delete-image?id=${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Delete failed');
      setImages(prev => prev.filter(img => img.id !== id));
    } catch (err) { setNotice(err.message); }
    finally { setDeleting(''); }
  }

  async function uploadFile(file) {
    if (!file) return;
    setUploading(true); setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('You must be signed in to upload images.');
      // Wrap FileReader in a Promise so errors and async/await work correctly
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve(e.target.result);
        reader.onerror = ()  => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });
      const res  = await fetch('/api/social/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: dataUrl, description: file.name }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Upload failed');
      setNotice('Image uploaded.');
      await loadImages({ showLoader: false });
    } catch (err) { setNotice(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function cleanupLibrary() {
    if (!permissions.canManageTemplateImages) {
      setNotice('Only developer accounts can remove shared library duplicates.');
      return;
    }
    if (!confirm('Remove duplicate saved images from the shared media library? This keeps one copy of each image and deletes the extras.')) return;
    setCleaning(true);
    setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('You must be signed in to clean the library.');
      const res = await fetch('/api/social/cleanup-image-library', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Cleanup failed');
      setNotice(`Cleanup finished. Removed ${json.removedLegacyGenericFiles || 0} legacy generic files, ${json.removedInvalidFiles || 0} invalid files, ${json.removedStorageDuplicates || 0} duplicate files, and ${json.removedIndexDuplicates || 0} duplicate library entries.`);
      await loadImages({ showLoader: false });
    } catch (err) {
      setNotice(err.message || 'Cleanup failed');
    } finally {
      setCleaning(false);
    }
  }

  async function saveEditedImage(imageUrl) {
    if (!editingImage) return;
    try {
      const token = await getToken();
      if (!token) throw new Error('You must be signed in to edit images.');
      setSavingEdit(true);

      const saveRes = await fetch('/api/social/save-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageUrl,
          description: editingImage.description || editingImage.name || 'Edited image',
        }),
      });

      const saveJson = await saveRes.json();
      if (!saveRes.ok || !saveJson?.ok) {
        throw new Error(saveJson?.error || 'Could not save edited image');
      }

      if (editingImage?.canManageOriginal && editingImage.id) {
        const deleteRes = await fetch(`/api/social/delete-image?id=${encodeURIComponent(editingImage.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const deleteJson = await deleteRes.json();
        if (!deleteRes.ok || !deleteJson?.ok) {
          throw new Error(deleteJson?.error || 'Could not replace the original image');
        }
        setNotice('Image updated.');
      } else {
        setNotice('Edited image saved as a new copy.');
      }

      setEditingImage(null);
      await loadImages({ showLoader: false });
    } catch (err) {
      setNotice(err.message || 'Could not save edited image.');
    } finally {
      setSavingEdit(false);
    }
  }

  function canManageOriginalImage(image) {
    if (!image) return false;
    return !image.is_template || permissions.canManageTemplateImages;
  }

  return (
    <>
      <Head><title>Image Library — Social Media</title></Head>
      <div style={{ minHeight: '100vh', background: '#0c0420', fontFamily: 'system-ui,sans-serif', color: '#F3F0FF' }}>

        {/* Banner */}
        <div style={{ maxWidth: 1320, margin: '16px auto 0', background: 'linear-gradient(135deg,#1e0a4a 0%,#140630 100%)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 16, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(167,139,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🖼️</div>
            <div>
              <div style={{ fontSize: 48, fontWeight: 600, color: '#F3F0FF', margin: 0 }}>Image Library</div>
              <div style={{ fontSize: 18, color: '#A78BFA', marginTop: 2 }}>Shared media library for Social, Email, Websites, Funnels, and more</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.2)', color: '#C4B5FD', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {uploading ? 'Uploading…' : '⬆ Upload Image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadFile(e.target.files[0])} />
            {permissions.canManageTemplateImages ? (
              <button onClick={cleanupLibrary} disabled={cleaning} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.35)', color: '#fecaca', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {cleaning ? 'Cleaning…' : 'Clean Duplicates'}
              </button>
            ) : null}
            <button onClick={() => router.push('/modules/social_media/create')} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.2)', color: '#C4B5FD', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Create</button>
            <button onClick={() => router.push('/modules/social_media/review')} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.2)', color: '#C4B5FD', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Review Posts</button>
            <button onClick={() => router.push('/modules/social_media/dashboard')} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.2)', color: '#C4B5FD', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Exit Module</button>
          </div>
        </div>

        <div style={{ padding: '24px 20px', maxWidth: 1320, margin: '0 auto' }}>

          {notice && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(167,139,250,0.4)', fontSize: 14, color: '#DDD6FE' }}>{notice}</div>}

          {/* Stats bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: '#A78BFA', fontSize: 14 }}>{images.length} image{images.length !== 1 ? 's' : ''} saved</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {syncing ? <span style={{ color: '#DDD6FE', fontSize: 12 }}>Syncing shared library in the background…</span> : null}
              {permissions.canManageTemplateImages ? (
                <button onClick={cleanupLibrary} disabled={cleaning} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.35)', color: '#fecaca', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {cleaning ? 'Cleaning…' : 'Clean Duplicates'}
                </button>
              ) : null}
              <button onClick={loadImages} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>↻ Refresh</button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>Loading images…</div>
          ) : images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🖼️</div>
              <div style={{ fontSize: 16, marginBottom: 16 }}>No images saved yet.</div>
              <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 20 }}>Images from Social, Email, Funnels, Websites, and other shared modules are shown here from the same assets bucket.</div>
              <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#6D28D9)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>⬆ Upload an Image</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {images.map(img => {
                const canManageOriginal = canManageOriginalImage(img);
                return (
                <div key={img.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={img.url}
                    alt={img.description || 'Social image'}
                    onClick={() => setEditingImage({ ...img, canManageOriginal })}
                    style={{ width: '100%', height: 200, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                  />
                  <div style={{ padding: '8px 10px' }}>
                    {img.description && (
                      <div style={{ fontSize: 12, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }} title={img.description}>
                        {img.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#4B5563', flex: 1 }}>
                        {new Date(img.created_at).toLocaleDateString('en-AU')}
                      </span>
                      <button
                        onClick={() => setPreview(img)}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#E5E7EB', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        title="Preview"
                      >Preview</button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(img.url); setNotice('URL copied!'); }}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(124,58,237,0.15)', color: '#C4B5FD', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        title="Copy URL"
                      >Copy</button>
                      {canManageOriginal ? (
                        <button
                          onClick={() => deleteImage(img.id)}
                          disabled={deleting === img.id}
                          style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        >{deleting === img.id ? '…' : '🗑'}</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>

        {/* Full-screen preview */}
        {preview && (
          <div
            onClick={() => setPreview(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          >
            <img src={preview.url} alt={preview.description || ''} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
            <button onClick={() => setPreview(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 20, borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {editingImage && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,6,23,0.9)', padding: 20, overflowY: 'auto' }}>
            <div style={{ maxWidth: 1380, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#F8FAFC' }}>Edit Image</div>
                  <div style={{ fontSize: 13, color: '#CBD5E1' }}>{editingImage.canManageOriginal ? 'Saving replaces the current image.' : 'Template images stay locked for other users. Saving creates an edited copy instead.'}</div>
                </div>
                <button onClick={() => !savingEdit && setEditingImage(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(15,23,42,0.8)', color: '#fff', cursor: 'pointer' }}>Close</button>
              </div>
              {savingEdit ? <div style={{ marginBottom: 12, color: '#DDD6FE' }}>Saving edited image…</div> : null}
              <ImageEditorCard initialSrc={editingImage.url} onSave={saveEditedImage} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
