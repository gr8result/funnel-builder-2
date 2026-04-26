// /pages/modules/email/templates/select.js
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import s from "./select.module.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function prettyTemplateName(value) {
  const raw = String(value || "").replace(/\.html$/i, "").trim();
  const isImported = /^(studio-|template-)/i.test(raw);
  const clean = raw
    .replace(/^(studio-|template-)/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return isImported ? `Campaign ${clean}` : clean;
}

function normalizeTemplateKey(value) {
  return String(value || "")
    .replace(/\.html$/i, "")
    .replace(/^gr8result marketing\s*-\s*/i, "")
    .replace(/^gr8result\s+/i, "")
    .replace(/^business\s+/i, "")
    .replace(/^campaign\s+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getTemplateAssetBase(tpl) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (tpl?.htmlUrl) return String(tpl.htmlUrl).replace(/[^/]+(?:\?.*)?$/, '');
  if (!supabaseUrl || !tpl?.path) return '';

  const bucket = tpl?.type === 'base' ? 'email-assets' : 'email-user-assets';
  const path = String(tpl.path).replace(/^\/+/, '');
  const slashIndex = path.lastIndexOf('/');
  const dir = slashIndex >= 0 ? path.slice(0, slashIndex + 1) : '';
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${dir}`;
}

function absolutizeTemplateAssets(html, tpl) {
  const input = String(html || '');
  const base = getTemplateAssetBase(tpl);
  if (!input || !base) return input;

  const toAbsolute = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw || /^(data:|mailto:|tel:|#|https?:)/i.test(raw) || raw.startsWith('//') || raw.startsWith('{{')) return raw;
    return `${base.replace(/\/+$/, '')}/${raw.replace(/^\.\//, '').replace(/^\//, '')}`;
  };

  return input
    .replace(/src=(['"])(?!data:|mailto:|tel:|#|\/\/|https?:|\{)([^'"]+)\1/gi, (_, quote, url) => `src=${quote}${toAbsolute(url)}${quote}`)
    .replace(/url\((['"]?)(?!data:|#|\/\/|https?:|\{)([^'")]+)\1\)/gi, (_, quote, url) => `url(${quote}${toAbsolute(url)}${quote})`);
}

function makeThemeThumb(title, accent = '#2563eb', bg = '#0f172a', soft = '#eff6ff') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="520" height="720" viewBox="0 0 520 720">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${soft}"/>
          <stop offset="100%" stop-color="${bg}"/>
        </linearGradient>
      </defs>
      <rect width="520" height="720" rx="28" fill="#ffffff"/>
      <rect x="18" y="18" width="484" height="684" rx="24" fill="url(#g)"/>
      <rect x="46" y="54" width="140" height="16" rx="8" fill="#ffffffaa"/>
      <rect x="46" y="94" width="250" height="36" rx="10" fill="#ffffff"/>
      <rect x="46" y="144" width="220" height="14" rx="7" fill="#ffffffcc"/>
      <rect x="46" y="182" width="428" height="170" rx="20" fill="${accent}" opacity="0.92"/>
      <circle cx="382" cy="148" r="58" fill="#ffffff22"/>
      <circle cx="428" cy="106" r="30" fill="#ffffff33"/>
      <rect x="46" y="382" width="200" height="18" rx="9" fill="#0f172a" opacity="0.9"/>
      <rect x="46" y="414" width="390" height="12" rx="6" fill="#334155" opacity="0.3"/>
      <rect x="46" y="438" width="360" height="12" rx="6" fill="#334155" opacity="0.22"/>
      <rect x="46" y="486" width="126" height="38" rx="19" fill="${accent}"/>
      <rect x="46" y="556" width="134" height="100" rx="18" fill="#ffffffbb"/>
      <rect x="192" y="556" width="134" height="100" rx="18" fill="#ffffff99"/>
      <rect x="338" y="556" width="134" height="100" rx="18" fill="#ffffff77"/>
      <text x="46" y="118" font-size="28" font-weight="700" font-family="Arial, Helvetica, sans-serif" fill="#0f172a">${String(title).replace(/&/g, '&amp;')}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function photoThumb(theme = 'lifestyle', width = 900) {
  const photos = {
    summer: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=' + width + '&q=80',
    beauty: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=' + width + '&q=80',
    food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=' + width + '&q=80',
    property: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=' + width + '&q=80',
    fashion: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=' + width + '&q=80',
    wellness: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=' + width + '&q=80',
    app: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=' + width + '&q=80',
  };

  return photos[theme] || photos.summer;
}

function buildPreviewHtml({ title, accent = '#2563eb', bg = '#0f172a', body = 'Editable email design', soft = '#eff6ff', layout = 'hero' }) {
  const layouts = {
    hero: `
      <div style="background:${bg};color:#fff;padding:24px 20px;text-align:center;">
        <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.8;margin-bottom:8px;">Editable Template</div>
        <div style="font-size:28px;font-weight:700;line-height:1.2;">${title}</div>
      </div>
      <div style="padding:20px;background:${soft};text-align:center;">
        <div style="height:120px;border-radius:10px;background:linear-gradient(135deg, ${accent}, #ffffff22);"></div>
      </div>
      <div style="padding:18px 20px;color:#0f172a;">
        <p style="margin:0 0 10px;font-size:18px;font-weight:700;">${body}</p>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.5;">Fully editable blocks with working image placeholders, text areas, and CTAs.</p>
      </div>
    `,
    editorial: `
      <div style="padding:18px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.18em;color:${accent};text-transform:uppercase;">Weekly Digest</div>
        <div style="font-size:12px;color:#64748b;">Issue 24</div>
      </div>
      <div style="padding:18px 20px;">
        <div style="font-size:24px;font-weight:800;color:#0f172a;line-height:1.2;margin-bottom:8px;">${title}</div>
        <div style="color:#475569;font-size:14px;line-height:1.55;">${body}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 20px 20px;">
        <div style="background:${soft};border-radius:10px;height:86px;"></div>
        <div style="background:#e2e8f0;border-radius:10px;height:86px;"></div>
      </div>
    `,
    product: `
      <div style="padding:18px;background:${soft};text-align:center;">
        <div style="height:138px;border-radius:14px;background:linear-gradient(145deg,#ffffff,${accent});border:1px solid rgba(15,23,42,.08);"></div>
      </div>
      <div style="padding:18px 20px;">
        <div style="font-size:25px;font-weight:800;color:#0f172a;margin-bottom:6px;">${title}</div>
        <div style="color:#475569;font-size:14px;margin-bottom:14px;">${body}</div>
        <span style="display:inline-block;background:${accent};color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:700;">Shop Now</span>
      </div>
    `,
    invitation: `
      <div style="background:linear-gradient(135deg,${bg},${accent});color:#fff;padding:26px 20px;text-align:center;">
        <div style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;opacity:.85;margin-bottom:10px;">Save The Date</div>
        <div style="font-size:28px;font-weight:800;line-height:1.2;">${title}</div>
        <div style="margin-top:8px;font-size:14px;opacity:.92;">${body}</div>
      </div>
      <div style="padding:16px 20px;display:grid;gap:8px;">
        <div style="background:${soft};padding:10px 12px;border-radius:10px;color:#334155;font-size:13px;">Date • Time • Location</div>
        <div style="background:${soft};padding:10px 12px;border-radius:10px;color:#334155;font-size:13px;">Speaker • Agenda • RSVP</div>
      </div>
    `,
    minimal: `
      <div style="padding:24px 22px;">
        <div style="width:42px;height:4px;background:${accent};border-radius:999px;margin-bottom:14px;"></div>
        <div style="font-size:27px;font-weight:800;color:#0f172a;line-height:1.2;margin-bottom:8px;">${title}</div>
        <div style="font-size:14px;line-height:1.6;color:#475569;margin-bottom:16px;">${body}</div>
        <div style="height:1px;background:#e2e8f0;margin:12px 0 14px;"></div>
        <span style="display:inline-block;color:${accent};font-size:13px;font-weight:800;">Read More →</span>
      </div>
    `,
    gallery: `
      <div style="background:${bg};color:#fff;padding:22px 20px;text-align:center;">
        <div style="font-size:27px;font-weight:800;">${title}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:${soft};">
        <div style="height:78px;border-radius:10px;background:#fff;"></div>
        <div style="height:78px;border-radius:10px;background:#fff;"></div>
        <div style="height:78px;border-radius:10px;background:#fff;"></div>
        <div style="height:78px;border-radius:10px;background:#fff;"></div>
      </div>
    `,
    app: `
      <div style="background:${bg};padding:18px 20px;color:#fff;">
        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.8;">Product Update</div>
        <div style="font-size:26px;font-weight:800;line-height:1.2;margin-top:8px;">${title}</div>
      </div>
      <div style="padding:16px 20px;display:flex;gap:12px;align-items:center;">
        <div style="flex:0 0 88px;height:120px;border-radius:16px;background:linear-gradient(180deg,${accent},#0f172a);"></div>
        <div style="flex:1;">
          <div style="height:10px;background:#cbd5e1;border-radius:999px;margin-bottom:10px;width:90%;"></div>
          <div style="height:10px;background:#e2e8f0;border-radius:999px;margin-bottom:10px;width:75%;"></div>
          <div style="height:10px;background:#e2e8f0;border-radius:999px;width:60%;"></div>
        </div>
      </div>
    `,
  };

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
      <div style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;overflow:hidden;">
        ${layouts[layout] || layouts.hero}
      </div>
    </body>
  </html>`;
}

const EDITABLE_TEMPLATE_LIBRARY = [
  {
    id: 'preset-black-friday',
    name: 'Black Friday Campaign',
    type: 'preset',
    preset: 'black-friday',
    html: buildPreviewHtml({ title: 'Black Friday Campaign', accent: '#f97316', bg: '#09090b', body: 'Bold seasonal promo with stacked offers and urgency.', soft: '#fff7ed', layout: 'hero' }),
    thumbUrl: makeThemeThumb('Black Friday', '#f97316', '#09090b', '#fff7ed'),
  },
  {
    id: 'preset-bundle',
    name: 'Bundle Deal Promo',
    type: 'preset',
    preset: 'bundle-sale',
    html: buildPreviewHtml({ title: 'Bundle Deal Promo', accent: '#0ea5e9', bg: '#082f49', body: 'Built for multi-buy offers, bundles, and upsells.', soft: '#e0f2fe', layout: 'product' }),
    thumbUrl: makeThemeThumb('Bundle Deal', '#0ea5e9', '#082f49', '#e0f2fe'),
  },
  {
    id: 'preset-quiz',
    name: 'Quiz Recommendation',
    type: 'preset',
    preset: 'quiz-recommendation',
    html: buildPreviewHtml({ title: 'Quiz Recommendation', accent: '#8b5cf6', bg: '#312e81', body: 'Perfect for assessment results, custom plans, and guided next steps.', soft: '#ede9fe', layout: 'invitation' }),
    thumbUrl: makeThemeThumb('Quiz Funnel', '#8b5cf6', '#312e81', '#ede9fe'),
  },
  {
    id: 'preset-cart',
    name: 'Cart Recovery Reminder',
    type: 'preset',
    preset: 'cart-recovery',
    html: buildPreviewHtml({ title: 'Cart Recovery Reminder', accent: '#ef4444', bg: '#7f1d1d', body: 'Use for cart abandonment, urgency, and saved-cart reminders.', soft: '#fee2e2', layout: 'minimal' }),
    thumbUrl: makeThemeThumb('Cart Recovery', '#ef4444', '#7f1d1d', '#fee2e2'),
  },
  {
    id: 'preset-newsletter',
    name: 'Newsletter Digest',
    type: 'preset',
    preset: 'newsletter',
    html: buildPreviewHtml({ title: 'Newsletter Digest', accent: '#2563eb', bg: '#0f172a', body: 'Editorial layout for updates, articles, and links.', soft: '#dbeafe', layout: 'editorial' }),
    thumbUrl: makeThemeThumb('Newsletter', '#2563eb', '#0f172a', '#dbeafe'),
  },
  {
    id: 'preset-stories',
    name: 'Customer Story Listicle',
    type: 'preset',
    preset: 'customer-stories',
    html: buildPreviewHtml({ title: 'Customer Story Listicle', accent: '#ec4899', bg: '#831843', body: 'Great for before-and-after style social proof and story-led selling.', soft: '#fce7f3', layout: 'editorial' }),
    thumbUrl: makeThemeThumb('Customer Stories', '#ec4899', '#831843', '#fce7f3'),
  },
  {
    id: 'preset-product',
    name: 'Product Spotlight',
    type: 'preset',
    preset: 'product-spotlight',
    html: buildPreviewHtml({ title: 'Product Spotlight', accent: '#14b8a6', bg: '#134e4a', body: 'Feature one main product with benefits and CTA.', soft: '#ccfbf1', layout: 'product' }),
    thumbUrl: makeThemeThumb('Product Spotlight', '#14b8a6', '#134e4a', '#ccfbf1'),
  },
  {
    id: 'preset-listicle',
    name: 'Listicle Offer',
    type: 'preset',
    preset: 'listicle-offer',
    html: buildPreviewHtml({ title: 'Listicle Offer', accent: '#f59e0b', bg: '#78350f', body: 'A content-first pitch layout with points, takeaways, and a CTA.', soft: '#fef3c7', layout: 'minimal' }),
    thumbUrl: makeThemeThumb('Listicle', '#f59e0b', '#78350f', '#fef3c7'),
  },
  {
    id: 'preset-event',
    name: 'Event Invite',
    type: 'preset',
    preset: 'event-invite',
    html: buildPreviewHtml({ title: 'Event Invite', accent: '#7c3aed', bg: '#4c1d95', body: 'Perfect for workshops, launches, and live events.', soft: '#ede9fe', layout: 'invitation' }),
    thumbUrl: makeThemeThumb('Event Invite', '#7c3aed', '#4c1d95', '#ede9fe'),
  },
  {
    id: 'preset-announcement',
    name: 'Clean Announcement',
    type: 'preset',
    preset: 'announcement',
    html: buildPreviewHtml({ title: 'Clean Announcement', accent: '#2563eb', bg: '#1d4ed8', body: 'Simple modern alert or company update layout.', soft: '#dbeafe', layout: 'minimal' }),
    thumbUrl: makeThemeThumb('Announcement', '#2563eb', '#1d4ed8', '#dbeafe'),
  },
  {
    id: 'preset-lookbook',
    name: 'Luxury Lookbook',
    type: 'preset',
    preset: 'luxury-lookbook',
    html: buildPreviewHtml({ title: 'Luxury Lookbook', accent: '#b45309', bg: '#111827', body: 'Showcase multiple featured items in a premium style.', soft: '#fef3c7', layout: 'gallery' }),
    thumbUrl: makeThemeThumb('Lookbook', '#b45309', '#111827', '#fef3c7'),
  },
  {
    id: 'preset-webinar',
    name: 'Webinar Registration',
    type: 'preset',
    preset: 'webinar-registration',
    html: buildPreviewHtml({ title: 'Webinar Registration', accent: '#8b5cf6', bg: '#312e81', body: 'Built for expert sessions, coaching calls, and demos.', soft: '#ede9fe', layout: 'invitation' }),
    thumbUrl: makeThemeThumb('Webinar', '#8b5cf6', '#312e81', '#ede9fe'),
  },
  {
    id: 'preset-wellness',
    name: 'Wellness Promo',
    type: 'preset',
    preset: 'wellness-promo',
    html: buildPreviewHtml({ title: 'Wellness Promo', accent: '#22c55e', bg: '#14532d', body: 'Great for beauty, health, and lifestyle offers.', soft: '#dcfce7', layout: 'hero' }),
    thumbUrl: makeThemeThumb('Wellness', '#22c55e', '#14532d', '#dcfce7'),
  },
  {
    id: 'preset-app',
    name: 'App Launch Update',
    type: 'preset',
    preset: 'app-launch',
    html: buildPreviewHtml({ title: 'App Launch Update', accent: '#06b6d4', bg: '#0f172a', body: 'A product update design for SaaS and feature releases.', soft: '#cffafe', layout: 'app' }),
    thumbUrl: makeThemeThumb('App Launch', '#06b6d4', '#0f172a', '#cffafe'),
  },
  {
    id: 'preset-summer',
    name: 'Tropical Summer Escape',
    type: 'preset',
    preset: 'summer-escape',
    html: buildPreviewHtml({ title: 'Tropical Summer Escape', accent: '#f59e0b', bg: '#155e75', body: 'A vibrant travel-style campaign packed with colour and visual space.', soft: '#ecfeff', layout: 'gallery' }),
    thumbUrl: photoThumb('summer'),
    tags: ['featured', 'photo'],
  },
  {
    id: 'preset-beauty-glow',
    name: 'Beauty Glow Collection',
    type: 'preset',
    preset: 'beauty-glow',
    html: buildPreviewHtml({ title: 'Beauty Glow Collection', accent: '#ec4899', bg: '#831843', body: 'Polished beauty campaign styling with soft colour and strong imagery.', soft: '#fce7f3', layout: 'hero' }),
    thumbUrl: photoThumb('beauty'),
    tags: ['featured', 'photo'],
  },
  {
    id: 'preset-food-festival',
    name: 'Food Festival Promo',
    type: 'preset',
    preset: 'food-festival',
    html: buildPreviewHtml({ title: 'Food Festival Promo', accent: '#f97316', bg: '#7c2d12', body: 'Warm, punchy email styling for menus, launches, and special events.', soft: '#fff7ed', layout: 'product' }),
    thumbUrl: photoThumb('food'),
    tags: ['featured', 'photo'],
  },
  {
    id: 'preset-property',
    name: 'Property Showcase Luxe',
    type: 'preset',
    preset: 'property-showcase',
    html: buildPreviewHtml({ title: 'Property Showcase Luxe', accent: '#8b5cf6', bg: '#111827', body: 'A premium image-led style for listings, interiors, and venue promos.', soft: '#ede9fe', layout: 'gallery' }),
    thumbUrl: photoThumb('property'),
    tags: ['featured', 'photo'],
  },
  {
    id: 'preset-fashion-flash',
    name: 'Fashion Flash Sale',
    type: 'preset',
    preset: 'fashion-flash',
    html: buildPreviewHtml({ title: 'Fashion Flash Sale', accent: '#ec4899', bg: '#111827', body: 'A bright style-led promo with bold visual energy and retail focus.', soft: '#fdf2f8', layout: 'hero' }),
    thumbUrl: photoThumb('fashion'),
    tags: ['featured', 'photo'],
  },
];

function TemplateCardPreview({ tpl }) {
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPreview() {
      try {
        if (tpl?.thumbUrl && ["base", "library", "sendgrid-design", "sendgrid-transactional", "sendgrid-single-send"].includes(String(tpl?.type || ""))) {
          if (alive) setPreviewHtml("");
          return;
        }

        let html = String(tpl?.html || "");

        if (!html && tpl?.type === "base" && tpl?.path) {
          const res = await fetch(`/api/templates/import?scope=public&path=${encodeURIComponent(tpl.path)}&name=${encodeURIComponent(tpl.name || "")}`);
          const json = await res.json().catch(() => null);
          html = String(json?.html || "");
        }

        if (!html && tpl?.path && tpl?.type !== "base") {
          const res = await fetch(`/api/email/get-saved-email?path=${encodeURIComponent(tpl.path)}`);
          html = await res.text();
        }

        if (!html && tpl?.htmlUrl) {
          const res = await fetch(`${tpl.htmlUrl}${String(tpl.htmlUrl).includes("?") ? "&" : "?"}v=${Date.now()}`);
          html = await res.text();
        }

        if (alive) setPreviewHtml(absolutizeTemplateAssets(String(html || ""), tpl));
      } catch {
        if (alive) setPreviewHtml("");
      }
    }

    loadPreview();
    return () => {
      alive = false;
    };
  }, [tpl]);

  if (String(tpl?.type || '') === 'preset' && (tpl?.thumbUrl || tpl?.thumb)) {
    return (
      <img
        src={tpl.thumbUrl || tpl.thumb}
        alt={tpl.name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          backgroundColor: "#f8fafc",
        }}
      />
    );
  }

  if (previewHtml) {
    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#fff" }}>
        <iframe
          title={`${tpl?.name || tpl?.id || "Email"} preview`}
          srcDoc={previewHtml}
          loading="lazy"
          sandbox="allow-same-origin"
          scrolling="no"
          style={{
            width: "320%",
            height: "320%",
            border: "none",
            background: "#fff",
            pointerEvents: "none",
            transform: "scale(0.3125)",
            transformOrigin: "top left",
          }}
        />
      </div>
    );
  }

  if (tpl?.thumbUrl || tpl?.thumb) {
    return (
      <img
        src={tpl.thumbUrl || tpl.thumb}
        alt={tpl.name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "top center",
          backgroundColor: "#f8fafc",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
        color: "#334155",
        fontWeight: 700,
        textAlign: "center",
        padding: 12,
      }}
    >
      {prettyTemplateName(tpl?.name || tpl?.id || "Email")}
    </div>
  );
}

export default function TemplateSelector() {
  const router = useRouter();
  const [savedEmails, setSavedEmails] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const featuredTemplates = templates.filter((tpl) => Array.isArray(tpl?.tags) && tpl.tags.includes('featured'));
  const libraryTemplates = templates.filter((tpl) => !(Array.isArray(tpl?.tags) && tpl.tags.includes('featured')));

  // DELETE MODAL STATE
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState(null);

  useEffect(() => {
    loadUserEmails();
    loadTemplates();
  }, []);

  // ===== LOAD ONLY THIS USER'S SAVED EMAILS =====
  async function loadUserEmails() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setSavedEmails([]);
        return;
      }

      const [docsRes, legacyRes] = await Promise.allSettled([
        fetch(`/api/email/builder-doc-list?userId=${encodeURIComponent(userId)}`),
        fetch(`/api/email/list-saved-emails?userId=${encodeURIComponent(userId)}`),
      ]);

      const docEmails = [];
      if (docsRes.status === "fulfilled") {
        const docsJson = await docsRes.value.json().catch(() => null);
        if (docsRes.value.ok && docsJson?.ok) {
          for (const doc of docsJson.docs || []) {
            docEmails.push({
              key: `doc:${doc.docId}`,
              id: doc.docId,
              docId: doc.docId,
              name: doc.name || "Untitled Email",
              html: "",
              htmlUrl: doc.htmlUrl || "",
              thumbUrl: doc.thumbUrl || "https://via.placeholder.com/260x260/0c121a/FFFFFF?text=Saved+Email",
              type: "doc",
              updatedAt: doc.updatedAt || doc.createdAt || "",
            });
          }
        }
      }

      const legacyEmails = [];
      if (legacyRes.status === "fulfilled") {
        const legacyJson = await legacyRes.value.json().catch(() => null);
        if (legacyRes.value.ok && legacyJson?.ok) {
          for (const file of legacyJson.files || []) {
            const path = String(file?.path || file?.id || "");
            const base = path.split("/").pop().replace(/\.html$/i, "");
            const pngPath = path.replace(/\.html$/i, ".png");
            legacyEmails.push({
              key: `legacy:${path}`,
              id: base,
              name: file?.name || base,
              html: "",
              path,
              pngPath,
              thumbUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-user-assets/${pngPath}?v=${Date.now()}`,
              type: "legacy",
            });
          }
        }
      }

      const combined = [...docEmails, ...legacyEmails];
      combined.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || String(a.name).localeCompare(String(b.name)));
      setSavedEmails(combined);
    } catch (e) {
      console.error(e);
      setSavedEmails([]);
    } finally {
      setLoadingEmails(false);
    }
  }

  // ===== LOAD EDITABLE TEMPLATE LIBRARY =====
  async function loadTemplates() {
    try {
      const deduped = [];
      const seen = new Set();

      for (const item of EDITABLE_TEMPLATE_LIBRARY) {
        const cleanName = prettyTemplateName(String(item.name || item.id || 'Template'));
        const key = normalizeTemplateKey(cleanName || item.id);
        if (seen.has(key)) continue;
        seen.add(key);

        deduped.push({
          ...item,
          name: cleanName,
          type: 'preset',
          tags: Array.isArray(item.tags) ? item.tags : ['editable'],
        });
      }

      setTemplates(deduped);
    } catch (e) {
      console.error(e);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }

  function extractBodyHtml(html) {
    const safe = String(html || "").trim();
    if (!safe) return "";
    const match = safe.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return (match?.[1] || safe).trim();
  }

  // ===== Convert imported HTML into the live editor block format =====
  function htmlToBlocks(html) {
    const bodyHtml = extractBodyHtml(html);
    if (!bodyHtml) return [];

    return [
      {
        id: `text_${Date.now().toString(16)}`,
        type: "text",
        props: {
          html: bodyHtml,
          bgColor: "#ffffff",
          textColor: "#1e293b",
          fontSize: 18,
          align: "left",
        },
      },
    ];
  }

  async function saveBlocksToDocument(docId, name, blocks, html = "") {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || "";

    if (!userId) throw new Error("Please sign in first.");

    const r = await fetch("/api/email/builder-doc-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        docId,
        name: name || "Imported Email",
        blocks,
        html,
      }),
    });
    const j = await r.json();
    if (!j?.ok) throw new Error(j?.detail || j?.error || "Save failed");
    return j;
  }

  // ===== OPEN EDITOR WITH CHOSEN TEMPLATE / SAVED EMAIL =====
  async function useTemplate(tpl) {
    try {
      if (["blank", "single", "two", "three"].includes(String(tpl.id))) {
        router.push(
          `/modules/email/editor?starter=${encodeURIComponent(String(tpl.id))}&templateName=${encodeURIComponent(tpl.name || "Email Template")}`
        );
        return;
      }

      if (tpl.type === "preset" && tpl.preset) {
        router.push(
          `/modules/email/editor?preset=${encodeURIComponent(String(tpl.preset))}&templateName=${encodeURIComponent(tpl.name || "Email Template")}`
        );
        return;
      }

      // Existing saved builder doc: open directly
      if (tpl.type === "doc" && tpl.docId) {
        router.push(`/modules/email/editor?id=${encodeURIComponent(tpl.docId)}`);
        return;
      }

      // Open templates in place without creating a duplicate saved email
      if (tpl.path) {
        const scope = tpl.type === "base" ? "public" : "user";
        router.push(
          `/modules/email/editor?templateScope=${encodeURIComponent(scope)}&templatePath=${encodeURIComponent(tpl.path)}&templateName=${encodeURIComponent(tpl.name || "Template")}`
        );
        return;
      }

      if (tpl.htmlUrl) {
        router.push(
          `/modules/email/editor?templateUrl=${encodeURIComponent(tpl.htmlUrl)}&templateName=${encodeURIComponent(tpl.name || "Template")}`
        );
        return;
      }

      throw new Error("This template cannot be opened.");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Could not open template");
    }
  }

  // ===== PREVIEW IN NEW WINDOW =====
  async function previewTemplate(tpl) {
    try {
      let html = tpl.html || "";

      if (!html && tpl.type === "base" && tpl.path) {
        const res = await fetch(`/api/templates/import?scope=public&path=${encodeURIComponent(tpl.path)}&name=${encodeURIComponent(tpl.name || "")}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Could not preview template");
        }
        html = String(json?.html || "");
      }

      if (!html && tpl.path && tpl.type !== "base") {
        const res = await fetch(`/api/email/get-saved-email?path=${encodeURIComponent(tpl.path)}`);
        html = await res.text();
      }

      if (!html && tpl.htmlUrl) {
        const res = await fetch(`${tpl.htmlUrl}${String(tpl.htmlUrl).includes("?") ? "&" : "?"}v=${Date.now()}`);
        html = await res.text();
      }

      const w = window.open("", "_blank", "width=900,height=700");
      w.document.write(html || "<p>No preview available</p>");
      w.document.close();
    } catch (e) {
      console.error(e);
      alert("Could not preview template");
    }
  }

  // ===== OPEN DELETE MODAL =====
  function openDeleteModal(tpl) {
    setEmailToDelete(tpl);
    setShowDeleteModal(true);
  }

  // ===== CONFIRM DELETE (HTML + PNG) =====
  async function handleConfirmDelete() {
    if (!emailToDelete) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      if (emailToDelete.type === "doc" && emailToDelete.docId) {
        const res = await fetch("/api/email/builder-doc-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, docId: emailToDelete.docId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.detail || json?.error || "Could not delete email");
        }
      } else {
        const htmlPath = emailToDelete.path || `${userId}/finished-emails/${emailToDelete.id}.html`;
        const pngPath = emailToDelete.pngPath || htmlPath.replace(/\.html$/i, ".png");

        await supabase.storage
          .from("email-user-assets")
          .remove([htmlPath, pngPath]);
      }

      setSavedEmails((prev) => prev.filter((e) => (e.key || e.id) !== (emailToDelete.key || emailToDelete.id)));

      setShowDeleteModal(false);
      setEmailToDelete(null);
    } catch (e) {
      console.error(e);
      alert("Could not delete email");
    }
  }

  // ===== CANCEL DELETE =====
  function handleCancelDelete() {
    setShowDeleteModal(false);
    setEmailToDelete(null);
  }

  return (
    <>
      <Head>
        <title>Select Template - GR8 RESULT</title>
      </Head>

      <main className={s.wrap}>
        <div className={s.inner}>
          <div className={s.banner}>
            <div className={s.bannerLeft}>
              <span className={s.bannerIcon}>📧</span>
              <div className={s.bannerText}>
                <h1 className={s.bannerTitle}>Select a Template</h1>
                <p className={s.bannerDesc}>
                  Start a new email, reopen saved ones, or choose a fully editable ready-made design.
                </p>
              </div>
            </div>
            <Link href="/modules/email/broadcast" className={s.btnBack}>
              ⬅ Back
            </Link>
          </div>

          {/* BLANK STARTER TEMPLATES */}
          <h2 className={s.sectionTitle}>Start a New Email</h2>

          <section className={s.grid}>
            {[
              {
                id: "blank",
                name: "Blank Template",
                thumb: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/blank/blank.jpg`,
                htmlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/blank/base.html`,
              },
              {
                id: "single",
                name: "Single Column Layout",
                thumb: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/single-column/single.jpg`,
                htmlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/single-column/base.html`,
              },
              {
                id: "two",
                name: "Two Column Layout",
                thumb: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/two-column/2 col.jpg`,
                htmlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/two-column/base.html`,
              },
              {
                id: "three",
                name: "Three Column Layout",
                thumb: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/three-column/3 col.jpg`,
                htmlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/three-column/base.html`,
              },
            ].map((b) => (
              <div key={b.id} className={s.card}>
                <div className={s.thumb}>
                  <div className={s.previewWrapper}>
                    <TemplateCardPreview tpl={b} />
                  </div>
                  <div className={s.overlay}>
                    <button onClick={() => useTemplate(b)}>Use</button>
                    <button onClick={() => previewTemplate(b)}>Preview</button>
                  </div>
                </div>
                <div className={s.templateName}>{b.name}</div>
              </div>
            ))}
          </section>

          <hr className={s.divider} />

          {/* MY SAVED EMAILS */}
          <h2 className={s.sectionTitle}>My Saved Emails</h2>

          {loadingEmails ? (
            <p className={s.statusText}>Loading emails...</p>
          ) : savedEmails.length === 0 ? (
            <p className={s.statusText}>No saved emails yet.</p>
          ) : (
            <section className={s.grid}>
              {savedEmails.map((tpl) => (
                <div key={tpl.key || tpl.id} className={s.card}>
                  <div className={s.thumb}>
                    <div className={s.previewWrapper}>
                      <TemplateCardPreview tpl={tpl} />
                    </div>
                    <div className={s.overlay}>
                      <button onClick={() => useTemplate(tpl)}>Use</button>
                      <button onClick={() => previewTemplate(tpl)}>Preview</button>
                      <button onClick={() => openDeleteModal(tpl)}>Delete 🗑</button>
                    </div>
                  </div>
                  <div className={s.templateName}>{tpl.name}</div>
                </div>
              ))}
            </section>
          )}

          <hr className={s.divider} />

          {featuredTemplates.length > 0 && (
            <>
              <h2 className={s.sectionTitle}>Beautiful Marketing Themes</h2>
              <section className={s.grid}>
                {featuredTemplates.map((tpl) => (
                  <div key={tpl.id} className={s.card}>
                    <div className={s.thumb}>
                      <div className={s.previewWrapper}>
                        <TemplateCardPreview tpl={tpl} />
                      </div>
                      <div className={s.overlay}>
                        <button onClick={() => useTemplate(tpl)}>Use</button>
                        <button onClick={() => previewTemplate(tpl)}>Preview</button>
                      </div>
                    </div>
                    <div className={s.templateName}>{tpl.name}</div>
                  </div>
                ))}
              </section>
              <hr className={s.divider} />
            </>
          )}

          {/* TEMPLATE LIBRARY */}
          <h2 className={s.sectionTitle}>Template Library</h2>

          {loadingTemplates ? (
            <p className={s.statusText}>Loading templates...</p>
          ) : libraryTemplates.length === 0 ? (
            <p className={s.statusText}>No templates available.</p>
          ) : (
            <section className={s.grid}>
              {libraryTemplates.map((tpl) => (
                <div key={tpl.id} className={s.card}>
                  <div className={s.thumb}>
                    <div className={s.previewWrapper}>
                      <TemplateCardPreview tpl={tpl} />
                    </div>
                    <div className={s.overlay}>
                      <button onClick={() => useTemplate(tpl)}>Use</button>
                      <button onClick={() => previewTemplate(tpl)}>Preview</button>
                    </div>
                  </div>
                  <div className={s.templateName}>{tpl.name}</div>
                </div>
              ))}
            </section>
          )}

        </div>

        {/* DELETE MODAL */}
        {showDeleteModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                background: "#111827",
                borderRadius: 12,
                padding: 24,
                border: "1px solid #4b5563",
                boxShadow: "0 10px 40px rgba(0,0,0,0.7)",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 10,
                  color: "#f97316",
                  fontSize: 20,
                  textAlign: "center",
                }}
              >
                Delete Template
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#e5e7eb",
                  textAlign: "center",
                  marginBottom: 20,
                }}
              >
                Are you sure you want to permanently delete{" "}
                <strong>{emailToDelete?.name}</strong>?<br />
                This action cannot be undone.
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 12,
                  marginTop: 10,
                }}
              >
                <button
                  onClick={handleCancelDelete}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #6b7280",
                    background: "#374151",
                    color: "#e5e7eb",
                    fontWeight: 600,
                    cursor: "pointer",
                    minWidth: 110,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "#ef4444",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    minWidth: 140,
                  }}
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        /* styles moved to select.module.css */
      `}</style>
    </>
  );
}
