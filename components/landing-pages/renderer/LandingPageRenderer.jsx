// Renders a landing page document. Used unchanged by the editor canvas, the preview and the public /lp/[slug] page.
// In edit mode (ctx.editable) text becomes click-to-edit and sections/images become selectable.

import { createContext, useContext, useEffect, useRef } from 'react';
import { LANDING_CSS, themeVars } from './styles';
import { safeUrl, imageCaption } from '../../../lib/landing-pages/pageModel';
import LandingForm from './LandingForm';

const EditCtx = createContext({ editable: false });

const Icon = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>,
  mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>,
  quote: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.6 6C6.5 7.4 4.5 10 4.5 13.6V18h6v-6h-3c0-2 1.1-3.6 3-4.5L9.6 6zm9 0c-3.1 1.4-5.1 4-5.1 7.6V18h6v-6h-3c0-2 1.1-3.6 3-4.5L18.6 6z" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>,
  plan: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 3h16v18H4zM8 3v7h8v5h4M4 15h7v6M12 6h5M7 18h1" /></svg>,
  calculator: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8M8 10h2m4 0h2M8 14h2m4 0h2M8 18h2m4 0h2" /></svg>,
  document: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8M8 19h5" /></svg>,
  layers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 10 6-10 6L2 8zM2 12l10 6 10-6M2 16l10 6 10-6" /></svg>,
  project: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 2v6M16 2v6M3 11h18m-14 4h3m4 0h3M7 18h3" /></svg>,
};
export { Icon as LandingIcons };

// ---- editable primitives ----------------------------------------------------------------------------------------------

