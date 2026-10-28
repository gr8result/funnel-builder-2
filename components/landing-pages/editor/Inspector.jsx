// Right-hand panel: edit the selected section's content, buttons, images, layout and mobile behaviour.

import s from './editor.module.css';
import { SECTION_FIELDS, VARIANTS } from './sectionFields';
import { SECTION_TYPES, getAt } from '../../../lib/landing-pages/pageModel';

const LINK_PRESETS = [['#enquire', 'Enquiry form'], ['#enquire-demo', 'Demonstration enquiry'], ['tel:', 'Phone call'], ['mailto:', 'Email'], ['https://', 'Web address']];

function TextField({ label, value, onChange, multiline }) {
  const Tag = multiline ? 'textarea' : 'input';
  return <div className={s.field}><label>{label}<Tag className={multiline ? s.textarea : s.input} value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ marginTop: 6 }} /></label></div>;
}

function ButtonField({ label, value = {}, onChange, doc }) {
  const href = value.href || '';
  const anchors = doc.sections.filter((x) => !x.hidden && x.type !== 'enquiry').map((x) => [`#${x.id}`, `Section: ${x.props.heading || x.props.headline || SECTION_TYPES[x.type].label}`]);
  return (
    <div className={s.sub}>
      <div className={s.lbl} style={{ marginBottom: 8 }}>{label}</div>
      <div className={s.field}><label>Button text<input className={s.input} value={value.label || ''} onChange={(e) => onChange({ ...value, label: e.target.value })} style={{ marginTop: 6 }} placeholder="Leave empty to hide" /></label></div>
      <div className={s.field}>
        <label>Goes to
          <select className={s.select} style={{ marginTop: 6 }} value={[...LINK_PRESETS, ...anchors].find(([v]) => v === href || (v.length > 2 && !v.startsWith('#') && href.startsWith(v)))?.[0] || (href.startsWith('#') ? href : 'https://')} onChange={(e) => onChange({ ...value, href: e.target.value === 'tel:' && doc.brand.phone ? `tel:${doc.brand.phone.replace(/[^\d+]/g, '')}` : e.target.value === 'mailto:' && doc.brand.email ? `mailto:${doc.brand.email}` : e.target.value })}>
            {LINK_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {anchors.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      {!href.startsWith('#') ? <div className={s.field}><label>Link<input className={s.input} value={href} onChange={(e) => onChange({ ...value, href: e.target.value })} style={{ marginTop: 6 }} /></label></div> : null}
    </div>
  );
}

function ImageField({ label, value = {}, onPick, onChange }) {
  return (
    <div className={s.sub}>
      <div className={s.lbl} style={{ marginBottom: 8 }}>{label}</div>
      {value.src ? <img className={s.thumb} src={value.src} alt="" /> : <div className={s.thumb} style={{ display: 'grid', placeItems: 'center' }}><span className={s.hint}>No image</span></div>}
      <div className={s.inline} style={{ marginTop: 8 }}>
        <button type="button" className={`${s.btn} ${s.primary}`} onClick={onPick}>{value.src ? 'Replace image' : 'Add image'}</button>
        {value.src ? <button type="button" className={s.btn} onClick={() => onChange({ src: '', alt: '' })}>Remove</button> : null}
      </div>
      {value.src ? <div className={s.field} style={{ marginTop: 10, marginBottom: 0 }}><label>Description for screen readers and Google<input className={s.input} value={value.alt || ''} onChange={(e) => onChange({ ...value, alt: e.target.value })} style={{ marginTop: 6 }} /></label></div> : null}
    </div>
  );
}

export default function Inspector({ doc, section, onProp, onStyle, onVariant, onPickImage }) {
  if (!section) return <div className={s.section}><p className={s.hint}>Click any section on the page to edit it. Click text on the page to type straight into it.</p></div>;
  const fields = SECTION_FIELDS[section.type] || [];
  const style = section.style || {};
  return (
    <>
      <div className={s.section}>
        <p className={s.h}>{SECTION_TYPES[section.type].label}</p>
        {VARIANTS[section.type] ? (
          <div className={s.field}><span className={s.lbl}>Layout</span><div className={s.seg}>{VARIANTS[section.type].map(([v, l]) => <button type="button" key={v} aria-pressed={section.variant === v} onClick={() => onVariant(v)}>{l}</button>)}</div></div>
        ) : null}
        {fields.map((f) => {
          const value = getAt(section.props, f.path);
          if (f.kind === 'text' || f.kind === 'url') return <TextField key={f.path} label={f.label} value={value} onChange={(v) => onProp(f.path, v)} />;
          if (f.kind === 'textarea') return <TextField key={f.path} label={f.label} value={value} multiline onChange={(v) => onProp(f.path, v)} />;
          if (f.kind === 'button') return <ButtonField key={f.path} label={f.label} value={value} doc={doc} onChange={(v) => onProp(f.path, v)} />;
          if (f.kind === 'image') return <ImageField key={f.path} label={f.label} value={value} onPick={() => onPickImage(section.id, f.path)} onChange={(v) => onProp(f.path, v)} />;
          if (f.kind === 'toggle') return <label key={f.path} className={s.inline} style={{ marginBottom: 10 }}><input type="checkbox" checked={!!value} onChange={(e) => onProp(f.path, e.target.checked)} /> {f.label}</label>;
          if (f.kind === 'strings') {
            const list = Array.isArray(value) ? value : [];
            return (
              <div key={f.path} className={s.field}>
                <span className={s.lbl}>{f.label}</span>
                {list.map((v, i) => (
                  <div key={i} className={s.inline}>
                    <input className={s.input} style={{ flex: 1 }} value={v} onChange={(e) => onProp(`${f.path}.${i}`, e.target.value)} />
                    <button type="button" className={s.mini} aria-label="Remove" onClick={() => onProp(f.path, list.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                {list.length < (f.max || 6) ? <button type="button" className={s.btn} onClick={() => onProp(f.path, [...list, ''])}>+ Add</button> : null}
              </div>
            );
          }
          if (f.kind === 'list') {
            const list = Array.isArray(value) ? value : [];
            return (
              <div key={f.path} className={s.field}>
                <span className={s.lbl}>{f.label}</span>
                {list.map((item, i) => (
                  <div key={i} className={s.sub}>
                    <div className={s.inline} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className={s.hint}>#{i + 1}</span>
                      <span>
                        <button type="button" className={s.mini} aria-label="Move up" disabled={i === 0} onClick={() => { const n = [...list]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onProp(f.path, n); }}>↑</button>
                        <button type="button" className={s.mini} aria-label="Move down" disabled={i === list.length - 1} onClick={() => { const n = [...list]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onProp(f.path, n); }}>↓</button>
                        <button type="button" className={s.mini} aria-label="Remove" onClick={() => onProp(f.path, list.filter((_, j) => j !== i))}>✕</button>
                      </span>
                    </div>
                    {f.item.map((sub) => {
                      const p = sub.key ? `${f.path}.${i}.${sub.key}` : `${f.path}.${i}`;
                      const v = sub.key ? getAt(item, sub.key) : item;
                      if (sub.kind === 'image') return <ImageField key={p} label={sub.label} value={v} onPick={() => onPickImage(section.id, p)} onChange={(nv) => onProp(p, nv)} />;
                      return <TextField key={p} label={sub.label} value={v} multiline={sub.kind === 'textarea'} onChange={(nv) => onProp(p, nv)} />;
                    })}
                  </div>
                ))}
                {list.length < 12 ? <button type="button" className={s.btn} onClick={() => onProp(f.path, [...list, structuredClone(f.blank)])}>+ Add</button> : null}
              </div>
            );
          }
          return null;
        })}
      </div>
      <div className={s.section}>
        <p className={s.h}>Style & spacing</p>
        <div className={s.field}><span className={s.lbl}>Background</span><div className={s.seg}>{[['default', 'Light'], ['alt', 'Tint'], ['dark', 'Dark'], ['accent', 'Brand']].map(([v, l]) => <button type="button" key={v} aria-pressed={(style.background || 'default') === v} onClick={() => onStyle('background', v)}>{l}</button>)}</div></div>
        <div className={s.field}><span className={s.lbl}>Spacing</span><div className={s.seg}>{[['sm', 'Compact'], ['md', 'Standard'], ['lg', 'Generous']].map(([v, l]) => <button type="button" key={v} aria-pressed={(style.paddingY || 'md') === v} onClick={() => onStyle('paddingY', v)}>{l}</button>)}</div></div>
        <div className={s.field}><span className={s.lbl}>Alignment</span><div className={s.seg}>{[['left', 'Left'], ['center', 'Centred']].map(([v, l]) => <button type="button" key={v} aria-pressed={(style.align || 'left') === v} onClick={() => onStyle('align', v)}>{l}</button>)}</div></div>
      </div>
      <div className={s.section}>
        <p className={s.h}>On mobile</p>
        <div className={s.field}><span className={s.lbl}>Alignment</span><div className={s.seg}>{[['left', 'Left'], ['center', 'Centred']].map(([v, l]) => <button type="button" key={v} aria-pressed={(style.mobile?.align || 'left') === v} onClick={() => onStyle('mobile.align', v)}>{l}</button>)}</div></div>
        {!SECTION_TYPES[section.type].required ? <label className={s.inline}><input type="checkbox" checked={!!style.mobile?.hidden} onChange={(e) => onStyle('mobile.hidden', e.target.checked)} /> Hide this section on phones</label> : null}
      </div>
    </>
  );
}
