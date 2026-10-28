// The landing page visual editor.
//
// One document in state; every change (typing on the canvas, the side panel, drag/reorder, AI) goes through applyOps,
// lands on an undo stack, and is autosaved a moment later. Saves carry the revision they were based on, so two tabs can
// never silently overwrite each other. Publishing saves first, then publishes exactly what was saved.

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import s from './editor.module.css';
import LandingPageRenderer from '../renderer/LandingPageRenderer';
import { fontHref } from '../renderer/styles';
import Inspector from './Inspector';
import PageSettings from './PageSettings';
import AssistantPanel from './AssistantPanel';
import ImagePicker from './ImagePicker';
import { GENERATION_TIMEOUT_MS, useLandingApi } from '../ui/useLandingApi';
import { SECTION_TYPES, applyOps, sectionTitle, defaultSectionProps } from '../../../lib/landing-pages/pageModel';
import { checkForPublish } from '../../../lib/landing-pages/publishCheck';
import { builtInCopy } from '../../../lib/landing-pages/generator';
import { inspectDesignQuality } from '../../../lib/landing-pages/imagery';

// Each preview renders at the device's real width (so the layout is the real one) and is scaled down to fit if needed.
const DEVICES = { desktop: 1280, tablet: 834, mobile: 390 };
const AUTOSAVE_MS = 1800;

