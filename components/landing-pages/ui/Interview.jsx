// The AI campaign interview: one question at a time, free text or quick picks, skip anything optional, generate as
// soon as the essentials are known. Every answer is saved on the server before the next question appears.

import { useEffect, useMemo, useRef, useState } from 'react';
import s from './admin.module.css';
import { GENERATION_TIMEOUT_MS, fileToDataUrl } from './useLandingApi';
import { FIELD_LIBRARY, STYLE_PRESETS, defaultForm } from '../../../lib/landing-pages/pageModel';
import { campaignCta } from '../../../lib/landing-pages/campaignIntent';
import { OBJECTIVES } from '../../../lib/landing-pages/interview';

const BRIEF_LABELS = [
  ['businessName', 'Business'], ['objective', 'Goal'], ['offering', 'Promoting'], ['audience', 'Audience'], ['serviceArea', 'Area'],
  ['offer', 'Offer'], ['ctaLabel', 'Main button'], ['usps', 'Strengths'], ['style', 'Style'], ['testimonials', 'Testimonials'], ['credentials', 'Credentials'],
];

function show(key, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
  if (key === 'objective') return OBJECTIVES[v] || v;
  if (key === 'style') return STYLE_PRESETS[v]?.label || v;
  if (key === 'testimonials') return `${v.length} supplied`;
  if (Array.isArray(v)) return v.join(' · ');
  return String(v);
}

