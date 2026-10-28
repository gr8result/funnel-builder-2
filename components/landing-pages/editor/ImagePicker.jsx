// Choose an image: upload from the computer, reuse campaign media, or paste a link.

import { useState } from 'react';
import s from './editor.module.css';
import { fileToDataUrl } from '../ui/useLandingApi';

export default function ImagePicker({ media = [], onUpload, onGenerate, onChoose, onClose }) {
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const src = await onUpload(dataUrl, file.name);
      onChoose({ src, alt: alt || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
    } catch (e) { setError(e.message); setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError('');
    try { onChoose(await onGenerate()); } catch (e) { setError(e.message); setBusy(false); }
  }
  return (
    <div className={s.modalBack} role="dialog" aria-modal="true" aria-label="Choose an image" onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Choose an image</h2>
        <p className={s.hint}>Use relevant photos of your products, services, team or business. JPG, PNG or WebP up to 8 MB.</p>
        <div className={s.field} style={{ marginTop: 14 }}><label>Description (alt text)<input className={s.input} style={{ marginTop: 6 }} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe what the image shows" /></label></div>
        <button type="button" className={`${s.btn} ${s.primary}`} style={{ width: '100%', minHeight: 48 }} disabled={busy} onClick={generate} data-testid="image-generate">{busy ? 'Generating…' : 'Generate image with AI'}</button>
        <p className={s.hint}>Creates and stores a new campaign image. Image generation may incur provider costs.</p>
        <label className={`${s.btn} ${s.primary}`} style={{ width: '100%', minHeight: 48 }}>
          {busy ? 'Uploading…' : 'Upload from your computer'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden disabled={busy} onChange={(e) => upload(e.target.files?.[0])} data-testid="image-upload" />
        </label>
        {media.length ? (<><p className={s.h} style={{ marginTop: 18 }}>Campaign and Media Library images</p><div className={s.pick}>{media.map((m, i) => <button type="button" key={m.id || m.src || i} onClick={() => onChoose({ ...m, alt: alt || m.alt || '' })}><img src={m.src} alt={m.alt || ''} /></button>)}</div></>) : null}
        <p className={s.h} style={{ marginTop: 18 }}>Or use a link</p>
        <div className={s.inline}>
          <input className={s.input} style={{ flex: 1 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" data-testid="image-url" />
          <button type="button" className={s.btn} disabled={!/^https:\/\//.test(url)} onClick={() => onChoose({ src: url, alt })}>Use link</button>
        </div>
        {error ? <div className={s.issue} style={{ marginTop: 12 }}>{error}</div> : null}
        <div className={s.inline} style={{ justifyContent: 'flex-end', marginTop: 18 }}><button type="button" className={s.btn} onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}