export default function LandingPageEditor({ pageId }) {
  const router = useRouter();
  const { call, ready } = useLandingApi();
  const [meta, setMeta] = useState(null);
  const [doc, setDoc] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [revision, setRevision] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState({ status: 'idle', at: null, error: '' });
  const [conflict, setConflict] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [leftTab, setLeftTab] = useState('sections');
  const [rightTab, setRightTab] = useState('edit');
  const [device, setDevice] = useState('desktop');
  const [picker, setPicker] = useState(null);
  const [libraryMedia, setLibraryMedia] = useState([]);
  const [proposal, setProposal] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [versions, setVersions] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setWrapWidth(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [doc !== null && meta !== null]); // eslint-disable-line react-hooks/exhaustive-deps -- attach once the canvas exists
  const docRef = useRef(null); const revRef = useRef(null); const dirtyRef = useRef(false); const savingRef = useRef(null);
  docRef.current = doc; revRef.current = revision; dirtyRef.current = dirty;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const j = await call(`/api/landing-pages/pages/${pageId}`);
      setMeta({ page: j.page, campaign: j.campaign, publicUrl: j.publicUrl });
      setDoc(j.page.document); setRevision(j.page.revision); setDirty(false); setConflict(false);
      historyRef.current = { past: [], future: [] }; setHistory(historyRef.current);
      setSaveState({ status: 'saved', at: j.page.updated_at, error: '' });
    } catch (e) { setLoadError(e.message); }
    finally { setLoading(false); }
  }, [call, pageId]);
  useEffect(() => { if (ready && pageId) load(); }, [ready, pageId, load]);
  useEffect(() => {
    if (!picker || libraryMedia.length) return;
    let active = true;
    call('/api/assets/list-library?includeEmailTemplateRefs=0')
      .then((result) => {
        if (!active) return;
        setLibraryMedia((result.images || []).map((image) => ({
          ...image,
          src: image.src || image.url,
          alt: image.alt || image.description || image.name || '',
        })).filter((image) => image.src));
      })
      .catch((error) => { console.warn('[landing-pages] Media Library could not be loaded:', error.message); });
    return () => { active = false; };
  }, [picker, libraryMedia.length, call]);

  // ---- changes & history ------------------------------------------------------------------------------------------
  const historyRef = useRef({ past: [], future: [] });
  const setHist = (h) => { historyRef.current = h; setHistory(h); };
  const commit = useCallback((next) => {
    const h = historyRef.current;
    setHist({ past: [...h.past.slice(-99), docRef.current], future: [] });
    setDoc(next); setDirty(true);
  }, []);
  const apply = useCallback((ops) => {
    try { commit(applyOps(docRef.current, ops).document); } catch (e) { setSaveState((x) => ({ ...x, status: 'error', error: e.message })); }
  }, [commit]);
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.past.length) return;
    setHist({ past: h.past.slice(0, -1), future: [docRef.current, ...h.future] });
    setDoc(h.past[h.past.length - 1]); setDirty(true);
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.future.length) return;
    const [next, ...rest] = h.future;
    setHist({ past: [...h.past, docRef.current], future: rest });
    setDoc(next); setDirty(true);
  }, []);

  // ---- saving -----------------------------------------------------------------------------------------------------
  const save = useCallback(async (kind = 'save', label = null) => {
    if (savingRef.current) await savingRef.current.catch(() => {});
    if (!docRef.current || conflict) return false;
    if (kind === 'autosave' && !dirtyRef.current) return true;
    const snapshot = docRef.current;
    setSaveState((x) => ({ ...x, status: 'saving', error: '' }));
    const p = (async () => {
      try {
        const j = await call(`/api/landing-pages/pages/${pageId}`, { method: 'PUT', body: { document: snapshot, baseRevision: revRef.current, kind, label } });
        setRevision(j.revision); revRef.current = j.revision;
        if (docRef.current === snapshot) setDirty(false);
        setSaveState({ status: 'saved', at: j.savedAt, error: '' });
        return true;
      } catch (e) {
        if (e.status === 409) setConflict(true);
        setSaveState({ status: 'error', at: null, error: e.status === 409 ? 'Changed elsewhere' : e.message });
        return false;
      }
    })();
    savingRef.current = p;
    const ok = await p; savingRef.current = null;
    return ok;
  }, [call, pageId, conflict]);

  useEffect(() => {
    if (!dirty || conflict) return undefined;
    const t = setTimeout(() => { save('autosave'); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [doc, dirty, conflict, save]);

  useEffect(() => {
    const warn = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const inField = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save('save', 'Saved'); return; }
      if (inField) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, undo, redo]);

  // ---- canvas callbacks -------------------------------------------------------------------------------------------
  const edit = useMemo(() => ({
    selectedId,
    onSelect: (id) => { setSelectedId(id); setRightTab((t) => (t === 'page' ? 'edit' : t)); },
    onEditText: (sid, path, value) => apply([{ op: 'setSectionProp', sectionId: sid, path, value }]),
    onImage: (sid, path) => { setSelectedId(sid); setPicker({ sid, path }); },
    onButton: (sid) => { setSelectedId(sid); setRightTab('edit'); },
  }), [selectedId, apply]);

  const selected = doc?.sections.find((x) => x.id === selectedId) || null;

  async function uploadImage(dataUrl, fileName) {
    const j = await call(`/api/landing-pages/pages/${pageId}`, { method: 'POST', body: { action: 'upload', dataUrl, fileName } });
    return j.url;
  }
  async function generateImage() {
    const section = docRef.current.sections.find((item) => item.id === picker?.sid);
    const subject = section ? [section.props.heading, section.props.headline, section.props.eyebrow, meta.campaign.brief?.offering].filter(Boolean).join(' · ') : meta.campaign.brief?.offering;
    const j = await call(`/api/landing-pages/campaigns/${meta.campaign.id}`, { method: 'POST', body: { action: 'generate-image', purpose: section?.type || 'campaign', subject }, timeoutMs: GENERATION_TIMEOUT_MS });
    return { src: j.url, alt: j.alt, ...(j.provenance ? { provenance: j.provenance } : {}), ...(j.disclosure ? { disclosure: j.disclosure } : {}) };
  }
  function chooseImage(img) {
    const { sid, path } = picker;
    setPicker(null);
    if (sid === '__brand') return apply([{ op: 'setBrand', path, value: img.src }]);
    if (sid === '__seo') return apply([{ op: 'setSeo', path, value: img.src }]);
    const section = docRef.current.sections.find((item) => item.id === sid);
    const ops = [{ op: 'setSectionProp', sectionId: sid, path, value: { src: img.src, alt: img.alt || '', ...(img.disclosure ? { disclosure: img.disclosure } : {}), ...(img.provenance ? { provenance: img.provenance } : {}), ...(typeof img.caption === 'string' ? { caption: img.caption } : {}) } }];
    if (section?.type === 'hero' && path === 'image') {
      if (section.variant === 'statement') ops.push({ op: 'setSectionVariant', sectionId: sid, value: 'split' });
      const previousImage = section.props.image?.src || '';
      const shareImage = docRef.current.seo?.ogImage || '';
      if (!shareImage || shareImage === previousImage) ops.push({ op: 'setSeo', path: 'ogImage', value: img.src });
    }
    return apply(ops);
  }

  function addSection(type) {
    const brief = meta?.campaign?.brief || {};
    const copy = builtInCopy(brief)[type];
    const props = { ...defaultSectionProps(type), ...(copy && typeof copy === 'object' ? copy : {}) };
    if (type === 'offer' && copy) props.cta = { label: copy.cta || 'Enquire now', href: '#enquire' };
    if (type === 'testimonials') props.items = (brief.testimonials || []).map((t) => ({ quote: t.quote, name: t.name, detail: t.detail || '' }));
    if (type === 'trust') props.items = (brief.credentials || []).map((c) => ({ label: c }));
    if (type === 'gallery') props.images = (brief.media || []).filter((m) => m.kind !== 'video').slice(0, 6).map((m) => ({ src: m.src, alt: m.alt || '' }));
    if (type === 'video') props.url = (brief.media || []).find((m) => m.kind === 'video')?.src || '';
    const afterId = selectedId && !['footer'].includes(selected?.type) ? selectedId : undefined;
    const before = new Set(docRef.current.sections.map((x) => x.id));
    try {
      const next = applyOps(docRef.current, [{ op: 'addSection', afterId, section: { type, props } }]).document;
      commit(next);
      setSelectedId(next.sections.find((x) => !before.has(x.id))?.id || null);
    } catch (e) { setSaveState((x) => ({ ...x, status: 'error', error: e.message })); }
  }

  // ---- AI assistant -----------------------------------------------------------------------------------------------
  async function ask(instruction) {
    setAiBusy(true);
    try {
      const j = await call(`/api/landing-pages/pages/${pageId}`, { method: 'POST', body: { action: 'assistant', instruction, selectedSectionId: selectedId, document: docRef.current }, timeoutMs: GENERATION_TIMEOUT_MS });
      if (!j.proposal) {
        setProposal({ summary: j.message || 'No safe changes could be completed.', changes: [], outcomes: [], issues: j.issues || [], warnings: [], document: docRef.current, noChanges: true });
        return j.message || 'No safe changes could be completed.';
      }
      setProposal(j.proposal);
      return j.proposal.summary;
    } catch (e) { return e.message; } finally { setAiBusy(false); }
  }
  async function keepBatchChanges() {
    const p = proposal; setProposal(null);
    if (!p || p.noChanges) return;
    commit(p.document);
    docRef.current = p.document; dirtyRef.current = true;
    await save('ai', `AI batch: ${p.summary || 'page changes'}`.slice(0, 190));
  }

  // ---- versions ---------------------------------------------------------------------------------------------------
  async function openVersions() {
    setRightTab('versions');
    try { setVersions((await call(`/api/landing-pages/pages/${pageId}?versions=1`)).versions); } catch (e) { setVersions([]); }
  }
  async function viewVersion(v) {
    const j = await call(`/api/landing-pages/pages/${pageId}?version=${v.id}`);
    setViewing({ ...v, document: j.version.document });
  }
  async function restore(v) {
    if (dirtyRef.current && !(await save('save', 'Saved before restore'))) return;
    const j = await call(`/api/landing-pages/pages/${pageId}`, { method: 'POST', body: { action: 'restore', versionId: v.id, baseRevision: revRef.current } });
    setHist({ past: [...historyRef.current.past, docRef.current], future: [] });
    setDoc(j.document); setRevision(j.revision); setDirty(false); setViewing(null);
    setSaveState({ status: 'saved', at: new Date().toISOString(), error: '' });
    openVersions();
  }

  // ---- publish ----------------------------------------------------------------------------------------------------
  const check = useMemo(() => (doc ? checkForPublish(doc) : null), [doc]);
  const designIssues = useMemo(() => doc?.generation?.imageryRequested ? inspectDesignQuality(doc).issues.filter((issue) => issue.severity === 'error') : [], [doc]);
  async function publish() {
    setPublishing(true); setPublishResult(null);
    if (dirtyRef.current && !(await save('save', 'Saved before publishing'))) { setPublishing(false); return; }
    try {
      const j = await call(`/api/landing-pages/pages/${pageId}`, { method: 'POST', body: { action: 'publish' } });
      setMeta((m) => ({ ...m, page: { ...m.page, ...j.page }, publicUrl: j.publicUrl }));
      setPublishResult({ ok: true, url: j.publicUrl, version: j.version });
    } catch (e) {
      setPublishResult({ ok: false, error: e.message, check: e.body?.check });
    }
    setPublishing(false);
  }
  async function unpublish() {
    if (!window.confirm('Take this page offline? The link will stop working and the form will stop accepting enquiries.')) return;
    const j = await call(`/api/landing-pages/pages/${pageId}`, { method: 'POST', body: { action: 'unpublish' } });
    setMeta((m) => ({ ...m, page: { ...m.page, ...j.page } }));
  }

  if (loadError) return <div className={s.shell} style={{ display: 'grid', placeItems: 'center' }}><div style={{ textAlign: 'center' }}><p role="alert">{loadError}</p><button type="button" className={s.btn} onClick={load} disabled={loading}>{loading ? 'Retrying…' : 'Retry'}</button>{' '}<Link className={s.btn} href="/modules/landing-pages">Back to campaigns</Link></div></div>;
  if (!doc || !meta) return <div className={s.shell} style={{ display: 'grid', placeItems: 'center' }}><div style={{ textAlign: 'center' }}><p role="status">Loading editor…</p>{loading ? null : <button type="button" className={s.btn} onClick={load}>Retry</button>}</div></div>;

  const shownDoc = viewing?.document || proposal?.document || doc;
  const readOnly = !!(viewing || proposal);
  const live = meta.page.status === 'published';
  const saveLabel = conflict ? 'Changed in another tab' : saveState.status === 'saving' ? 'Saving…' : saveState.status === 'error' ? `Not saved — ${saveState.error}` : dirty ? 'Unsaved changes' : saveState.at ? `Saved ${new Date(saveState.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Saved';

  return (
    <div className={s.shell}>
      <Head>
        <title>{`Edit — ${meta.campaign.name}`}</title>
        <link rel="stylesheet" href={fontHref(shownDoc.theme)} />
      </Head>
      <header className={s.bar}>
        <Link className={`${s.btn} ${s.icon}`} href={`/modules/landing-pages/${meta.campaign.id}`} aria-label="Back to campaign" title="Back to campaign">←</Link>
        <div className={s.barTitle}><strong>{meta.campaign.name}</strong><span>{live ? 'Live' : meta.page.status === 'unpublished' ? 'Offline' : 'Draft'} · /lp/{meta.page.slug}</span></div>
        <span className={`${s.saveState} ${saveState.status === 'error' || conflict ? s.saveError : ''}`} data-testid="save-state" aria-live="polite">{saveLabel}</span>
        <button type="button" className={`${s.btn} ${s.icon}`} onClick={undo} disabled={!history.past.length || readOnly} aria-label="Undo" title="Undo (Ctrl+Z)">↶</button>
        <button type="button" className={`${s.btn} ${s.icon}`} onClick={redo} disabled={!history.future.length || readOnly} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">↷</button>
        <div className={`${s.seg} ${s.hideNarrow}`} role="group" aria-label="Preview size">
          {Object.keys(DEVICES).map((d) => <button type="button" key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
        </div>
        <button type="button" className={`${s.btn} ${s.hideNarrow}`} onClick={openVersions}>History</button>
        <a className={`${s.btn} ${s.hideNarrow}`} href={`/modules/landing-pages/preview/${pageId}`} target="_blank" rel="noreferrer" onClick={async (e) => { if (dirtyRef.current) { e.preventDefault(); await save('save', 'Saved before preview'); window.open(`/modules/landing-pages/preview/${pageId}`, '_blank', 'noopener'); } }}>Preview</a>
        <button type="button" className={s.btn} onClick={() => save('save', 'Saved')} disabled={readOnly || saveState.status === 'saving' || conflict} data-testid="save">Save</button>
        <button type="button" className={`${s.btn} ${s.primary}`} onClick={() => { setPublishOpen(true); setPublishResult(null); }} disabled={readOnly} data-testid="publish-open">{live ? 'Republish' : 'Publish'}</button>
      </header>

      <div className={s.body}>
        <aside className={s.left} aria-label="Page structure">
          <div className={s.panelTabs} role="tablist">
            <button role="tab" aria-selected={leftTab === 'sections'} onClick={() => setLeftTab('sections')}>Sections</button>
            <button role="tab" aria-selected={leftTab === 'page'} onClick={() => setLeftTab('page')}>Page settings</button>
          </div>
          {leftTab === 'sections' ? (
            <>
              <ul className={s.list}>
                {doc.sections.map((sec, i) => (
                  <li key={sec.id} className={`${s.item} ${selectedId === sec.id ? s.itemOn : ''}`} onClick={() => { setSelectedId(sec.id); setRightTab('edit'); document.querySelector(`[data-section-id="${sec.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', sec.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && id !== sec.id) apply([{ op: 'moveSection', sectionId: id, toIndex: i }]); }}>
                    <span className={s.itemLabel} style={{ opacity: sec.hidden ? 0.5 : 1 }}><b>{sectionTitle(sec)}</b><small>{SECTION_TYPES[sec.type].label}{sec.hidden ? ' · hidden' : ''}{sec.style?.mobile?.hidden ? ' · desktop only' : ''}</small></span>
                    <button type="button" className={s.mini} aria-label="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); apply([{ op: 'moveSection', sectionId: sec.id, toIndex: i - 1 }]); }}>↑</button>
                    <button type="button" className={s.mini} aria-label="Move down" disabled={i === doc.sections.length - 1} onClick={(e) => { e.stopPropagation(); apply([{ op: 'moveSection', sectionId: sec.id, toIndex: i + 1 }]); }}>↓</button>
                    <SectionMenu sec={sec} apply={apply} onRemoved={() => setSelectedId(null)} />
                  </li>
                ))}
              </ul>
              <div className={s.section}>
                <p className={s.h}>Add a section</p>
                <select className={s.select} value="" onChange={(e) => { if (e.target.value) addSection(e.target.value); }} aria-label="Add a section" data-testid="add-section">
                  <option value="">Choose a section…</option>
                  {Object.entries(SECTION_TYPES).filter(([t, d]) => !(d.single && doc.sections.some((x) => x.type === t))).map(([t, d]) => <option key={t} value={t}>{d.label}</option>)}
                </select>
                <p className={s.hint} style={{ marginTop: 8 }}>Added after the selected section. Drag sections to reorder.</p>
              </div>
            </>
          ) : <PageSettings doc={doc} apply={apply} onPickImage={(sid, path) => setPicker({ sid, path })} />}
        </aside>

        <main ref={wrapRef} className={s.canvasWrap} onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
          <div className={s.canvasCol}>
            {conflict ? <div className={`${s.banner} ${s.bannerWarn}`}><span>This page was changed in another tab or by someone else. Reload to get the latest version (your unsaved edits here will be lost).</span><button type="button" className={s.btn} onClick={load}>Reload</button></div> : null}
            {proposal ? <div className={s.banner}><span>Inspecting the AI working draft — your saved page is unchanged</span><span className={s.inline}>{!proposal.noChanges ? <button type="button" className={`${s.btn} ${s.primary}`} onClick={keepBatchChanges}>Keep Changes</button> : null}<button type="button" className={s.btn} onClick={() => setProposal(null)}>Undo All Changes</button></span></div> : null}
            {viewing ? <div className={s.banner}><span>Viewing version {viewing.version_no} ({viewing.label || viewing.kind}) — {new Date(viewing.created_at).toLocaleString()}</span><span className={s.inline}><button type="button" className={`${s.btn} ${s.primary}`} onClick={() => restore(viewing)}>Restore this version</button><button type="button" className={s.btn} onClick={() => setViewing(null)}>Close</button></span></div> : null}
          <div className={s.canvas} style={{ width: DEVICES[device], flex: 'none', zoom: wrapWidth ? Math.min(1, wrapWidth / DEVICES[device]) : 1 }} data-testid="canvas">
            <LandingPageRenderer key={readOnly ? 'ro' : 'rw'} doc={shownDoc} runtime={{ mode: 'preview' }} edit={readOnly ? null : edit} />
          </div>
          </div>
        </main>

        <aside className={s.right} aria-label="Edit panel">
          <div className={s.panelTabs} role="tablist">
            <button role="tab" aria-selected={rightTab === 'edit'} onClick={() => setRightTab('edit')}>Edit</button>
            <button role="tab" aria-selected={rightTab === 'ai'} onClick={() => setRightTab('ai')} data-testid="tab-ai">AI assistant</button>
            <button role="tab" aria-selected={rightTab === 'versions'} onClick={openVersions}>History</button>
          </div>
          {rightTab === 'edit' ? (
            <Inspector
              doc={doc}
              section={selected}
              onProp={(path, value) => apply([{ op: 'setSectionProp', sectionId: selected.id, path, value }])}
              onStyle={(path, value) => apply([{ op: 'setSectionStyle', sectionId: selected.id, path, value }])}
              onVariant={(value) => apply([{ op: 'setSectionVariant', sectionId: selected.id, value }])}
              onPickImage={(sid, path) => setPicker({ sid, path })}
            />
          ) : null}
          {rightTab === 'ai' ? <AssistantPanel ask={ask} proposal={proposal} busy={aiBusy} onKeep={keepBatchChanges} onUndoAll={() => setProposal(null)} selectedLabel={selected ? sectionTitle(selected) : ''} /> : null}
          {rightTab === 'versions' ? (
            <div className={s.section}>
              <p className={s.h}>Version history</p>
              <p className={s.hint} style={{ marginTop: -6, marginBottom: 12 }}>Every save, AI change and publish is kept. Preview any version, then restore it as your draft.</p>
              {versions === null ? <p className={s.hint}>Loading…</p> : versions.map((v) => (
                <div key={v.id} className={`${s.item}`} style={{ cursor: 'default' }}>
                  <span className={s.itemLabel}><b>{v.kind === 'publish' ? '● Published' : v.label || v.kind}</b><small>v{v.version_no} · {new Date(v.created_at).toLocaleString()}</small></span>
                  <button type="button" className={s.btn} onClick={() => viewVersion(v)}>View</button>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      {picker ? <ImagePicker media={[...(meta.campaign.brief?.media || []).filter((m) => m.kind !== 'video'), ...libraryMedia]} onUpload={uploadImage} onGenerate={generateImage} onChoose={chooseImage} onClose={() => setPicker(null)} /> : null}

      {publishOpen ? (
        <div className={s.modalBack} role="dialog" aria-modal="true" aria-label="Publish" onClick={() => !publishing && setPublishOpen(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            {publishResult?.ok ? (
              <>
                <h2>Your page is live</h2>
                <p className={s.hint}>Version {publishResult.version.version_no} is now live. Share this address or use the tracked links on the campaign’s Promote tab.</p>
                <div className={s.sub} style={{ marginTop: 14, wordBreak: 'break-all' }}><a href={publishResult.url} target="_blank" rel="noreferrer" style={{ color: '#f9b44c', fontWeight: 650 }} data-testid="public-url">{publishResult.url}</a></div>
                <div className={s.inline} style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className={s.btn} onClick={() => navigator.clipboard?.writeText(publishResult.url)}>Copy link</button>
                  <Link className={s.btn} href={`/modules/landing-pages/${meta.campaign.id}`}>Campaign & promotion</Link>
                  <button type="button" className={`${s.btn} ${s.primary}`} onClick={() => setPublishOpen(false)}>Done</button>
                </div>
              </>
            ) : (
              <>
                <h2>{live ? 'Republish changes' : 'Publish this page'}</h2>
                <p className={s.hint}>We check the page before it goes live: no placeholder text, every button links somewhere, every image loads and the enquiry form works.</p>
                <div style={{ marginTop: 14 }}>
                  {(publishResult?.check || check).errors.map((x, i) => <div key={`e${i}`} className={s.issue} onClick={() => { if (x.sectionId) { setSelectedId(x.sectionId); setRightTab('edit'); setPublishOpen(false); document.querySelector(`[data-section-id="${x.sectionId}"]`)?.scrollIntoView({ behavior: 'smooth' }); } }}>{x.message}</div>)}
                  {(publishResult?.check || check).warnings.map((x, i) => <div key={`w${i}`} className={`${s.issue} ${s.warn}`}>{x.message}</div>)}
                  {!(publishResult?.check || check).errors.length ? <div className={`${s.issue} ${s.ok}`}>Ready to publish{(publishResult?.check || check).warnings.length ? ' — the notes above are optional improvements' : ''}.</div> : null}
                  {publishResult && !publishResult.ok && !publishResult.check ? <div className={s.issue}>{publishResult.error}</div> : null}
                </div>
                <div className={s.inline} style={{ justifyContent: 'space-between', marginTop: 18 }}>
                  {live ? <button type="button" className={s.btn} onClick={unpublish}>Take offline</button> : <span />}
                  <span className={s.inline}>
                    <button type="button" className={s.btn} onClick={() => setPublishOpen(false)}>Cancel</button>
                    <button type="button" className={`${s.btn} ${s.primary}`} disabled={publishing || !!check.errors.length} onClick={publish} data-testid="publish-confirm">{publishing ? 'Publishing…' : live ? 'Republish' : 'Publish now'}</button>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      {router.query.generated === '1' && !history.past.length && !dirty ? <GeneratedToast issues={designIssues} onClose={() => router.replace(`/modules/landing-pages/editor/${pageId}`, undefined, { shallow: true })} /> : null}
    </div>
  );
}

function SectionMenu({ sec, apply, onRemoved }) {
  const def = SECTION_TYPES[sec.type];
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      {!def.required ? <button type="button" className={s.mini} title={sec.hidden ? 'Show' : 'Hide'} aria-label={sec.hidden ? 'Show section' : 'Hide section'} onClick={() => apply([{ op: 'toggleSection', sectionId: sec.id, hidden: !sec.hidden }])}>{sec.hidden ? '◌' : '◉'}</button> : null}
      {!def.single ? <button type="button" className={s.mini} title="Duplicate" aria-label="Duplicate section" onClick={() => apply([{ op: 'duplicateSection', sectionId: sec.id }])}>⧉</button> : null}
      {!def.required ? <button type="button" className={s.mini} title="Delete" aria-label="Delete section" onClick={() => { if (window.confirm(`Delete “${sectionTitle(sec)}”? You can undo this.`)) { apply([{ op: 'removeSection', sectionId: sec.id }]); onRemoved(); } }}>✕</button> : null}
    </span>
  );
}

function GeneratedToast({ issues, onClose }) {
  return (
    <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 90, background: '#111a2b', border: '1px solid rgba(242,138,28,.5)', color: '#fff', padding: '14px 18px', borderRadius: 14, display: 'flex', gap: 14, alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,.5)', maxWidth: 'calc(100vw - 32px)', fontSize: 15 }}>
      <span role={issues.length ? 'alert' : 'status'}>{issues.length ? `Your editable draft is saved, but is not visually complete. ${issues.map((issue) => issue.message).join(' ')}` : 'Your draft is saved. Review the page before publishing. Click any text to change it, or ask the AI assistant for bigger changes.'}</span>
      <button type="button" className={s.btn} onClick={onClose}>Got it</button>
    </div>
  );
}