function T({ as: Tag = 'span', sid, path, value, className, multiline = false, placeholder = '' }) {
  const ctx = useContext(EditCtx);
  const ref = useRef(null);
  const text = value == null ? '' : String(value);
  useEffect(() => {
    if (ctx.editable && ref.current && document.activeElement !== ref.current && ref.current.innerText !== text) ref.current.innerText = text;
  }, [ctx.editable, text]);
  if (!ctx.editable) return text ? <Tag className={className}>{text}</Tag> : null;
  const commit = (e) => {
    const next = multiline ? e.currentTarget.innerText.replace(/\n{3,}/g, '\n\n') : e.currentTarget.innerText.replace(/\s*\n\s*/g, ' ');
    if (next.trim() !== text.trim()) ctx.onEditText?.(sid, path, next.trim());
  };
  return (
    <Tag
      ref={ref}
      className={`${className || ''} lp-editable`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-lp-path={`${sid}:${path}`}
      data-placeholder={placeholder || 'Click to add text'}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter' && !multiline) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { e.currentTarget.innerText = text; e.currentTarget.blur(); } }}
      onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
    />
  );
}

function Img({ sid, path, image, className, sizes, priority = false }) {
  const ctx = useContext(EditCtx);
  const src = safeUrl(image?.src);
  if (!src) {
    if (!ctx.editable) return null;
    return <button type="button" className={`lp-img-empty ${className || ''}`} onClick={(e) => { e.stopPropagation(); ctx.onImage?.(sid, path); }}>Add image</button>;
  }
  const img = <img src={src} alt={image?.alt || ''} loading={priority ? 'eager' : 'lazy'} {...(priority ? { fetchpriority: 'high' } : {})} decoding="async" sizes={sizes} className={className} style={image?.crop?.focalPoint ? { objectPosition: image.crop.focalPoint } : undefined} />;
  if (!ctx.editable) return img;
  return (
    <span className="lp-img-edit" onClick={(e) => { e.stopPropagation(); ctx.onImage?.(sid, path); }} role="button" tabIndex={0} aria-label="Replace image">
      {img}<span className="lp-img-badge">Replace image</span>
    </span>
  );
}

function Caption({ sid, path = 'image', image, as = 'p', className = 'lp-image-disclosure' }) {
  const caption = imageCaption(image);
  if (!caption) return null;
  return <T as={as} className={className} sid={sid} path={`${path}.${typeof image?.caption === 'string' ? 'caption' : 'disclosure'}`} value={caption} />;
}

function Btn({ sid, path, btn, kind = 'primary', arrow = true }) {
  const ctx = useContext(EditCtx);
  if (!btn?.label && !ctx.editable) return null;
  if (!btn?.label) return null;
  const href = safeUrl(btn.href) || '#enquire';
  const external = /^https?:/.test(href);
  return (
    <a
      className={`lp-btn lp-btn-${kind}`}
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={(e) => { if (ctx.editable) { e.preventDefault(); ctx.onButton?.(sid, path); } }}
    >
      <T sid={sid} path={`${path}.label`} value={btn.label} />
      {arrow && kind === 'primary' ? Icon.arrow : null}
    </a>
  );
}

function Head({ s, center }) {
  const p = s.props;
  return (
    <div className="lp-head">
      <T as="div" className="lp-eyebrow" sid={s.id} path="eyebrow" value={p.eyebrow} placeholder="Eyebrow" />
      <T as="h2" className="lp-h2" sid={s.id} path="heading" value={p.heading} placeholder="Heading" />
      <T as="p" className="lp-lead lp-muted" sid={s.id} path="intro" value={p.intro} multiline placeholder="Introduction" />
    </div>
  );
}

// ---- sections -------------------------------------------------------------------------------------------------------

function Hero({ s, doc, runtime }) {
  const p = s.props;
  const ctx = useContext(EditCtx);
  const hasImage = !!safeUrl(p.image?.src);
  const cinematic = p.showForm || ['cinematic-dark', 'cinematic-light'].includes(s.variant);
  const text = (
    <div className={s.variant === 'statement' || !hasImage ? 'lp-statement-in' : ''}>
      <T as="div" className="lp-eyebrow" sid={s.id} path="eyebrow" value={p.eyebrow} />
      <T as="h1" sid={s.id} path="headline" value={p.headline} placeholder="Headline" />
      <T as="p" className="lp-sub" sid={s.id} path="subheadline" value={p.subheadline} multiline />
      <div className="lp-hero-ctas">
        <Btn sid={s.id} path="primaryCta" btn={p.primaryCta} />
        <Btn sid={s.id} path="secondaryCta" btn={p.secondaryCta} kind="ghost" />
      </div>
      {(p.highlights || []).length ? (
        <ul className="lp-hl">{p.highlights.map((h, i) => <li key={i}>{Icon.check}<T sid={s.id} path={`highlights.${i}`} value={h} /></li>)}</ul>
      ) : null}
    </div>
  );
  if (cinematic) return (
    <div className={`lp-cinematic-copy${p.showForm ? ' lp-cinematic-with-form' : ''}`}>
      <div className="lp-cinematic-content">{ctx.editable && !hasImage ? <Img sid={s.id} path="image" image={p.image} className="lp-hero-image-empty" /> : null}{text}</div>
      {p.showForm ? <div className="lp-hero-form"><LandingForm form={doc.form} runtime={runtime} privacyUrl={doc.brand.privacyUrl} formId={`hero-${s.id}`} /></div> : null}
      <Caption sid={s.id} image={p.image} />
    </div>
  );
  if (s.variant !== 'statement' && hasImage) {
    return (
      <div className="lp-hero-grid">
        {text}
        <div className="lp-hero-media">
          <Img sid={s.id} path="image" image={p.image} sizes="(max-width: 1000px) 100vw, 560px" priority />
          {imageCaption(p.image) ? <Caption sid={s.id} image={p.image} /> : !p.image?.disclosure && !p.image?.provenance && hasImage && doc.brand.serviceArea ? <div className="lp-hero-card">{Icon.pin}<span>Serving {doc.brand.serviceArea}</span></div> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="lp-hero-statement">
      {text}
      {ctx.editable && !hasImage ? <Img sid={s.id} path="image" image={p.image} className="lp-hero-image-empty" /> : null}
    </div>
  );
}

function Trust({ s }) {
  return <ul className="lp-trust">{(s.props.items || []).map((it, i) => <li key={i}>{Icon.shield}<T sid={s.id} path={`items.${i}.label`} value={it.label} /></li>)}</ul>;
}

function Cards({ s, numbered = true, withImages = false }) {
  const items = s.props.items || [];
  return (
    <>
      <Head s={s} />
      <div className={`lp-grid ${items.length === 2 || items.length === 4 ? 'lp-g2' : 'lp-g3'}`} style={{ '--lp-cols': Math.max(1, Math.min(4, items.length)) }}>
        {items.map((it, i) => (
          <article className="lp-card" key={i}>
            {withImages && (safeUrl(it.image?.src) || false) ? <div className="lp-card-img"><Img sid={s.id} path={`items.${i}.image`} image={it.image} /></div> : null}
            <Caption sid={s.id} path={`items.${i}.image`} image={it.image} className="lp-card-caption" />
            {s.variant === 'showcase' ? <span className="lp-feature-icon">{Icon[it.icon] || Icon.layers}</span> : null}
            {numbered && !(withImages && safeUrl(it.image?.src)) ? <div className="lp-num">{String(i + 1).padStart(2, '0')}</div> : null}
            <T as="h3" sid={s.id} path={`items.${i}.title`} value={it.title} />
            <T as="p" sid={s.id} path={`items.${i}.body`} value={it.body} multiline />
          </article>
        ))}
      </div>
    </>
  );
}

function Benefits({ s }) {
  if (s.variant !== 'comparison') return <Cards s={s} />;
  const p = s.props;
  return <>
    <Head s={s} />
    <div className={`lp-comparison${safeUrl(p.image?.src) ? ' lp-comparison-media' : ''}`}>
      <div className="lp-compare-panel lp-compare-problems">
        <T as="h3" sid={s.id} path="problemHeading" value={p.problemHeading} />
        <ul>{(p.items || []).map((item, i) => <li key={i}><span className="lp-cross" aria-hidden="true">×</span><T sid={s.id} path={`items.${i}.problem`} value={item.problem} /></li>)}</ul>
      </div>
      <div className="lp-compare-panel lp-compare-solutions">
        <T as="h3" sid={s.id} path="solutionHeading" value={p.solutionHeading} />
        <ul>{(p.items || []).map((item, i) => <li key={i}>{Icon.check}<div><T as="strong" sid={s.id} path={`items.${i}.title`} value={item.title} /><T as="p" sid={s.id} path={`items.${i}.body`} value={item.body} /></div></li>)}</ul>
      </div>
      {safeUrl(p.image?.src) ? <figure className="lp-story-image"><Img sid={s.id} path="image" image={p.image} /><figcaption><T as="h3" sid={s.id} path="imageHeading" value={p.imageHeading} /><Caption sid={s.id} image={p.image} as="span" className="" /></figcaption></figure> : null}
    </div>
  </>;
}

function Process({ s }) {
  return (
    <>
      <Head s={s} />
      <ol className="lp-steps">
        {(s.props.steps || []).map((st, i) => (
          <li className="lp-step" key={i}>
            {s.variant === 'connected' ? <span className="lp-workflow-icon">{Icon[st.icon] || Icon.layers}</span> : null}
            <T as="h3" sid={s.id} path={`steps.${i}.title`} value={st.title} />
            <T as="p" sid={s.id} path={`steps.${i}.body`} value={st.body} multiline />
          </li>
        ))}
      </ol>
    </>
  );
}

function Gallery({ s }) {
  return (
    <>
      <Head s={s} />
      <div className="lp-gallery">
        {(s.props.images || []).map((img, i) => <figure key={i}><Img sid={s.id} path={`images.${i}`} image={img} sizes="(max-width: 680px) 50vw, 400px" /></figure>)}
      </div>
    </>
  );
}

export function videoEmbed(url) {
  const u = safeUrl(url);
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { kind: 'video', src: u };
  return null;
}

function Video({ s }) {
  const ctx = useContext(EditCtx);
  const embed = videoEmbed(s.props.url);
  return (
    <>
      <Head s={s} />
      {embed ? (
        <div className="lp-video">
          {embed.kind === 'iframe'
            ? <iframe src={embed.src} title={s.props.heading || 'Video'} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen style={ctx.editable ? { pointerEvents: 'none' } : undefined} />
            : <video src={embed.src} controls preload="metadata" />}
        </div>
      ) : ctx.editable ? <div className="lp-img-empty">Add a YouTube, Vimeo or MP4 link in the panel</div> : null}
    </>
  );
}

function Testimonials({ s }) {
  const items = s.props.items || [];
  return (
    <>
      <Head s={s} />
      <div className={`lp-grid ${items.length === 1 ? 'lp-g1' : items.length === 2 || items.length === 4 ? 'lp-g2' : 'lp-g3'}`}>
        {items.map((t, i) => (
          <figure className={`lp-card lp-quote${items.length === 1 ? ' lp-quote-feature' : ''}`} key={i} style={{ margin: 0 }}>
            <div>{Icon.quote}<T as="blockquote" sid={s.id} path={`items.${i}.quote`} value={t.quote} multiline /></div>
            <figcaption><T sid={s.id} path={`items.${i}.name`} value={t.name} /><T as="span" sid={s.id} path={`items.${i}.detail`} value={t.detail} /></figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

function About({ s }) {
  const p = s.props;
  const hasImage = !!safeUrl(p.image?.src);
  return (
    <div className={hasImage ? 'lp-about' : ''}>
      <div>
        <T as="div" className="lp-eyebrow" sid={s.id} path="eyebrow" value={p.eyebrow} />
        <T as="h2" className="lp-h2" sid={s.id} path="heading" value={p.heading} />
        <T as="p" className="lp-body lp-muted" sid={s.id} path="body" value={p.body} multiline />
      </div>
      {hasImage ? <figure className="lp-about-media"><Img sid={s.id} path="image" image={p.image} /><Caption sid={s.id} image={p.image} as="figcaption" /></figure> : null}
    </div>
  );
}

function Offer({ s }) {
  const p = s.props;
  return (
    <div className="lp-offer">
      <div>
        <T as="div" className="lp-eyebrow" sid={s.id} path="eyebrow" value={p.eyebrow} />
        <T as="h2" sid={s.id} path="heading" value={p.heading} />
        <T as="p" sid={s.id} path="body" value={p.body} multiline />
        <T as="p" className="lp-fine" sid={s.id} path="finePrint" value={p.finePrint} multiline placeholder="Terms (optional)" />
      </div>
      <Btn sid={s.id} path="cta" btn={p.cta} />
    </div>
  );
}

function Faq({ s }) {
  const ctx = useContext(EditCtx);
  return (
    <>
      <Head s={s} />
      <div className="lp-faq">
        {(s.props.items || []).map((it, i) => (
          <details key={i} open={ctx.editable || i === 0}>
            <summary onClick={(e) => { if (ctx.editable) e.preventDefault(); }}><T sid={s.id} path={`items.${i}.q`} value={it.q} /></summary>
            <T as="div" className="lp-a" sid={s.id} path={`items.${i}.a`} value={it.a} multiline />
          </details>
        ))}
      </div>
    </>
  );
}

function Enquiry({ s, doc, runtime }) {
  const p = s.props;
  const b = doc.brand;
  return (
    <div className="lp-enq">
      {doc.form.fields.some((field) => field.key === 'enquiry_intent') ? <span id="enquire-demo" style={{ position: 'absolute', top: 0 }} /> : null}
      <div>
        <T as="div" className="lp-eyebrow" sid={s.id} path="eyebrow" value={p.eyebrow} />
        <T as="h2" className="lp-h2" sid={s.id} path="heading" value={p.heading} />
        <T as="p" className="lp-lead lp-muted" sid={s.id} path="intro" value={p.intro} multiline />
        {(p.sidePoints || []).length ? <ul className="lp-side">{p.sidePoints.map((pt, i) => <li key={i}><span className="lp-check">{Icon.check}</span><T sid={s.id} path={`sidePoints.${i}`} value={pt} /></li>)}</ul> : null}
        {safeUrl(p.image?.src) ? <figure className="lp-enquiry-image"><Img sid={s.id} path="image" image={p.image} /><Caption sid={s.id} image={p.image} as="figcaption" /></figure> : null}
        {(b.phone || b.email) ? (
          <div className="lp-direct">
            {b.phone ? <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>{Icon.phone}{b.phone}</a> : null}
            {b.email ? <a href={`mailto:${b.email}`}>{Icon.mail}{b.email}</a> : null}
          </div>
        ) : null}
      </div>
      <LandingForm form={doc.form} runtime={runtime} privacyUrl={b.privacyUrl} formId={`enquiry-${s.id}`} />
    </div>
  );
}

function Contact({ s, doc }) {
  const p = s.props; const b = doc.brand;
  const cards = [];
  if (p.showPhone && b.phone) cards.push(<a key="p" className="lp-card" href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>{Icon.phone}<strong>Call</strong><span>{b.phone}</span></a>);
  if (p.showEmail && b.email) cards.push(<a key="e" className="lp-card" href={`mailto:${b.email}`}>{Icon.mail}<strong>Email</strong><span>{b.email}</span></a>);
  if (p.showAddress && (b.address || b.serviceArea)) cards.push(<div key="a" className="lp-card">{Icon.pin}<strong>{b.address ? 'Visit' : 'Service area'}</strong><span>{b.address || b.serviceArea}</span></div>);
  return (
    <>
      <div className="lp-head">
        <T as="h2" className="lp-h2" sid={s.id} path="heading" value={p.heading} />
        <T as="p" className="lp-lead lp-muted" sid={s.id} path="intro" value={p.intro} multiline />
        <T as="p" className="lp-muted" sid={s.id} path="hours" value={p.hours} placeholder="Opening hours (optional)" />
      </div>
      <div className="lp-contact" style={cards.length < 3 ? { gridTemplateColumns: `repeat(${Math.max(cards.length, 1)}, minmax(0, 1fr))` } : undefined}>{cards}</div>
    </>
  );
}

function BrandMark({ brand }) {
  const logo = safeUrl(brand.logoUrl);
  if (logo) return <img src={logo} alt={brand.name || 'Logo'} />;
  const initials = String(brand.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return <><span className="lp-mark" aria-hidden="true">{initials}</span><span>{brand.name}</span></>;
}

function Footer({ s, doc }) {
  const b = doc.brand;
  const year = new Date().getFullYear();
  return (
    <>
      <div className="lp-foot">
        <div>
          <a className="lp-brand" href="#top"><BrandMark brand={b} /></a>
          <T as="p" sid={s.id} path="tagline" value={s.props.tagline} />
        </div>
        <nav className="lp-foot-links" aria-label="Footer">
          <a href="#enquire">Enquire</a>
          {b.phone ? <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>{b.phone}</a> : null}
          {b.email ? <a href={`mailto:${b.email}`}>{b.email}</a> : null}
          {safeUrl(b.privacyUrl) ? <a href={safeUrl(b.privacyUrl)} target="_blank" rel="noopener noreferrer">Privacy policy</a> : null}
        </nav>
      </div>
      <div className="lp-legal">
        <span>© {year} {b.name}{b.licence ? ` · ${b.licence}` : ''}</span>
        <T as="span" sid={s.id} path="legal" value={s.props.legal} placeholder="Legal note (optional)" />
      </div>
    </>
  );
}

const RENDERERS = {
  hero: Hero, trust: Trust, benefits: Benefits, services: (a) => <Cards {...a} numbered withImages />, process: Process,
  gallery: Gallery, video: Video, testimonials: Testimonials, about: About, offer: Offer, faq: Faq, enquiry: Enquiry, contact: Contact, footer: Footer,
};

export default function LandingPageRenderer({ doc, runtime = {}, edit = null, animate = false }) {
  const ctx = edit ? { editable: true, ...edit } : { editable: false };
  const b = doc.brand || {};
  const firstCta = doc.sections.find((s) => s.type === 'hero')?.props?.primaryCta;
  const firstSection = doc.sections.find((s) => !s.hidden);
  const cinematicNav = firstSection?.variant === 'cinematic-dark' || firstSection?.props?.showForm;
  return (
    <EditCtx.Provider value={ctx}>
      <div className={`lp-root${cinematicNav ? ' lp-campaign-cinematic' : ''}`} style={themeVars(doc.theme)} data-animate={animate ? 'true' : 'false'} id="top">
        <style dangerouslySetInnerHTML={{ __html: LANDING_CSS + (edit ? EDIT_CSS : '') }} />
        <header className="lp-nav">
          <div className="lp-wrap lp-nav-in">
            <a className="lp-brand" href="#top" onClick={(e) => edit && e.preventDefault()}><BrandMark brand={b} /></a>
            <div className="lp-nav-actions">
              <nav className="lp-section-nav" aria-label="Page sections">{doc.sections.filter((s) => !s.hidden && ['benefits', 'services', 'process'].includes(s.type)).map((s) => <a key={s.id} href={`#${s.id}`}>{SECTION_NAV_LABELS[s.type]}</a>)}</nav>
              {b.phone ? <a className="lp-nav-phone" href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} onClick={(e) => edit && e.preventDefault()}>{Icon.phone}<span>{b.phone}</span></a> : null}
              <a className="lp-btn lp-btn-primary" href="#enquire" onClick={(e) => edit && e.preventDefault()}>{firstCta?.label || 'Enquire'}</a>
            </div>
          </div>
        </header>
        <main>
          {doc.sections.map((s) => {
            if (s.hidden && !edit) return null;
            const R = RENDERERS[s.type];
            if (!R) return null;
            const cls = [
              'lp-sec', `lp-s-${s.type}`, `lp-bg-${s.style?.background || 'default'}`, `lp-pad-${s.style?.paddingY || 'md'}`,
              s.type === 'hero' ? `lp-hero-${s.variant}${s.props?.showForm ? ' lp-hero-show-form' : ''}` : '',
              `lp-layout-${s.variant}`,
              s.style?.align === 'center' ? 'lp-align-center' : '', s.style?.mobile?.hidden ? 'lp-hide-mobile' : '', s.style?.mobile?.align === 'center' ? 'lp-m-center' : '',
              edit && edit.selectedId === s.id ? 'lp-selected' : '', s.hidden ? 'lp-is-hidden' : '',
            ].filter(Boolean).join(' ');
            const Tag = s.type === 'footer' ? 'footer' : 'section';
            return (
              <Tag
                key={s.id}
                id={s.type === 'enquiry' ? 'enquire' : s.id}
                className={cls}
                data-section-id={s.id}
                data-section-type={s.type}
                aria-label={s.type === 'footer' ? undefined : s.props.heading || s.props.headline || undefined}
                onClick={edit ? () => edit.onSelect?.(s.id) : undefined}
              >
                {s.type === 'hero' && (s.props?.showForm || ['cinematic-dark', 'cinematic-light'].includes(s.variant)) && safeUrl(s.props.image?.src) ? <div className="lp-hero-backdrop"><Img sid={s.id} path="image" image={s.props.image} priority /><div className="lp-hero-overlay" /></div> : s.type === 'hero' ? <><div className="lp-hero-lines" /><div className="lp-hero-glow" /></> : null}
                {edit && s.type === 'hero' && safeUrl(s.props.image?.src) ? <button type="button" className="lp-hero-replace" onClick={(event) => { event.stopPropagation(); edit.onImage?.(s.id, 'image'); }}>Replace hero image</button> : null}
                <div className="lp-wrap"><R s={s} doc={doc} runtime={runtime} /></div>
                {edit && s.hidden ? <div className="lp-hidden-tag">Hidden — not shown on the live page</div> : null}
              </Tag>
            );
          })}
        </main>
      </div>
    </EditCtx.Provider>
  );
}

const SECTION_NAV_LABELS = { benefits: 'Why choose us', services: 'Explore', process: 'How it works' };

const EDIT_CSS = `
.lp-root .lp-sec{cursor:default;outline:2px solid transparent;outline-offset:-2px;transition:outline-color .15s ease}
.lp-root .lp-hero-replace{position:absolute;z-index:6;top:16px;right:18px;border:0;border-radius:999px;padding:9px 14px;background:#2563eb;color:#fff;font:600 13px/1 var(--lp-font-body);box-shadow:0 8px 24px rgb(0 0 0 / .28);cursor:pointer}
.lp-root .lp-sec:hover{outline-color:rgb(59 130 246 / .35)}
.lp-root .lp-sec.lp-selected{outline-color:#3b82f6}
.lp-root .lp-is-hidden{opacity:.45}
.lp-hidden-tag{position:absolute;top:10px;right:10px;background:#111827;color:#fff;font-size:13px;padding:4px 10px;border-radius:999px}
.lp-editable{cursor:text;border-radius:4px;transition:box-shadow .15s ease}
.lp-editable:hover{box-shadow:0 0 0 2px rgb(59 130 246 / .35)}
.lp-editable:focus{outline:none;box-shadow:0 0 0 2px #3b82f6;background:rgb(59 130 246 / .04)}
.lp-editable:empty::before{content:attr(data-placeholder);opacity:.4}
.lp-img-edit{position:relative;display:block;cursor:pointer}
.lp-img-badge{position:absolute;top:14px;right:14px;background:rgb(17 24 39 / .85);color:#fff;font-size:13px;font-weight:600;padding:7px 12px;border-radius:999px;opacity:0;transition:opacity .15s ease}
.lp-img-edit:hover .lp-img-badge{opacity:1}
.lp-img-empty{display:grid;place-items:center;min-height:220px;width:100%;border:2px dashed rgb(var(--lp-ink-rgb) / .2);border-radius:var(--lp-radius);background:rgb(var(--lp-ink-rgb) / .03);color:var(--lp-muted);font:600 16px var(--lp-font-body);cursor:pointer}
`;
