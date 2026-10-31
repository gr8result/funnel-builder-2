// Styles for rendered landing pages. Scoped to .lp-root and driven by CSS variables from the page theme.
// Layout responds to the page's own width (container queries), so the editor's mobile preview is the real mobile layout.

import { FONT_PAIRS } from '../../../lib/landing-pages/pageModel';

export function fontHref(theme) {
  const pair = FONT_PAIRS[theme?.fonts] || FONT_PAIRS.jakarta;
  const families = [...new Set([pair.heading, pair.body])].map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

function hexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0).join(' ');
}

export function themeVars(theme) {
  const p = theme?.palette || {};
  const pair = FONT_PAIRS[theme?.fonts] || FONT_PAIRS.jakarta;
  const radius = { sharp: '6px', soft: '18px', round: '28px' }[theme?.radius] || '18px';
  return {
    '--lp-ink': p.ink, '--lp-ink-rgb': hexToRgb(p.ink), '--lp-accent': p.accent, '--lp-accent-rgb': hexToRgb(p.accent),
    '--lp-surface': p.surface, '--lp-surface-alt': p.surfaceAlt, '--lp-text': p.text, '--lp-muted': p.muted,
    '--lp-font-heading': `"${pair.heading}", ui-sans-serif, system-ui, sans-serif`, '--lp-font-body': `"${pair.body}", ui-sans-serif, system-ui, sans-serif`,
    '--lp-radius': radius, '--lp-radius-sm': `calc(${radius} * 0.6)`,
  };
}

