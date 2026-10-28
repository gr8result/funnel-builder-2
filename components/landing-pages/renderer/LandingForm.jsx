// The enquiry form on a landing page. On the public page it posts to /api/landing-pages/submit; in the editor and
// preview it renders identically but does not submit.

import { useEffect, useMemo, useRef, useState } from 'react';
import { safeUrl } from '../../../lib/landing-pages/pageModel';

const HONEYPOT = 'company_website';
const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

function newKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function readAttribution(pageId) {
  if (typeof window === 'undefined') return {};
  const out = {};
  const params = new URLSearchParams(window.location.search);
  let stored = {};
  try { stored = JSON.parse(sessionStorage.getItem(`lp-attr-${pageId}`) || '{}'); } catch { stored = {}; }
  for (const k of ATTR_KEYS) { const v = params.get(k) || stored[k]; if (v) out[k] = v; }
  out.referrer = stored.referrer || document.referrer || '';
  out.landing_url = stored.landing_url || window.location.href.split('#')[0];
  try { sessionStorage.setItem(`lp-attr-${pageId}`, JSON.stringify(out)); } catch { /* storage unavailable */ }
  return out;
}

export default function LandingForm({ form, runtime = {}, privacyUrl = '', formId = 'default' }) {
  const live = runtime.mode === 'live' && runtime.pageId;
  const [values, setValues] = useState({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const keyRef = useRef(null);
  const hpRef = useRef(null);
  const fields = useMemo(() => form?.fields || [], [form]);

  useEffect(() => { if (live) readAttribution(runtime.pageId); }, [live, runtime.pageId]);
  useEffect(() => {
    if (!fields.some((field) => field.key === 'enquiry_intent')) return;
    const selectIntent = () => {
      if (window.location.hash === '#enquire-demo') {
        setValues((current) => ({ ...current, enquiry_intent: 'Demonstration enquiry' }));
        document.getElementById('enquire')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (window.location.hash === '#enquire') {
        setValues((current) => ({ ...current, enquiry_intent: 'Pre-launch registration' }));
      }
    };
    selectIntent();
    window.addEventListener('hashchange', selectIntent);
    return () => window.removeEventListener('hashchange', selectIntent);
  }, [fields]);

  if (state === 'done') {
    return (
      <div className="lp-form" role="status" aria-live="polite">
        <div className="lp-thanks">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" /></svg>
          <h3>{form.thankYou?.heading || 'Thank you'}</h3>
          <p className="lp-muted">{form.thankYou?.message}</p>
        </div>
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!live) { setMessage(runtime.mode === 'preview' ? 'This is a preview. The form sends enquiries on the published page.' : ''); return; }
    const submittedValues = { ...values };
    if (fields.some((field) => field.key === 'enquiry_intent') && !submittedValues.enquiry_intent) submittedValues.enquiry_intent = 'Pre-launch registration';
    const nextErrors = {};
    for (const f of fields) {
      const v = String(values[f.key] || '').trim();
      if (f.required && !v) nextErrors[f.key] = `${f.label} is required`;
      else if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) nextErrors[f.key] = 'Enter a valid email address';
    }
    if (form.consent?.enabled && form.consent.required && !consent) nextErrors.consent = 'Please confirm you agree to be contacted';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const first = fields.find((f) => nextErrors[f.key]);
      if (first) document.getElementById(`lpf-${formId}-${first.key}`)?.focus();
      return;
    }
    if (!keyRef.current) keyRef.current = newKey();
    setState('sending'); setMessage('');
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      try {
        const r = await fetch('/api/landing-pages/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: runtime.pageId, token: runtime.formToken, idempotencyKey: keyRef.current, fields: submittedValues, consent, [HONEYPOT]: hpRef.current?.value || '', attribution: readAttribution(runtime.pageId) }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          const redirect = form.thankYou?.mode === 'redirect' ? safeUrl(form.thankYou.redirectUrl) : '';
          if (redirect) { window.location.assign(redirect); return; }
          setState('done');
          return;
        }
        if (r.status === 422) { setErrors(j.errors || {}); setState('idle'); setMessage(j.error || 'Please check the highlighted fields.'); return; }
        if (r.status === 429 || r.status < 500) { setState('idle'); setMessage(j.error || 'Your enquiry could not be sent. Please try again.'); return; }
      } catch { /* network error: retry with the same key, so the server records it once */ }
      await new Promise((res) => setTimeout(res, 600 * attempt));
    }
    setState('idle');
    setMessage('We could not send your enquiry just now. Please try again in a moment.');
  }

  const set = (k) => (e) => { setValues((v) => ({ ...v, [k]: e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined })); };

  return (
    <form className="lp-form" onSubmit={onSubmit} noValidate aria-label={form.heading || 'Enquiry form'}>
      {form.heading ? <h3>{form.heading}</h3> : null}
      {form.intro ? <p className="lp-form-intro">{form.intro}</p> : null}
      <div className="lp-fields">
        {fields.map((f) => {
          const id = `lpf-${formId}-${f.key}`;
          const wide = f.type === 'textarea' || fields.length < 4;
          const common = { id, name: f.key, value: values[f.key] || '', onChange: set(f.key), required: !!f.required, 'aria-invalid': errors[f.key] ? 'true' : undefined, 'aria-describedby': errors[f.key] ? `${id}-err` : undefined, autoComplete: f.autocomplete || 'off', placeholder: f.placeholder || undefined };
          return (
            <div key={f.id || f.key} className={`lp-field${wide ? ' lp-wide' : ''}`} data-invalid={errors[f.key] ? 'true' : 'false'}>
              <label htmlFor={id}>{f.label}{f.required ? <span className="lp-req" aria-hidden="true">*</span> : null}</label>
              {f.type === 'textarea' ? <textarea {...common} rows={4} /> : f.type === 'select' ? (
                <select {...common}><option value="">Select…</option>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
              ) : <input {...common} type={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'} inputMode={f.type === 'tel' ? 'tel' : undefined} />}
              {errors[f.key] ? <span className="lp-err" id={`${id}-err`}>{errors[f.key]}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="lp-hp" aria-hidden="true"><label htmlFor={`lp-hp-${formId}`}>Company website</label><input id={`lp-hp-${formId}`} ref={hpRef} name={HONEYPOT} tabIndex={-1} autoComplete="off" /></div>
      {form.consent?.enabled ? (
        <label className="lp-consent">
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (errors.consent) setErrors((x) => ({ ...x, consent: undefined })); }} aria-invalid={errors.consent ? 'true' : undefined} />
          <span>{form.consent.text}{errors.consent ? <span className="lp-err" style={{ display: 'block', marginTop: 4 }}>{errors.consent}</span> : null}</span>
        </label>
      ) : null}
      <button className="lp-btn lp-btn-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : form.submitLabel || 'Send enquiry'}</button>
      {message ? <div className="lp-form-alert" role="alert">{message}</div> : null}
      <p className="lp-form-note">Your details will be sent with this enquiry.</p>
      {safeUrl(privacyUrl) ? <p className="lp-form-note"><a href={safeUrl(privacyUrl)} target="_blank" rel="noopener noreferrer">Read the privacy policy</a></p> : null}
    </form>
  );
}