export default function Interview({ campaign, interview, aiAvailable, call, onUpdated, onGenerated }) {
  const step = interview.next;
  const brief = campaign.brief || {};
  const [text, setText] = useState('');
  const [obj, setObj] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [followUp, setFollowUp] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateImage, setGenerateImage] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    setText(''); setError('');
    const b = campaign.brief || {};
    if (!step) return;
    if (step.key === 'business') setObj({ businessName: b.businessName || '', phone: b.phone || '', email: b.email || '', address: b.address || '' });
    else if (step.key === 'offer') setObj({ offer: b.offer || '', ctaLabel: campaignCta(b) });
    else if (step.key === 'style') setObj({ style: b.style || 'premium', primaryColour: b.primaryColour || '#E06910', secondaryColour: b.secondaryColour || '#0B0F1A', logoUrl: b.logoUrl || '', useColours: !!b.primaryColour });
    else if (step.key === 'media') setObj({ media: b.media || [] });
    else if (step.key === 'evidence') setObj({ testimonials: '', credentials: (b.credentials || []).join('\n') });
    else if (step.key === 'formFields') setObj({ keys: (b.formFields || defaultForm(b).fields.map((field) => field.key)).filter((k) => typeof k === 'string'), custom: '' });
    else if (step.key === 'thankYou') setObj({ thankYouMessage: b.thankYouMessage || defaultForm(b).thankYou.message, thankYouRedirect: b.thankYouRedirect || '' });
    else if (step.key === 'dates') setObj({ startDate: b.startDate || '', endDate: b.endDate || '' });
    else if (step.key === 'seo') setObj({ seoTitle: b.seoTitle || '', seoDescription: b.seoDescription || '' });
    else setObj({});
  }, [step?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [interview.progress.complete, followUp]);

  const transcript = useMemo(() => (campaign.interview?.transcript || []).filter((m) => m.text), [campaign.interview]);

  function answerValue() {
    switch (step.key) {
      case 'business': case 'offer': case 'thankYou': case 'dates': case 'seo': return obj;
      case 'style': return obj.useColours ? obj : { style: obj.style, logoUrl: obj.logoUrl };
      case 'media': return obj.media;
      case 'evidence': return { testimonials: obj.testimonials, credentials: obj.credentials };
      case 'formFields': return [...obj.keys, ...String(obj.custom || '').split(',').map((x) => x.trim()).filter(Boolean)];
      default: return text;
    }
  }

  async function send(skip = false, value) {
    setBusy(true); setError(''); setFollowUp(null);
    try {
      const j = await call(`/api/landing-pages/campaigns/${campaign.id}`, { method: 'POST', body: { action: 'interview', stepKey: step.key, answer: value ?? answerValue(), skip } });
      setFollowUp(j.followUp || null);
      onUpdated(j);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function upload(files, onUrl) {
    setBusy(true); setError('');
    try {
      for (const f of Array.from(files || []).slice(0, 12)) {
        const dataUrl = await fileToDataUrl(f);
        const j = await call(`/api/landing-pages/campaigns/${campaign.id}`, { method: 'POST', body: { action: 'upload', dataUrl, fileName: f.name } });
        onUrl(j.url, f.name);
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function generate() {
    setGenerating(true); setError('');
    try {
      const j = await call(`/api/landing-pages/campaigns/${campaign.id}`, { method: 'POST', body: { action: 'generate', generateImage }, timeoutMs: GENERATION_TIMEOUT_MS });
      onGenerated(j.pageId);
    } catch (e) {
      if (e.body?.pageId) onGenerated(e.body.pageId);
      else { setError(e.message); setGenerating(false); }
    }
  }

  const ready = interview.progress.readyToGenerate;
  const pct = Math.round((interview.progress.complete / interview.progress.total) * 100);

  return (
    <div className={s.interview}>
      <div className={s.chat}>
        <div className={s.bubbleAi}>
          Let’s build the landing page for <b>{campaign.name}</b>. I’ll ask a few questions about your business and this campaign. Answer in your own words — skip anything optional, and you can generate the page as soon as the essentials are covered.
          {!aiAvailable ? '\n\n(The AI writing service is not connected, so I will use the built-in copywriter. Everything still works.)' : ''}
        </div>
        {transcript.map((m, i) => <div key={i} className={m.role === 'user' ? s.bubbleMe : s.bubbleAi}>{m.text}</div>)}
        {followUp ? <div className={s.bubbleAi}>{followUp}</div> : null}

        {step ? (
          <div className={s.composer} data-testid="interview-composer">
            <div className={s.question}>{step.question}</div>
            {step.help ? <div className={s.help}>{step.help}</div> : null}
            <StepInput step={step} text={text} setText={setText} obj={obj} setObj={setObj} onUpload={upload} busy={busy} onPick={(v) => send(false, v)} />
            {error ? <div className={s.alert} role="alert" style={{ margin: 0 }}>{error}</div> : null}
            <div className={s.spread}>
              <span className={s.help}>{step.essential ? 'Needed to build the page' : 'Optional'}</span>
              <div className={s.row}>
                {!step.essential ? <button type="button" className={`${s.btn} ${s.ghost}`} disabled={busy} onClick={() => send(true)}>Skip</button> : null}
                {step.key !== 'objective' ? <button type="button" className={`${s.btn} ${s.primary}`} disabled={busy || (!step.fields && !step.kind && !['style', 'media', 'formFields'].includes(step.key) && !text.trim())} onClick={() => send(false)} data-testid="interview-send">{busy ? 'Saving…' : 'Continue'}</button> : null}
              </div>
            </div>
          </div>
        ) : (
          <div className={s.bubbleAi}>That’s everything I need. Review the plan on the right, then generate your page.</div>
        )}
        <div ref={endRef} />
      </div>

      <aside className={s.card} style={{ position: 'sticky', top: 16 }}>
        <div className={s.spread}><h2 className={s.cardTitle}>Campaign brief</h2><span className={s.help}>{pct}%</span></div>
        <div className={s.progress} style={{ marginTop: 10 }}><div className={s.progressBar} style={{ width: `${pct}%` }} /></div>
        <ul className={s.briefList}>
          {BRIEF_LABELS.map(([k, label]) => { const v = show(k, brief[k]); return v ? <li key={k}><strong>{label}</strong><span>{v}</span></li> : null; })}
        </ul>
        {ready ? (
          <>
            <label className={s.help}><input type="checkbox" checked={generateImage} disabled={generating} onChange={(event) => setGenerateImage(event.target.checked)} /> Automatically plan and source campaign imagery: Media Library photos first, then AI-generated photos only up to the account's configured image budget. Any shortage is reported in the editable draft.</label>
            <h3 className={s.cardTitle} style={{ marginTop: 22, fontSize: 16 }}>Recommended page structure</h3>
            <ol className={s.structure}>
              {interview.structure.map((x) => <li key={x.type}><span style={{ color: '#f9b44c' }}>●</span><span><b>{x.type === 'faq' ? 'FAQ' : x.type[0].toUpperCase() + x.type.slice(1)}</b> — {x.reason}</span></li>)}
            </ol>
          </>
        ) : (
          <p className={s.help} style={{ marginTop: 18 }}>Still needed: {interview.progress.missingEssentials.map((m) => ({ businessName: 'business name', contact: 'phone or email', serviceArea: 'service area' }[m] || m)).join(', ')}.</p>
        )}
        <button type="button" className={`${s.btn} ${s.primary}`} style={{ width: '100%', marginTop: 20, minHeight: 52 }} disabled={!ready || generating} onClick={generate} data-testid="generate-page">
          {generating ? 'Designing your page…' : step ? 'Generate page now' : 'Generate my landing page'}
        </button>
        {ready && step ? <p className={s.help} style={{ marginTop: 10 }}>You can generate now — unanswered optional questions use sensible defaults.</p> : null}
      </aside>
    </div>
  );
}

function StepInput({ step, text, setText, obj, setObj, onUpload, busy, onPick }) {
  const set = (k) => (e) => setObj((o) => ({ ...o, [k]: e.target.value }));
  switch (step.key) {
    case 'business':
      return (
        <div className={s.two}>
          <div><label className={s.label} htmlFor="b-name">Business name</label><input id="b-name" className={s.input} value={obj.businessName || ''} onChange={set('businessName')} /></div>
          <div><label className={s.label} htmlFor="b-phone">Phone</label><input id="b-phone" className={s.input} value={obj.phone || ''} onChange={set('phone')} inputMode="tel" /></div>
          <div><label className={s.label} htmlFor="b-email">Enquiry email</label><input id="b-email" className={s.input} value={obj.email || ''} onChange={set('email')} type="email" /></div>
          <div><label className={s.label} htmlFor="b-addr">Business address (optional)</label><input id="b-addr" className={s.input} value={obj.address || ''} onChange={set('address')} /></div>
        </div>
      );
    case 'objective':
      return (
        <>
          <div className={s.chips}>{step.choices.map((c) => <button type="button" key={c.value} className={s.chip} disabled={busy} onClick={() => onPick(c.value)}>{c.label}</button>)}</div>
          <div className={s.row}><input className={s.input} style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Or describe the goal in your own words" /><button type="button" className={`${s.btn} ${s.primary}`} disabled={busy || !text.trim()} onClick={() => onPick(text)}>Continue</button></div>
        </>
      );
    case 'offer':
      return (
        <div className={s.two}>
          <div><label className={s.label} htmlFor="o-offer">Offer (leave blank if none)</label><input id="o-offer" className={s.input} value={obj.offer || ''} onChange={set('offer')} placeholder="e.g. Free initial consultation" /></div>
          <div><label className={s.label} htmlFor="o-cta">Main button text</label><input id="o-cta" className={s.input} value={obj.ctaLabel || ''} onChange={set('ctaLabel')} maxLength={40} /></div>
        </div>
      );
    case 'style':
      return (
        <>
          <div className={s.chips}>{step.choices.map((c) => <button type="button" key={c.value} className={`${s.chip} ${obj.style === c.value ? s.chipOn : ''}`} onClick={() => setObj((o) => ({ ...o, style: c.value }))}>{c.label}</button>)}</div>
          <label className={s.row} style={{ fontSize: 15 }}><input type="checkbox" checked={!!obj.useColours} onChange={(e) => setObj((o) => ({ ...o, useColours: e.target.checked }))} /> Use my brand colours</label>
          {obj.useColours ? (
            <div className={s.row}>
              <label className={s.row} style={{ fontSize: 15 }}>Accent <input type="color" value={obj.primaryColour} onChange={set('primaryColour')} /></label>
              <label className={s.row} style={{ fontSize: 15 }}>Dark <input type="color" value={obj.secondaryColour} onChange={set('secondaryColour')} /></label>
            </div>
          ) : null}
          <div className={s.row}>
            {obj.logoUrl ? <img src={obj.logoUrl} alt="Logo" style={{ height: 40, background: '#fff', borderRadius: 8, padding: 4 }} /> : null}
            <label className={`${s.btn} ${s.ghost} ${s.small}`}>{obj.logoUrl ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onUpload(e.target.files, (url) => setObj((o) => ({ ...o, logoUrl: url })))} /></label>
          </div>
        </>
      );
    case 'media':
      return (
        <>
          {obj.media?.length ? <div className={s.mediaGrid}>{obj.media.map((m, i) => <img key={i} src={m.src} alt={m.alt || ''} />)}</div> : null}
          <div className={s.row}>
            <label className={`${s.btn} ${s.ghost}`}>{busy ? 'Uploading…' : 'Upload photos'}<input type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files, (url, name) => setObj((o) => ({ ...o, media: [...(o.media || []), { src: url, alt: String(name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), kind: 'image' }] })))} /></label>
            <input className={s.input} style={{ flex: 1, minWidth: 220 }} placeholder="Or paste a YouTube, Vimeo or image link and press Enter" onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { e.preventDefault(); const src = e.currentTarget.value.trim(); setObj((o) => ({ ...o, media: [...(o.media || []), { src, alt: '', kind: /youtu|vimeo|\.mp4/i.test(src) ? 'video' : 'image' }] })); e.currentTarget.value = ''; } }} />
          </div>
        </>
      );
    case 'evidence':
      return (
        <div className={s.two}>
          <div><label className={s.label} htmlFor="e-t">Testimonials — one per line: “Quote” — Name, Suburb</label><textarea id="e-t" className={s.textarea} value={obj.testimonials || ''} onChange={set('testimonials')} /></div>
          <div><label className={s.label} htmlFor="e-c">Licence, memberships, awards — one per line</label><textarea id="e-c" className={s.textarea} value={obj.credentials || ''} onChange={set('credentials')} /></div>
        </div>
      );
    case 'formFields':
      return (
        <>
          <div className={s.chips}>
            {Object.entries(FIELD_LIBRARY).map(([k, f]) => {
              const on = obj.keys?.includes(k);
              return <button type="button" key={k} className={`${s.chip} ${on ? s.chipOn : ''}`} disabled={k === 'email'} onClick={() => setObj((o) => ({ ...o, keys: on ? o.keys.filter((x) => x !== k) : [...(o.keys || []), k] }))}>{on ? '✓ ' : ''}{f.label}</button>;
            })}
          </div>
          <input className={s.input} value={obj.custom || ''} onChange={set('custom')} placeholder="Custom questions, separated by commas (optional)" />
        </>
      );
    case 'thankYou':
      return (
        <>
          <textarea className={s.textarea} value={obj.thankYouMessage || ''} onChange={set('thankYouMessage')} />
          <input className={s.input} value={obj.thankYouRedirect || ''} onChange={set('thankYouRedirect')} placeholder="Or send people to a web address (optional), e.g. https://yoursite.com.au/thanks" />
        </>
      );
    case 'dates':
      return (
        <div className={s.two}>
          <div><label className={s.label} htmlFor="d-s">Starts</label><input id="d-s" type="date" className={s.input} value={obj.startDate || ''} onChange={set('startDate')} /></div>
          <div><label className={s.label} htmlFor="d-e">Ends</label><input id="d-e" type="date" className={s.input} value={obj.endDate || ''} onChange={set('endDate')} /></div>
        </div>
      );
    case 'seo':
      return (
        <>
          <input className={s.input} value={obj.seoTitle || ''} onChange={set('seoTitle')} maxLength={70} placeholder="Page title for Google (optional)" />
          <textarea className={s.textarea} value={obj.seoDescription || ''} onChange={set('seoDescription')} maxLength={170} placeholder="Short description for Google and social shares (optional)" />
        </>
      );
    default:
      return <textarea className={s.textarea} value={text} onChange={(e) => setText(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit?.(); }} data-testid="interview-text" aria-label={step.question} />;
  }
}