export const LANDING_CSS = `
.lp-root{container-type:inline-size;container-name:lp;font-family:var(--lp-font-body);color:var(--lp-text);background:var(--lp-surface);-webkit-font-smoothing:antialiased;line-height:1.6;font-size:17px;letter-spacing:-0.005em;overflow-x:clip}
.lp-root *,.lp-root *::before,.lp-root *::after{box-sizing:border-box}
.lp-root{color-scheme:light}
.lp-root span,.lp-root div,.lp-root a,.lp-root li,.lp-root label,.lp-root p,.lp-root td,.lp-root th{font-size:inherit}
.lp-root h1,.lp-root h2,.lp-root h3{font-family:var(--lp-font-heading);color:inherit;margin:0;letter-spacing:-0.025em;line-height:1.08;font-weight:700;text-wrap:balance}
.lp-root p{margin:0;text-wrap:pretty}
.lp-root img{max-width:100%;display:block}
.lp-root a{color:inherit}
.lp-wrap{width:100%;max-width:1200px;margin:0 auto;padding:0 32px}
.lp-sec{position:relative;scroll-margin-top:84px}
.lp-pad-sm{padding:48px 0}.lp-pad-md{padding:96px 0}.lp-pad-lg{padding:128px 0}
.lp-bg-default{background:var(--lp-surface)}
.lp-bg-alt{background:var(--lp-surface-alt)}
.lp-bg-dark{background:var(--lp-ink);color:#fff}
.lp-bg-dark .lp-muted,.lp-bg-accent .lp-muted{color:rgb(255 255 255 / .74)}
.lp-bg-accent{background:var(--lp-accent);color:#fff}
.lp-muted{color:var(--lp-muted)}
.lp-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--lp-accent);margin-bottom:18px}
.lp-eyebrow::before{content:"";width:22px;height:2px;border-radius:2px;background:currentColor}
.lp-bg-dark .lp-eyebrow{color:rgb(var(--lp-accent-rgb) / 1);filter:brightness(1.35)}
.lp-bg-accent .lp-eyebrow{color:#fff}
.lp-h2{font-size:clamp(30px,4.2cqi,46px)}
.lp-lead{font-size:19px;max-width:640px;margin-top:16px}
.lp-head{max-width:720px;margin-bottom:56px}
.lp-align-center .lp-head,.lp-align-center .lp-lead{margin-left:auto;margin-right:auto;text-align:center}
.lp-align-center .lp-eyebrow{justify-content:center}
.lp-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 26px;border-radius:calc(var(--lp-radius-sm) + 2px);font-weight:600;font-size:16px;text-decoration:none;border:1px solid transparent;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,background .2s ease;font-family:var(--lp-font-body)}
.lp-btn:focus-visible{outline:3px solid rgb(var(--lp-accent-rgb) / .45);outline-offset:3px}
.lp-btn-primary{background:var(--lp-accent);color:#fff;box-shadow:0 10px 30px -12px rgb(var(--lp-accent-rgb) / .7)}
.lp-root .lp-btn-primary{color:#fff}
.lp-root .lp-bg-accent .lp-btn-primary{color:var(--lp-ink)}
.lp-root .lp-eyebrow{font-size:12px}
.lp-btn-primary:hover{transform:translateY(-1px);box-shadow:0 16px 36px -14px rgb(var(--lp-accent-rgb) / .8)}
.lp-btn-ghost{background:transparent;border-color:rgb(var(--lp-ink-rgb) / .18);color:var(--lp-ink)}
.lp-bg-dark .lp-btn-ghost{border-color:rgb(255 255 255 / .3);color:#fff}
.lp-bg-accent .lp-btn-primary{background:#fff;color:var(--lp-ink);box-shadow:0 12px 30px -14px rgb(0 0 0 / .45)}
.lp-btn svg{width:18px;height:18px}
/* nav */
.lp-nav{position:sticky;top:0;z-index:40;background:rgb(255 255 255 / .82);backdrop-filter:saturate(1.6) blur(14px);-webkit-backdrop-filter:saturate(1.6) blur(14px);border-bottom:1px solid rgb(var(--lp-ink-rgb) / .07)}
.lp-nav-in{display:flex;align-items:center;justify-content:space-between;gap:16px;height:72px}
.lp-brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-family:var(--lp-font-heading);font-weight:700;font-size:19px;color:var(--lp-ink);letter-spacing:-0.02em}
.lp-brand img{height:40px;width:auto;max-width:180px;object-fit:contain}
.lp-mark{width:38px;height:38px;border-radius:11px;background:var(--lp-ink);color:#fff;display:grid;place-items:center;font-size:16px;font-weight:700}
.lp-nav-actions{display:flex;align-items:center;gap:14px}
.lp-nav-phone{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:16px;text-decoration:none;color:var(--lp-ink)}
.lp-nav-phone svg{width:18px;height:18px;color:var(--lp-accent)}
.lp-nav .lp-btn{min-height:44px;padding:0 20px;font-size:15px}
/* hero */
.lp-s-hero{overflow:hidden}
.lp-hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:64px;align-items:center}
.lp-s-hero h1{font-size:clamp(40px,5.6cqi,68px);line-height:1.02}
.lp-s-hero .lp-sub{font-size:20px;margin-top:24px;max-width:580px;color:var(--lp-muted)}
.lp-bg-dark.lp-s-hero .lp-sub{color:rgb(255 255 255 / .78)}
.lp-hero-ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:36px}
.lp-hl{display:flex;flex-wrap:wrap;gap:10px 22px;margin:34px 0 0;padding:0;list-style:none}
.lp-hl li{display:flex;align-items:center;gap:9px;font-weight:500;font-size:16px}
.lp-hl svg,.lp-check{width:20px;height:20px;flex:none;color:var(--lp-accent)}
.lp-hero-media{position:relative}
.lp-hero-media img{width:100%;aspect-ratio:4/4.4;object-fit:cover;border-radius:calc(var(--lp-radius) * 1.4);box-shadow:0 40px 80px -40px rgb(var(--lp-ink-rgb) / .55)}
.lp-hero-card{position:absolute;left:-28px;bottom:32px;background:#fff;color:var(--lp-ink);border-radius:var(--lp-radius);padding:16px 20px;box-shadow:0 24px 50px -24px rgb(var(--lp-ink-rgb) / .45);display:flex;gap:12px;align-items:center;max-width:290px;font-size:15px;font-weight:600;line-height:1.35}
.lp-hero-card svg{width:22px;height:22px;color:var(--lp-accent);flex:none}
.lp-hero-statement{text-align:left}
.lp-hero-statement .lp-statement-in{max-width:900px}
.lp-hero-statement>.lp-hero-image-empty{margin-top:32px;max-width:600px}
.lp-hero-statement h1{font-size:clamp(42px,7cqi,84px)}
.lp-hero-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 50% at 85% 10%,rgb(var(--lp-accent-rgb) / .14),transparent 70%)}
.lp-hero-lines{position:absolute;inset:0;pointer-events:none;opacity:.5;background-image:linear-gradient(rgb(var(--lp-ink-rgb) / .05) 1px,transparent 1px),linear-gradient(90deg,rgb(var(--lp-ink-rgb) / .05) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at 70% 0%,#000 10%,transparent 65%)}
.lp-bg-dark .lp-hero-lines{background-image:linear-gradient(rgb(255 255 255 / .06) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255 / .06) 1px,transparent 1px)}
.lp-s-hero > .lp-wrap{position:relative}
.lp-hero-backdrop{position:absolute;inset:0}
.lp-hero-backdrop img,.lp-hero-backdrop .lp-img-edit{width:100%;height:100%;object-fit:cover;object-position:70% center}
.lp-hero-overlay{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(7,14,25,.95) 0%,rgba(7,14,25,.86) 38%,rgba(7,14,25,.3) 74%,rgba(7,14,25,.12))}
.lp-hero-cinematic-dark:has(.lp-hero-backdrop){color:#fff;background:#070e19}
.lp-hero-show-form{color:#fff;background:#070e19}
.lp-hero-show-form .lp-hero-overlay{background:linear-gradient(90deg,rgba(5,15,28,.97) 0%,rgba(5,15,28,.88) 30%,rgba(5,15,28,.38) 61%,rgba(5,15,28,.02) 100%)}
.lp-hero-show-form .lp-sub{color:rgba(255,255,255,.85)}
.lp-hero-show-form .lp-eyebrow{color:#fff}
.lp-hero-show-form .lp-btn-ghost{border-color:rgba(255,255,255,.5);color:#fff}
.lp-hero-cinematic-dark .lp-sub{color:rgba(255,255,255,.85)}
.lp-hero-cinematic-dark .lp-eyebrow{color:#fff}
.lp-hero-cinematic-dark .lp-btn-ghost{border-color:rgba(255,255,255,.5);color:#fff}
.lp-hero-cinematic-light .lp-hero-overlay{background:linear-gradient(90deg,rgba(255,255,255,.97),rgba(255,255,255,.9) 40%,rgba(255,255,255,.18))}
.lp-hero-cinematic-light:has(.lp-hero-backdrop){color:var(--lp-ink);background:var(--lp-surface)}
.lp-hero-cinematic-light .lp-sub{color:rgb(var(--lp-ink-rgb) / .78)}
.lp-hero-cinematic-light .lp-btn-ghost{border-color:rgb(var(--lp-ink-rgb) / .28);color:var(--lp-ink)}
.lp-cinematic-copy{max-width:760px;min-height:450px;display:flex;flex-direction:column;justify-content:center}
.lp-cinematic-copy h1{font-size:clamp(42px,5.4cqi,76px);max-width:780px}
.lp-cinematic-copy .lp-sub{max-width:620px}
.lp-image-disclosure{font-size:12px!important;opacity:.8;margin-top:18px!important;max-width:540px}
.lp-hero-product{background:radial-gradient(ellipse at 90% 35%,rgb(var(--lp-accent-rgb) / .16),transparent 60%),var(--lp-surface)}
.lp-hero-product .lp-hero-grid{grid-template-columns:1.15fr 1fr;gap:48px}
.lp-hero-product .lp-hero-media img{aspect-ratio:4/3;border:8px solid rgb(var(--lp-ink-rgb) / .08);border-radius:var(--lp-radius)}
.lp-s-hero:has(.lp-hero-grid){padding-top:72px;padding-bottom:72px}
.lp-hero-grid{align-items:start;gap:48px}
.lp-hero-grid h1{font-size:clamp(38px,4.4cqi,56px);line-height:1.06}
.lp-hero-grid .lp-sub{font-size:18px;line-height:1.55;margin-top:20px}
.lp-hero-grid .lp-hero-ctas{margin-top:26px}
.lp-hero-grid .lp-btn{padding:0 20px;font-size:14px}
.lp-hero-grid .lp-hl{margin-top:24px}
.lp-hero-grid .lp-hl li{font-size:14px}
/* trust */
.lp-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 36px}
.lp-trust li{display:flex;align-items:center;gap:10px;font-weight:600;font-size:16px;color:var(--lp-ink)}
.lp-root ul.lp-trust{list-style:none;margin:0;padding:0}
.lp-trust svg{width:22px;height:22px;color:var(--lp-accent);flex:none}
/* cards */
.lp-grid{display:grid;gap:22px}
.lp-g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.lp-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.lp-card{background:#fff;border:1px solid rgb(var(--lp-ink-rgb) / .08);border-radius:var(--lp-radius);padding:32px;box-shadow:0 1px 2px rgb(var(--lp-ink-rgb) / .04);transition:box-shadow .25s ease,transform .25s ease}
.lp-card:hover{box-shadow:0 24px 50px -30px rgb(var(--lp-ink-rgb) / .35)}
.lp-bg-dark .lp-card{background:rgb(255 255 255 / .05);border-color:rgb(255 255 255 / .1);color:#fff}
.lp-card h3{font-size:21px;margin-bottom:10px;line-height:1.25}
.lp-card p{color:var(--lp-muted);font-size:16.5px}
.lp-bg-dark .lp-card p{color:rgb(255 255 255 / .72)}
.lp-num{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgb(var(--lp-accent-rgb) / .1);color:var(--lp-accent);font-weight:700;margin-bottom:22px;font-family:var(--lp-font-heading)}
.lp-card-img{margin:-32px -32px 24px;aspect-ratio:16/10;overflow:hidden;border-radius:var(--lp-radius) var(--lp-radius) 0 0}
.lp-card-img img{width:100%;height:100%;object-fit:cover}
/* process */
.lp-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px;counter-reset:step;list-style:none;margin:0;padding:0}
.lp-step{position:relative;padding-top:64px}
.lp-step::before{counter-increment:step;content:"0" counter(step);position:absolute;top:0;left:0;font-family:var(--lp-font-heading);font-weight:700;font-size:15px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1px solid rgb(255 255 255 / .25);color:#fff;background:rgb(255 255 255 / .04)}
.lp-bg-default .lp-step::before,.lp-bg-alt .lp-step::before{border-color:rgb(var(--lp-ink-rgb) / .2);color:var(--lp-ink)}
.lp-step::after{content:"";position:absolute;top:22px;left:56px;right:-16px;height:1px;background:currentColor;opacity:.18}
.lp-step:last-child::after{display:none}
.lp-step h3{font-size:20px;margin-bottom:8px}
.lp-step p{font-size:16px;opacity:.78}
/* gallery */
.lp-gallery{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:240px;gap:16px}
.lp-gallery figure{margin:0;overflow:hidden;border-radius:var(--lp-radius);background:var(--lp-surface-alt)}
.lp-gallery figure:first-child{grid-column:span 2;grid-row:span 2}
.lp-gallery img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
.lp-gallery figure:hover img{transform:scale(1.03)}
.lp-video{position:relative;aspect-ratio:16/9;border-radius:var(--lp-radius);overflow:hidden;background:#000;box-shadow:0 30px 70px -40px rgb(var(--lp-ink-rgb) / .6)}
.lp-video iframe,.lp-video video{position:absolute;inset:0;width:100%;height:100%;border:0}
/* testimonials */
.lp-quote{display:flex;flex-direction:column;justify-content:space-between;gap:28px}
.lp-quote blockquote{margin:0;font-size:18.5px;line-height:1.55;color:var(--lp-ink);font-weight:500}
.lp-quote svg{width:30px;height:30px;color:var(--lp-accent);opacity:.55;margin-bottom:14px}
.lp-quote figcaption{font-weight:700;color:var(--lp-ink);font-size:16px}
.lp-quote figcaption span{display:block;font-weight:500;color:var(--lp-muted);font-size:15px}
.lp-g1{grid-template-columns:minmax(0,880px)}
.lp-align-center .lp-g1{justify-content:center}
.lp-quote-feature{padding:48px 52px}
.lp-quote-feature blockquote{font-family:var(--lp-font-heading);font-size:clamp(22px,2.6cqi,30px);line-height:1.4;letter-spacing:-0.015em}
.lp-quote-feature svg{width:40px;height:40px}
/* about */
.lp-about{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.lp-about img{width:100%;aspect-ratio:5/4;object-fit:cover;border-radius:calc(var(--lp-radius) * 1.3)}
.lp-about .lp-body{font-size:18px;margin-top:18px;white-space:pre-line}
/* offer */
.lp-offer{display:flex;align-items:center;justify-content:space-between;gap:40px}
.lp-offer h2{font-size:clamp(30px,4cqi,44px);max-width:720px}
.lp-offer p{margin-top:14px;font-size:18px;max-width:640px;opacity:.88}
.lp-fine{font-size:14px;margin-top:14px;opacity:.75}
/* faq */
.lp-faq{max-width:860px}
.lp-align-center .lp-faq{margin:0 auto}
.lp-faq details{border-bottom:1px solid rgb(var(--lp-ink-rgb) / .12);padding:4px 0}
.lp-bg-dark .lp-faq details{border-color:rgb(255 255 255 / .15)}
.lp-faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:24px;padding:22px 0;font-family:var(--lp-font-heading);font-weight:600;font-size:19px;color:inherit}
.lp-faq summary::-webkit-details-marker{display:none}
.lp-faq summary::after{content:"+";font-size:26px;font-weight:400;color:var(--lp-accent);transition:transform .25s ease;flex:none}
.lp-faq details[open] summary::after{transform:rotate(45deg)}
.lp-faq .lp-a{padding:0 0 24px;color:var(--lp-muted);font-size:17px;max-width:720px}
.lp-bg-dark .lp-faq .lp-a{color:rgb(255 255 255 / .72)}
/* enquiry */
.lp-enq{display:grid;grid-template-columns:.85fr 1.15fr;gap:64px;align-items:start}
.lp-side{list-style:none;padding:0;margin:30px 0 0;display:grid;gap:14px}
.lp-side li{display:flex;gap:12px;align-items:center;font-weight:500}
.lp-direct{margin-top:36px;padding-top:28px;border-top:1px solid rgb(var(--lp-ink-rgb) / .1);display:grid;gap:12px}
.lp-direct a{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-weight:600;color:var(--lp-ink)}
.lp-direct svg{width:18px;height:18px;color:var(--lp-accent)}
.lp-bg-dark .lp-direct a{color:#fff}
.lp-bg-dark .lp-direct{border-top-color:rgb(255 255 255 / .18)}
.lp-form{background:#fff;border-radius:calc(var(--lp-radius) * 1.2);padding:40px;box-shadow:0 40px 80px -48px rgb(var(--lp-ink-rgb) / .5);border:1px solid rgb(var(--lp-ink-rgb) / .07);color:var(--lp-text)}
.lp-form h3{font-size:24px;margin-bottom:6px;color:var(--lp-ink)}
.lp-form .lp-form-intro{color:var(--lp-muted);font-size:16px;margin-bottom:24px}
.lp-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px 18px}
.lp-field{display:flex;flex-direction:column;gap:7px}
.lp-field.lp-wide{grid-column:1 / -1}
.lp-field label{font-size:15px;font-weight:600;color:var(--lp-ink)}
.lp-field label .lp-req{color:var(--lp-accent);margin-left:2px}
.lp-root .lp-field input,.lp-root .lp-field select,.lp-root .lp-field textarea{font:inherit;font-size:16px!important;font-weight:400!important;color:var(--lp-text)!important;background:var(--lp-surface)!important;border:1px solid rgb(var(--lp-ink-rgb) / .16)!important;border-radius:var(--lp-radius-sm)!important;padding:13px 15px!important;margin:0!important;min-height:50px;width:100%;outline:none!important;transition:border-color .2s ease,box-shadow .2s ease}
.lp-root .lp-field input::placeholder,.lp-root .lp-field textarea::placeholder{color:var(--lp-muted)!important;opacity:.7}
.lp-field textarea{min-height:120px;resize:vertical}
.lp-root .lp-field input:focus,.lp-root .lp-field select:focus,.lp-root .lp-field textarea:focus{outline:none!important;border-color:var(--lp-accent)!important;box-shadow:0 0 0 4px rgb(var(--lp-accent-rgb) / .14);background:#fff!important;color:var(--lp-text)!important}
.lp-root .lp-field[data-invalid="true"] input,.lp-root .lp-field[data-invalid="true"] select,.lp-root .lp-field[data-invalid="true"] textarea{border-color:#c2410c!important}
.lp-err{font-size:14px;color:#b42318;font-weight:500}
.lp-consent{display:flex;gap:12px;align-items:flex-start;margin-top:20px;font-size:15px;color:var(--lp-muted);line-height:1.5}
.lp-root .lp-consent input{width:20px!important;height:20px!important;margin:2px 0 0!important;accent-color:var(--lp-accent);flex:none}
.lp-form .lp-btn{width:100%;margin-top:24px;min-height:56px;font-size:17px}
.lp-form-note{margin-top:14px;font-size:14px;color:var(--lp-muted);text-align:center}
.lp-form-alert{margin-top:16px;padding:14px 16px;border-radius:var(--lp-radius-sm);background:#fef3f2;color:#912018;font-size:15px}
.lp-thanks{text-align:center;padding:24px 8px}
.lp-thanks svg{width:52px;height:52px;color:var(--lp-accent);margin:0 auto 18px}
.lp-thanks h3{font-size:26px;margin-bottom:10px}
.lp-hp{position:absolute!important;left:-10000px!important;width:1px;height:1px;overflow:hidden}
/* contact */
.lp-contact{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.lp-contact a,.lp-contact div.lp-card{text-decoration:none;display:flex;flex-direction:column;gap:6px}
.lp-contact svg{width:24px;height:24px;color:var(--lp-accent);margin-bottom:10px}
.lp-contact strong{font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:var(--lp-muted);font-weight:600}
.lp-contact span{font-size:18px;font-weight:600;color:var(--lp-ink);overflow-wrap:anywhere}
/* footer */
.lp-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:24px;align-items:flex-start}
.lp-foot .lp-brand{color:#fff}
.lp-foot .lp-mark{background:#fff;color:var(--lp-ink)}
.lp-foot p{font-size:15px;color:rgb(255 255 255 / .7);margin-top:12px;max-width:440px}
.lp-foot-links{display:flex;flex-wrap:wrap;gap:20px;font-size:15px}
.lp-foot-links a{color:rgb(255 255 255 / .8);text-decoration:none}
.lp-foot-links a:hover{color:#fff}
.lp-legal{margin-top:36px;padding-top:24px;border-top:1px solid rgb(255 255 255 / .12);font-size:14px;color:rgb(255 255 255 / .6);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}
/* reveal */
@media (prefers-reduced-motion:no-preference){.lp-root[data-animate="true"] .lp-sec .lp-wrap{animation:lp-rise .8s cubic-bezier(.16,1,.3,1) both}}
@keyframes lp-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
/* tablet */
@container lp (max-width: 1000px){
  .lp-hero-product .lp-hero-grid{grid-template-columns:1fr}
  .lp-hero-grid,.lp-about,.lp-enq{grid-template-columns:1fr;gap:48px}
  .lp-hero-media img{aspect-ratio:16/11}
  .lp-hero-card{left:16px}
  .lp-g3{grid-template-columns:repeat(2,minmax(0,1fr))}
  .lp-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .lp-step::after{display:none}
  .lp-offer{flex-direction:column;align-items:flex-start}
  .lp-pad-md{padding:80px 0}.lp-pad-lg{padding:100px 0}
}
/* Image-led campaign layouts are opt-in section variants; existing pages retain their spacing. */
.lp-section-nav{display:flex;gap:24px;margin-right:16px}
.lp-section-nav a{font-size:13px;font-weight:600;text-decoration:none}
.lp-campaign-cinematic .lp-nav{background:#0b1728;color:#fff;border:0}
.lp-campaign-cinematic .lp-brand{color:#fff}
.lp-campaign-cinematic .lp-mark{background:#fff;color:var(--lp-ink)}
.lp-hero-cinematic-dark:has(.lp-hero-backdrop),.lp-hero-cinematic-light:has(.lp-hero-backdrop){padding:56px 0 34px}
.lp-cinematic-copy{min-height:420px;max-width:660px}
.lp-cinematic-copy h1{font-size:clamp(42px,4.5cqi,64px);line-height:1.03;letter-spacing:-.045em}
.lp-cinematic-copy .lp-sub{font-size:18px;line-height:1.55;max-width:590px;margin-top:20px}
.lp-cinematic-copy .lp-hero-ctas{margin-top:24px}
.lp-cinematic-copy .lp-hl{margin-top:24px;gap:8px 18px}
.lp-cinematic-copy .lp-hl li{font-size:13px}
.lp-cinematic-copy .lp-image-disclosure{font-size:10px!important;opacity:.75;max-width:510px}
.lp-cinematic-with-form{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.78fr);gap:44px;align-items:center;max-width:none;min-height:520px}
.lp-cinematic-content{min-width:0}
.lp-hero-form{position:relative;z-index:2;min-width:0}
.lp-hero-form .lp-form{padding:26px;border-radius:16px;box-shadow:0 24px 60px rgb(0 0 0 / .24)}
.lp-cinematic-with-form .lp-image-disclosure{grid-column:1/-1}
.lp-hero-form .lp-form h3{font-size:22px}
.lp-hero-form .lp-form .lp-form-intro{font-size:14px;line-height:1.45;margin-bottom:14px}
.lp-hero-form .lp-fields{gap:10px 12px}
.lp-hero-form .lp-field{gap:4px}
.lp-hero-form .lp-field label{font-size:12px}
.lp-hero-form .lp-field input,.lp-hero-form .lp-field select,.lp-hero-form .lp-field textarea{min-height:42px;padding:9px 11px!important;font-size:14px!important}
.lp-hero-form .lp-field textarea{min-height:72px}
.lp-hero-form .lp-consent{font-size:11px;line-height:1.4;margin:12px 0}
.lp-hero-form .lp-btn{width:100%;min-height:46px}
.lp-hero-form .lp-form-note{font-size:11px}
.lp-hero-cinematic-dark .lp-hero-overlay{background:linear-gradient(90deg,rgba(5,15,28,.97) 0%,rgba(5,15,28,.88) 30%,rgba(5,15,28,.38) 61%,rgba(5,15,28,.02) 100%)}
.lp-layout-comparison,.lp-layout-showcase,.lp-layout-connected{padding:38px 0}
.lp-layout-comparison .lp-head,.lp-layout-showcase .lp-head,.lp-layout-connected .lp-head{max-width:920px;margin-bottom:24px}
.lp-layout-comparison .lp-eyebrow,.lp-layout-showcase .lp-eyebrow,.lp-layout-connected .lp-eyebrow{margin-bottom:10px}
.lp-layout-comparison .lp-h2,.lp-layout-showcase .lp-h2,.lp-layout-connected .lp-h2{font-size:clamp(26px,2.7cqi,36px)}
.lp-layout-comparison .lp-lead,.lp-layout-showcase .lp-lead,.lp-layout-connected .lp-lead{font-size:15px;max-width:760px;margin-top:10px}
.lp-comparison{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.lp-comparison-media{grid-template-columns:1fr 1.05fr .95fr}
.lp-compare-panel{border-radius:14px;padding:24px;background:var(--lp-surface-alt)}
.lp-compare-solutions{background:linear-gradient(135deg,rgb(var(--lp-accent-rgb) / .13),rgb(var(--lp-accent-rgb) / .03));border:1px solid rgb(var(--lp-accent-rgb) / .1)}
.lp-compare-panel h3{font-size:19px;margin-bottom:16px}
.lp-compare-panel ul{list-style:none;padding:0;margin:0;display:grid;gap:13px}
.lp-compare-panel li{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.5}
.lp-compare-panel li svg{width:17px;height:17px;flex:none;color:var(--lp-accent);margin-top:2px}
.lp-compare-panel li strong{font-size:13px}
.lp-compare-panel li p{font-size:12px;color:var(--lp-muted);margin-top:2px}
.lp-cross{background:#ef5260;border-radius:50%;color:white;width:16px;height:16px;text-align:center;line-height:15px;flex:none;margin-top:2px}
.lp-story-image{margin:0;position:relative;overflow:hidden;border-radius:14px;min-height:240px;background:var(--lp-ink)}
.lp-story-image>img,.lp-story-image>.lp-img-edit,.lp-story-image .lp-img-edit img{width:100%;height:100%;object-fit:cover}
.lp-story-image>img,.lp-story-image>.lp-img-edit{position:absolute;inset:0}
.lp-story-image::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(transparent,rgba(5,15,28,.9))}
.lp-story-image figcaption{position:absolute;bottom:20px;left:20px;right:20px;z-index:1;color:#fff}
.lp-story-image h3{font-size:27px;max-width:230px;margin-bottom:10px}
.lp-story-image figcaption>span{font-size:10px;opacity:.8;display:block}
.lp-layout-showcase .lp-grid{grid-template-columns:repeat(var(--lp-cols,4),minmax(0,1fr));gap:16px}
.lp-layout-showcase .lp-card{padding:18px;border-radius:12px;position:relative}
.lp-layout-showcase .lp-card-img{margin:-18px -18px 14px;aspect-ratio:16/9;border-radius:12px 12px 0 0}
.lp-layout-showcase .lp-card h3{font-size:16px;margin-bottom:7px}
.lp-layout-showcase .lp-card p{font-size:13px;line-height:1.55}
.lp-layout-showcase .lp-card .lp-card-caption{font-size:9px;color:var(--lp-muted);margin:-8px 0 12px}
.lp-layout-showcase .lp-num{display:none}
.lp-feature-icon{display:inline-flex;width:29px;height:29px;color:var(--lp-accent);margin-bottom:10px}
.lp-feature-icon svg{width:100%;height:100%}
.lp-layout-connected .lp-steps{grid-template-columns:repeat(5,minmax(0,1fr));gap:24px}
.lp-layout-connected .lp-step{padding-top:0}
.lp-layout-connected .lp-step::before{display:none}
.lp-layout-connected .lp-step::after{left:64px;top:25px;right:0}
.lp-workflow-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:13px;border:1px solid rgb(var(--lp-accent-rgb) / .5);background:rgb(var(--lp-accent-rgb) / .14);margin-bottom:15px;color:var(--lp-accent)}
.lp-workflow-icon svg{width:27px;height:27px}
.lp-layout-connected .lp-step h3{font-size:16px}
.lp-layout-connected .lp-step p{font-size:13px;line-height:1.55}
.lp-about-media{margin:0}
.lp-layout-image-banner{padding:0;overflow:hidden;background:var(--lp-ink);color:#fff}
.lp-layout-image-banner .lp-wrap{max-width:none;padding:0}
.lp-layout-image-banner .lp-about{position:relative;display:block;min-height:300px;padding:64px max(32px,calc((100% - 1136px)/2))}
.lp-layout-image-banner .lp-about>div{position:relative;z-index:2;max-width:550px}
.lp-layout-image-banner .lp-about-media{position:absolute;inset:0}
.lp-layout-image-banner .lp-about-media img,.lp-layout-image-banner .lp-about-media .lp-img-edit{width:100%;height:100%;object-fit:cover;border-radius:0}
.lp-layout-image-banner .lp-about-media::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,15,28,.96),rgba(5,15,28,.65) 45%,rgba(5,15,28,.05));pointer-events:none}
.lp-layout-image-banner .lp-about-media figcaption{position:absolute;bottom:12px;right:24px;z-index:2;font-size:10px!important}
.lp-layout-image-banner .lp-body{color:rgba(255,255,255,.8);font-size:16px}
.lp-enquiry-image{margin:28px 0 0}
.lp-enquiry-image img{width:100%;aspect-ratio:16/7;object-fit:cover;border-radius:14px}
.lp-enquiry-image .lp-image-disclosure{font-size:10px!important;margin-top:8px!important}
.lp-layout-image-backed .lp-enq{grid-template-columns:1fr 1fr}
.lp-layout-image-backed .lp-enquiry-image{margin-top:28px}
.lp-layout-image-backed .lp-enquiry-image img{aspect-ratio:16/10;min-height:260px}
.lp-layout-image-backed .lp-direct a{color:#fff}
.lp-layout-image-backed .lp-form{box-shadow:0 36px 90px -42px rgb(0 0 0 / .75)}
@container lp (max-width: 1000px){
  .lp-section-nav{display:none}
  .lp-comparison-media{grid-template-columns:1fr 1fr}
  .lp-comparison-media .lp-story-image{grid-column:1/-1;min-height:220px}
  .lp-layout-showcase .lp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
/* mobile */
@container lp (max-width: 680px){
  .lp-s-hero:has(.lp-hero-grid){padding-top:28px;padding-bottom:48px}
  .lp-hero-grid{gap:28px}
  .lp-hero-grid .lp-hero-media{order:-1}
  .lp-hero-grid .lp-hero-media img{aspect-ratio:16/8;object-position:70% 55%}
  .lp-hero-grid .lp-hero-card{display:none}
  .lp-hero-grid .lp-image-disclosure{margin-top:8px!important}
  .lp-hero-grid h1{font-size:clamp(32px,9cqi,38px)}
  .lp-root .lp-hero-grid h1{font-size:32px;line-height:1.08;letter-spacing:-.035em;text-wrap:pretty}
  .lp-root .lp-hero-grid .lp-sub{font-size:17px;line-height:1.5}
  .lp-cinematic-copy{min-height:0}
  .lp-cinematic-with-form{grid-template-columns:1fr;gap:20px;min-height:0}
  .lp-cinematic-with-form .lp-cinematic-content{max-width:620px}
  .lp-cinematic-with-form .lp-hero-form{max-width:620px}
  .lp-cinematic-with-form .lp-hero-form .lp-form{padding:22px 18px}
  .lp-hero-cinematic-dark:has(.lp-hero-backdrop),.lp-hero-cinematic-light:has(.lp-hero-backdrop),.lp-hero-show-form:has(.lp-hero-backdrop){padding-top:230px;padding-bottom:48px}
  .lp-hero-backdrop img{object-position:72% top}
  .lp-hero-cinematic-dark .lp-hero-overlay{background:linear-gradient(0deg,rgba(7,14,25,.98) 0%,rgba(7,14,25,.9) 58%,rgba(7,14,25,.12) 100%)}
  .lp-hero-cinematic-light .lp-hero-overlay{background:linear-gradient(0deg,rgba(255,255,255,.99) 0%,rgba(255,255,255,.94) 58%,rgba(255,255,255,.12) 100%)}
  .lp-root{font-size:16px}
  .lp-wrap{padding:0 20px}
  .lp-pad-sm{padding:36px 0}.lp-pad-md{padding:64px 0}.lp-pad-lg{padding:72px 0}
  .lp-head{margin-bottom:36px}
  .lp-g3,.lp-g2,.lp-steps,.lp-contact,.lp-fields{grid-template-columns:1fr}
  .lp-gallery{grid-template-columns:1fr 1fr;grid-auto-rows:150px}
  .lp-gallery figure:first-child{grid-column:span 2;grid-row:span 2}
  .lp-s-hero h1{font-size:clamp(34px,10cqi,44px)}
  .lp-s-hero .lp-sub{font-size:18px}
  .lp-hero-ctas .lp-btn{width:100%}
  .lp-hero-card{position:static;margin-top:16px;margin-left:16px;margin-right:16px;max-width:none}
  .lp-nav-phone span{display:none}
  .lp-nav .lp-btn{display:none}
  .lp-nav-in{height:64px}
  .lp-card{padding:26px}.lp-card-img{margin:-26px -26px 20px}
  .lp-quote-feature{padding:28px 24px}
  .lp-form{padding:26px 20px}
  .lp-lead{font-size:17px}
  .lp-hide-mobile{display:none!important}
  .lp-m-center{text-align:center}
  .lp-m-center .lp-eyebrow,.lp-m-center .lp-hero-ctas,.lp-m-center .lp-hl{justify-content:center}
  .lp-m-center .lp-head,.lp-m-center .lp-lead,.lp-m-center .lp-sub{margin-left:auto;margin-right:auto}
  .lp-hero-cinematic-dark:has(.lp-hero-backdrop),.lp-hero-cinematic-light:has(.lp-hero-backdrop){padding:136px 0 28px}
  .lp-cinematic-copy h1{font-size:38px;max-width:480px}
  .lp-cinematic-copy .lp-sub{font-size:16px;line-height:1.5;margin-top:16px}
  .lp-cinematic-copy .lp-eyebrow{font-size:10px;letter-spacing:.12em;margin-bottom:12px}
  .lp-cinematic-copy .lp-hl{gap:8px;margin-top:18px}
  .lp-cinematic-copy .lp-hl li{font-size:11px}
  .lp-cinematic-copy .lp-hero-ctas{margin-top:20px}
  .lp-cinematic-copy .lp-btn{min-height:48px;font-size:14px}
  .lp-hero-backdrop img{object-position:65% top}
  .lp-hero-show-form:has(.lp-hero-backdrop){padding:280px 0 28px}
  .lp-hero-show-form:has(.lp-hero-backdrop) .lp-hero-backdrop{height:270px;bottom:auto}
  .lp-hero-show-form:has(.lp-hero-backdrop) .lp-hero-backdrop img{object-position:55% 60%}
  .lp-hero-show-form .lp-hero-overlay{background:linear-gradient(0deg,#070e19 0%,rgba(7,14,25,.7) 20%,rgba(7,14,25,0) 55%)}
  .lp-hero-cinematic-dark .lp-hero-overlay{background:linear-gradient(0deg,rgba(5,15,28,.99),rgba(5,15,28,.94) 44%,rgba(5,15,28,.45) 75%,rgba(5,15,28,.05))}
  .lp-layout-comparison,.lp-layout-showcase,.lp-layout-connected{padding:30px 0}
  .lp-comparison,.lp-comparison-media{grid-template-columns:1fr}
  .lp-comparison-media .lp-story-image{grid-column:auto}
  .lp-compare-panel{padding:20px}
  .lp-layout-showcase .lp-grid{gap:12px}
  .lp-layout-showcase .lp-card{padding:14px}
  .lp-layout-showcase .lp-card-img{margin:-14px -14px 12px;aspect-ratio:4/3}
  .lp-layout-showcase .lp-card h3{font-size:15px}
  .lp-layout-showcase .lp-card p{font-size:12px}
  .lp-layout-connected .lp-steps{grid-template-columns:1fr;gap:20px}
  .lp-layout-connected .lp-step{padding-left:70px;min-height:52px}
  .lp-workflow-icon{position:absolute;left:0;top:0}
  .lp-layout-connected .lp-step::after{display:block;left:26px;top:59px;bottom:-12px;width:1px;height:auto}
  .lp-layout-connected .lp-step:last-child::after{display:none}
  .lp-layout-image-banner .lp-about{min-height:330px;padding:44px 20px 60px}
  .lp-layout-image-banner .lp-about-media figcaption{left:20px;right:20px}
}
@container lp (min-width: 681px) and (max-width: 900px){
  .lp-cinematic-with-form{grid-template-columns:minmax(0,1fr) minmax(300px,.85fr);gap:24px}
  .lp-cinematic-copy h1{font-size:clamp(38px,5cqi,54px)}
  .lp-cinematic-with-form .lp-form{padding:22px}
  .lp-cinematic-with-form .lp-fields{grid-template-columns:1fr}
  .lp-cinematic-with-form .lp-field.lp-wide{grid-column:auto}
}
`;
