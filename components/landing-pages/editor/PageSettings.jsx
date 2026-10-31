// Page-wide settings: look (style, fonts, colours, corners), business details, SEO/sharing and the enquiry form.

import s from './editor.module.css';
import { FIELD_LIBRARY, FONT_PAIRS, STYLE_PRESETS, isHex } from '../../../lib/landing-pages/pageModel';

export default function PageSettings({ doc, apply, onPickImage }) {
  const t = doc.theme; const b = doc.brand; const seo = doc.seo; const form = doc.form;
  const op = (o) => apply([o]);
  const setPreset = (key) => {
    const p = STYLE_PRESETS[key];
    apply([{ op: 'setTheme', path: 'preset', value: key }, { op: 'setTheme', path: 'fonts', value: p.fonts }, { op: 'setTheme', path: 'radius', value: p.radius }, ...Object.entries(p.palette).map(([k, v]) => ({ op: 'setTheme', path: `palette.${k}`, value: v }))]);
  };
  const fieldKeys = form.fields.map((f) => f.key);
  return (
    <>
      <div className={s.section}>
        <p className={s.h}>Look & feel</p>
        <div className={s.field}><span className={s.lbl}>Style</span>
          <select className={s.select} value={t.preset || 'premium'} onChange={(e) => setPreset(e.target.value)}>{Object.entries(STYLE_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
        </div>
        <div className={s.field}><span className={s.lbl}>Fonts</span>
          <select className={s.select} value={t.fonts} onChange={(e) => op({ op: 'setTheme', path: 'fonts', value: e.target.value })}>{Object.entries(FONT_PAIRS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
        </div>
        <div className={s.field}><span className={s.lbl}>Colours</span>
          <div className={s.inline}>
            {[['accent', 'Brand'], ['ink', 'Dark'], ['surface', 'Page'], ['surfaceAlt', 'Tint'], ['text', 'Text']].map(([k, l]) => (
              <label key={k} className={s.hint} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                <input type="color" className={s.swatch} value={isHex(t.palette[k]) ? t.palette[k] : '#000000'} onChange={(e) => op({ op: 'setTheme', path: `palette.${k}`, value: e.target.value })} />{l}
              </label>
            ))}
          </div>
        </div>
        <div className={s.field}><span className={s.lbl}>Corners</span>
          <div className={s.seg}>{[['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']].map(([v, l]) => <button type="button" key={v} aria-pressed={t.radius === v} onClick={() => op({ op: 'setTheme', path: 'radius', value: v })}>{l}</button>)}</div>
        </div>
      </div>

      <div className={s.section}>
        <p className={s.h}>Business details</p>
        {[['name', 'Business name'], ['phone', 'Phone'], ['email', 'Email (also receives enquiry alerts)'], ['address', 'Address'], ['serviceArea', 'Service area'], ['licence', 'Professional licence (optional)'], ['privacyUrl', 'Privacy policy link']].map(([k, l]) => (
          <div className={s.field} key={k}><label>{l}<input className={s.input} style={{ marginTop: 6 }} value={b[k] || ''} onChange={(e) => op({ op: 'setBrand', path: k, value: e.target.value })} /></label></div>
        ))}
        <div className={s.field}><span className={s.lbl}>Logo</span>
          <div className={s.inline}>
            {b.logoUrl ? <img src={b.logoUrl} alt="" style={{ height: 36, background: '#fff', padding: 4, borderRadius: 8 }} /> : null}
            <button type="button" className={s.btn} onClick={() => onPickImage('__brand', 'logoUrl')}>{b.logoUrl ? 'Replace logo' : 'Add logo'}</button>
            {b.logoUrl ? <button type="button" className={s.btn} onClick={() => op({ op: 'setBrand', path: 'logoUrl', value: '' })}>Remove</button> : null}
          </div>
        </div>
      </div>

      <div className={s.section}>
        <p className={s.h}>Google & social sharing</p>
        <div className={s.field}><label>Page title ({(seo.title || '').length}/60)<input className={s.input} style={{ marginTop: 6 }} value={seo.title} maxLength={70} onChange={(e) => op({ op: 'setSeo', path: 'title', value: e.target.value })} /></label></div>
        <div className={s.field}><label>Description ({(seo.description || '').length}/155)<textarea className={s.textarea} style={{ marginTop: 6 }} value={seo.description} maxLength={170} onChange={(e) => op({ op: 'setSeo', path: 'description', value: e.target.value })} /></label></div>
        <div className={s.field}><span className={s.lbl}>Sharing image (1200 × 630 works best)</span>
          {seo.ogImage ? <img className={s.thumb} src={seo.ogImage} alt="" /> : null}
          <button type="button" className={s.btn} onClick={() => onPickImage('__seo', 'ogImage')}>{seo.ogImage ? 'Replace' : 'Choose image'}</button>
        </div>
        <label className={s.inline}><input type="checkbox" checked={!!seo.noindex} onChange={(e) => op({ op: 'setSeo', path: 'noindex', value: e.target.checked })} /> Hide from Google (for ad-only campaigns)</label>
      </div>

      <div className={s.section}>
        <p className={s.h}>Enquiry form</p>
        <div className={s.field}><label>Form heading<input className={s.input} style={{ marginTop: 6 }} value={form.heading || ''} onChange={(e) => op({ op: 'setForm', path: 'heading', value: e.target.value })} /></label></div>
        <div className={s.field}><label>Introduction<textarea className={s.textarea} style={{ marginTop: 6 }} value={form.intro || ''} onChange={(e) => op({ op: 'setForm', path: 'intro', value: e.target.value })} /></label></div>
        <div className={s.field}><label>Button text<input className={s.input} style={{ marginTop: 6 }} value={form.submitLabel || ''} onChange={(e) => op({ op: 'setForm', path: 'submitLabel', value: e.target.value })} /></label></div>
        <span className={s.lbl}>Fields</span>
        {form.fields.map((f, i) => (
          <div key={f.id || f.key} className={s.sub}>
            <div className={s.inline} style={{ justifyContent: 'space-between' }}>
              <input className={s.input} style={{ flex: 1 }} value={f.label} onChange={(e) => op({ op: 'setFormFields', fields: form.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label="Field label" />
              <span>
                <button type="button" className={s.mini} disabled={i === 0} aria-label="Move up" onClick={() => { const n = [...form.fields]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; op({ op: 'setFormFields', fields: n }); }}>↑</button>
                <button type="button" className={s.mini} disabled={i === form.fields.length - 1} aria-label="Move down" onClick={() => { const n = [...form.fields]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; op({ op: 'setFormFields', fields: n }); }}>↓</button>
                <button type="button" className={s.mini} disabled={f.key === 'email'} aria-label="Remove field" title={f.key === 'email' ? 'Email is needed to create the CRM contact' : 'Remove'} onClick={() => op({ op: 'setFormFields', fields: form.fields.filter((_, j) => j !== i) })}>✕</button>
              </span>
            </div>
            <div className={s.inline} style={{ marginTop: 8 }}>
              <span className={s.hint}>{f.type === 'select' ? 'Choice' : f.type === 'textarea' ? 'Paragraph' : f.type}</span>
              <label className={s.inline} style={{ marginLeft: 'auto' }}><input type="checkbox" checked={!!f.required} disabled={f.key === 'email'} onChange={(e) => op({ op: 'setFormFields', fields: form.fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) })} /> Required</label>
            </div>
            {f.type === 'select' ? <textarea className={s.textarea} style={{ marginTop: 8, minHeight: 64 }} value={(f.options || []).join('\n')} onChange={(e) => op({ op: 'setFormFields', fields: form.fields.map((x, j) => (j === i ? { ...x, options: e.target.value.split('\n') } : x)) })} aria-label="Options, one per line" /> : null}
          </div>
        ))}
        <div className={s.inline}>
          <select className={s.select} style={{ flex: 1 }} value="" onChange={(e) => { const v = e.target.value; if (!v) return; op({ op: 'setFormFields', fields: [...form.fields, v === '__text' ? { key: `custom_${Date.now().toString(36)}`, label: 'Your question', type: 'text' } : v === '__choice' ? { key: `custom_${Date.now().toString(36)}`, label: 'Your question', type: 'select', options: ['Option 1', 'Option 2'] } : { key: v }] }); }}>
            <option value="">+ Add a field…</option>
            {Object.entries(FIELD_LIBRARY).filter(([k]) => !fieldKeys.includes(k)).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            <option value="__text">Custom question (text)</option>
            <option value="__choice">Custom question (choice)</option>
          </select>
        </div>
        <label className={s.inline} style={{ marginTop: 14 }}><input type="checkbox" checked={!!form.consent?.enabled} onChange={(e) => op({ op: 'setForm', path: 'consent.enabled', value: e.target.checked })} /> Ask for consent to be contacted</label>
        {form.consent?.enabled ? <textarea className={s.textarea} style={{ marginTop: 8 }} value={form.consent.text || ''} onChange={(e) => op({ op: 'setForm', path: 'consent.text', value: e.target.value })} /> : null}
        <div className={s.field} style={{ marginTop: 14 }}><span className={s.lbl}>After someone enquires</span>
          <div className={s.seg}>{[['message', 'Show a message'], ['redirect', 'Go to a web page']].map(([v, l]) => <button type="button" key={v} aria-pressed={form.thankYou?.mode === v} onClick={() => op({ op: 'setForm', path: 'thankYou.mode', value: v })}>{l}</button>)}</div>
        </div>
        {form.thankYou?.mode === 'redirect'
          ? <div className={s.field}><label>Web address<input className={s.input} style={{ marginTop: 6 }} value={form.thankYou.redirectUrl || ''} placeholder="https://" onChange={(e) => op({ op: 'setForm', path: 'thankYou.redirectUrl', value: e.target.value })} /></label></div>
          : <>
              <div className={s.field}><label>Thank-you heading<input className={s.input} style={{ marginTop: 6 }} value={form.thankYou?.heading || ''} onChange={(e) => op({ op: 'setForm', path: 'thankYou.heading', value: e.target.value })} /></label></div>
              <div className={s.field}><label>Thank-you message<textarea className={s.textarea} style={{ marginTop: 6 }} value={form.thankYou?.message || ''} onChange={(e) => op({ op: 'setForm', path: 'thankYou.message', value: e.target.value })} /></label></div>
            </>}
        <p className={s.hint}>Every enquiry is saved, added to Leads and CRM with this campaign as its source, and emailed to the business email above.</p>
      </div>
    </>
  );
}
