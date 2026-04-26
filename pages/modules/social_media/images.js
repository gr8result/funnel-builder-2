import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

export default function ImageLibrary() {
  const router = useRouter();
  const [images, setImages]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [notice, setNotice]     = useState('');
  const [deleting, setDeleting] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]   = useState(null); // full-screen preview
  const fileRef = useRef();

  useEffect(() => { loadImages(); }, []);

  async function loadImages() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) { setNotice('Sign in to view your image library.'); setLoading(false); return; }
      const res  = await fetch('/api/social/list-images', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load images');
      setImages(json.images || []);
    } catch (err) { setNotice(err.message); }
    finally { setLoading(false); }
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
      await loadImages();
    } catch (err) { setNotice(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
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
              <div style={{ fontSize: 18, color: '#A78BFA', marginTop: 2 }}>All your saved social media images</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.2)', color: '#C4B5FD', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {uploading ? 'Uploading…' : '⬆ Upload Image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadFile(e.target.files[0])} />
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
            <button onClick={loadImages} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>↻ Refresh</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>Loading images…</div>
          ) : images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🖼️</div>
              <div style={{ fontSize: 16, marginBottom: 16 }}>No images saved yet.</div>
              <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 20 }}>Images are automatically saved here when you generate posts with images on the Create page.</div>
              <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#6D28D9)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>⬆ Upload an Image</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {images.map(img => (
                <div key={img.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={img.url}
                    alt={img.description || 'Social image'}
                    onClick={() => setPreview(img)}
                    style={{ width: '100%', height: 200, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
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
                        onClick={() => { navigator.clipboard.writeText(img.url); setNotice('URL copied!'); }}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(124,58,237,0.15)', color: '#C4B5FD', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                        title="Copy URL"
                      >Copy</button>
                      <button
                        onClick={() => deleteImage(img.id)}
                        disabled={deleting === img.id}
                        style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                      >{deleting === img.id ? '…' : '🗑'}</button>
                    </div>
                  </div>
                </div>
              ))}
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
      </div>
    </>
  );
}
