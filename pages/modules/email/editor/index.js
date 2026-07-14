import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { supabase } from '../../../../utils/supabase-client';
import { emailEditorFetch } from '../../../../components/email/editor2/emailEditorApi';

// Heavy editor — code-split so the bundle only downloads when this page is visited
const EmailEditor = dynamic(
  () => import('../../../../components/email/editor2/EmailEditor'),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading editor…</div> }
);

function blockId(prefix = 'blk') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function makeTextBlock(html, overrides = {}) {
  return {
    id: blockId('text'),
    type: 'text',
    props: {
      html,
      bgColor: '#ffffff',
      textColor: '#1e293b',
      fontSize: 18,
      align: 'left',
      fontFamily: 'Arial, Helvetica, sans-serif',
      rawHtml: false,
      ...overrides,
    },
  };
}

function extractStyleValue(styleText = '', property = '') {
  const match = String(styleText || '').match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'));
  return match ? match[1].trim() : '';
}

function extractNumber(value, fallback = 0) {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function getAssetBase(scope = 'public', path = '', url = '') {
  const directUrl = String(url || '').trim();
  if (directUrl) return directUrl.replace(/[^/]+(?:\?.*)?$/, '');

  const cleanPath = String(path || '').trim().replace(/^\/+/, '');
  if (!cleanPath || !process.env.NEXT_PUBLIC_SUPABASE_URL) return '';

  const bucket = String(scope || '').toLowerCase() === 'public' ? 'email-assets' : 'email-user-assets';
  const slashIndex = cleanPath.lastIndexOf('/');
  const dir = slashIndex >= 0 ? cleanPath.slice(0, slashIndex + 1) : '';
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${dir}`;
}

function resolveAssetUrl(value = '', assetBase = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(data:|mailto:|tel:|#)/i.test(raw) || raw.startsWith('{{') || raw.startsWith('{{{')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^https?:/i.test(raw)) return raw.replace(/^http:/i, 'https:');
  if (!assetBase) return raw;

  const cleanBase = String(assetBase).replace(/\/+$/, '');
  const cleanPath = raw.replace(/^\.\//, '').replace(/^\//, '');
  return `${cleanBase}/${cleanPath}`;
}

function rewriteAssetUrls(html = '', assetBase = '') {
  const input = String(html || '');
  if (!input || !assetBase) return input;

  return input
    .replace(/src=(['"])(?!data:|mailto:|tel:|#|\/\/|https?:|\{)([^'"]+)\1/gi, (_, quote, url) => `src=${quote}${resolveAssetUrl(url, assetBase)}${quote}`)
    .replace(/url\((['"]?)(?!data:|#|\/\/|https?:|\{)([^'")]+)\1\)/gi, (_, quote, url) => `url(${quote}${resolveAssetUrl(url, assetBase)}${quote})`);
}

function wrapLegacyRowHtml(rowHtml = '', headStyles = '', assetBase = '') {
  const wrapped = `<table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0"><tbody>${rowHtml}</tbody></table>`;
  return rewriteAssetUrls([headStyles, wrapped].filter(Boolean).join('\n').trim(), assetBase);
}

function getLegacyRowBlocks(doc, headStyles = '', assetBase = '') {
  const rows = Array.from(doc.querySelectorAll('tr')).filter((row) => {
    if (row.querySelector('tr')) return false;

    const textOnly = String(row.textContent || '').replace(/\s+/g, ' ').trim();
    const images = Array.from(row.querySelectorAll('img[src]')).filter((img) => !/spacer\.gif/i.test(String(img.getAttribute('src') || '')));
    const links = Array.from(row.querySelectorAll('a[href]'));
    const hasMeaningfulCell = Array.from(row.querySelectorAll('td, th')).some((cell) => {
      const style = String(cell.getAttribute('style') || '').toLowerCase();
      const bg = cell.getAttribute('bgcolor') || extractStyleValue(style, 'background-color');
      return !!String(bg || '').trim();
    });

    return !!textOnly || images.length > 0 || links.length > 0 || hasMeaningfulCell;
  });

  const seen = new Set();
  const blocks = [];

  for (const row of rows) {
    const rowHtml = wrapLegacyRowHtml(row.outerHTML || '', headStyles, assetBase);
    const textOnly = String(row.textContent || '').replace(/\s+/g, ' ').trim();
    const images = Array.from(row.querySelectorAll('img[src]')).filter((img) => !/spacer\.gif/i.test(String(img.getAttribute('src') || '')));
    const links = Array.from(row.querySelectorAll('a[href]'));
    const key = String(rowHtml || '').replace(/\s+/g, ' ').trim().toLowerCase();

    if (!rowHtml || seen.has(key)) continue;
    seen.add(key);

    if (links.length >= 2 && images.length >= 2) {
      const platforms = links.map((a) => {
        const href = a.getAttribute('href') || '#';
        const imgAlt = (a.querySelector('img')?.getAttribute('alt') || '').toLowerCase();
        const name = ['facebook', 'instagram', 'linkedin', 'youtube', 'pinterest', 'x'].find((item) => imgAlt.includes(item) || href.includes(item)) || 'facebook';
        return { name, href };
      });

      blocks.push({
        id: blockId('social'),
        type: 'social',
        props: {
          bgColor: row.querySelector('[bgcolor]')?.getAttribute('bgcolor') || extractStyleValue(row.getAttribute('style') || '', 'background-color') || '#eff6ff',
          platforms,
        },
      });
      continue;
    }

    if (images.length === 1 && textOnly.length <= 80) {
      const img = images[0];
      const td = img.closest('td');
      blocks.push({
        id: blockId('image'),
        type: 'image',
        props: {
          src: resolveAssetUrl(img.getAttribute('src') || '', assetBase),
          alt: img.getAttribute('alt') || 'Image',
          linkHref: img.closest('a[href]')?.getAttribute('href') || links[0]?.getAttribute('href') || '',
          align: td?.getAttribute('align') || extractStyleValue(td?.getAttribute('style') || '', 'text-align') || 'center',
          widthPct: Math.max(20, Math.min(100, extractNumber(img.getAttribute('width') || extractStyleValue(img.getAttribute('style') || '', 'width'), 100))),
          borderRadius: extractNumber(extractStyleValue(img.getAttribute('style') || '', 'border-radius'), 0),
        },
      });
      continue;
    }

    if (links.length === 1 && textOnly && textOnly.length <= 80 && /background-color|border-radius|display\s*:\s*inline-block|padding/i.test(row.innerHTML || '')) {
      const link = links[0];
      blocks.push({
        id: blockId('button'),
        type: 'button',
        props: {
          text: textOnly,
          href: link.getAttribute('href') || '#',
          bgColor: link.getAttribute('bgcolor') || extractStyleValue(link.getAttribute('style') || '', 'background-color') || extractStyleValue(row.innerHTML || '', 'background-color') || '#2563eb',
          textColor: extractStyleValue(link.getAttribute('style') || '', 'color') || '#ffffff',
          borderRadius: extractNumber(extractStyleValue(link.getAttribute('style') || '', 'border-radius') || extractStyleValue(row.innerHTML || '', 'border-radius'), 8),
          align: row.getAttribute('align') || extractStyleValue(row.getAttribute('style') || '', 'text-align') || 'center',
          widthMode: 'auto',
          widthPx: 220,
          paddingY: 12,
        },
      });
      continue;
    }

    blocks.push(makeTextBlock(rowHtml, {
      bgColor: row.querySelector('[bgcolor]')?.getAttribute('bgcolor') || extractStyleValue(row.getAttribute('style') || '', 'background-color') || '#ffffff',
      textColor: extractStyleValue(row.getAttribute('style') || '', 'color') || '#1e293b',
      fontSize: extractNumber(extractStyleValue(row.getAttribute('style') || '', 'font-size'), 18),
      align: row.getAttribute('align') || extractStyleValue(row.getAttribute('style') || '', 'text-align') || 'left',
      rawHtml: false,
    }));
  }

  return blocks;
}

function htmlToEditorBlocks(html, options = {}) {
  const safe = String(html || '').trim();
  const assetBase = String(options?.assetBase || '').trim();
  if (!safe) return [];

  const headStyles = Array.from(safe.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi))
    .map((match) => match[0])
    .join('\n');

  const bodyMatch = safe.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = (bodyMatch?.[1] || safe).trim();
  const combined = rewriteAssetUrls([headStyles, bodyHtml].filter(Boolean).join('\n').trim(), assetBase);

  if (!combined) return [];
  if (options?.preserveFullLayout) {
    return [
      makeTextBlock(combined, {
        bgColor: 'transparent',
        textColor: '#1e293b',
        rawHtml: false,
      }),
    ];
  }
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return [
      makeTextBlock(combined, {
        bgColor: 'transparent',
        textColor: '#1e293b',
        rawHtml: false,
      }),
    ];
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(safe, 'text/html');
    const modules = Array.from(doc.querySelectorAll('[data-type], [data-role="module-button"], [data-role="module-unsubscribe"], [role="module"]'));
    const blocks = [];
    const seen = new Set();

    for (const moduleEl of modules) {
      const className = String(moduleEl.getAttribute('class') || '').toLowerCase();
      let type = String(moduleEl.getAttribute('data-type') || moduleEl.getAttribute('data-role') || '').toLowerCase();

      if (!type) {
        const textOnly = String(moduleEl.textContent || '').replace(/\s+/g, ' ').trim();
        const imgCount = moduleEl.querySelectorAll('img[src]').length;
        const linkCount = moduleEl.querySelectorAll('a[href]').length;

        if (className.includes('preheader')) type = 'preheader';
        else if (linkCount >= 2 && imgCount >= 2) type = 'social';
        else if (imgCount >= 1 && textOnly.length <= 40) type = 'image';
        else if (linkCount >= 1 && /background-color|border-radius|bulletproof-button/i.test(moduleEl.innerHTML || '')) type = 'button';
        else type = 'text';
      }

      if (type === 'columns' || type === 'preheader' || className.includes('preheader-hide')) continue;

      if (type === 'image') {
        const img = moduleEl.querySelector('img[src]');
        if (!img) continue;
        const td = img.closest('td');
        blocks.push({
          id: blockId('image'),
          type: 'image',
          props: {
            src: resolveAssetUrl(img.getAttribute('src') || '', assetBase),
            alt: img.getAttribute('alt') || 'Image',
            linkHref: moduleEl.querySelector('a[href]')?.getAttribute('href') || '',
            align: td?.getAttribute('align') || extractStyleValue(td?.getAttribute('style') || '', 'text-align') || 'center',
            widthPct: Math.max(20, Math.min(100, extractNumber(img.getAttribute('width') || extractStyleValue(img.getAttribute('style') || '', 'width'), 100))),
            borderRadius: extractNumber(extractStyleValue(img.getAttribute('style') || '', 'border-radius'), 0),
          },
        });
        continue;
      }

      if (type === 'social') {
        const platforms = Array.from(moduleEl.querySelectorAll('a[href]')).map((a) => {
          const href = a.getAttribute('href') || '#';
          const imgAlt = (a.querySelector('img')?.getAttribute('alt') || '').toLowerCase();
          const name = ['facebook', 'instagram', 'linkedin', 'youtube', 'pinterest', 'x'].find((key) => imgAlt.includes(key) || href.includes(key)) || 'facebook';
          return { name, href };
        });
        if (platforms.length) {
          blocks.push({
            id: blockId('social'),
            type: 'social',
            props: {
              bgColor: extractStyleValue(moduleEl.getAttribute('style') || '', 'background-color') || '#eff6ff',
              platforms,
            },
          });
        }
        continue;
      }

      if (type === 'text' || type === 'unsubscribe') {
        const content = moduleEl.querySelector('[role="module-content"]') || moduleEl;
        const htmlFragment = rewriteAssetUrls(String(content.innerHTML || '').trim(), assetBase);
        const textOnly = String(content.textContent || '').replace(/\s+/g, ' ').trim();
        if (!htmlFragment || !textOnly) continue;

        const key = textOnly.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        blocks.push(makeTextBlock(htmlFragment, {
          bgColor: content.getAttribute('bgcolor') || extractStyleValue(content.getAttribute('style') || '', 'background-color') || '#ffffff',
          textColor: extractStyleValue(content.getAttribute('style') || '', 'color') || '#1e293b',
          fontSize: extractNumber(extractStyleValue(content.getAttribute('style') || '', 'font-size'), 18),
          align: extractStyleValue(content.getAttribute('style') || '', 'text-align') || 'left',
          rawHtml: false,
        }));
      }
    }

    if (blocks.length) return blocks;

    const legacyBlocks = getLegacyRowBlocks(doc, headStyles, assetBase);
    if (legacyBlocks.length) return legacyBlocks;
  } catch {
    // fall through to raw HTML fallback
  }

  return [
    makeTextBlock(combined, {
      bgColor: 'transparent',
      textColor: '#1e293b',
      rawHtml: false,
    }),
  ];
}

function makeThemeArt(title, accent = '#2563eb', bg = '#0f172a', soft = '#eff6ff') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${soft}"/>
          <stop offset="100%" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="700" rx="36" fill="url(#g)"/>
      <rect x="60" y="60" width="320" height="18" rx="9" fill="#ffffffaa"/>
      <rect x="60" y="102" width="520" height="72" rx="16" fill="#ffffff"/>
      <rect x="60" y="198" width="440" height="18" rx="9" fill="#ffffffcc"/>
      <rect x="60" y="236" width="340" height="18" rx="9" fill="#ffffff99"/>
      <rect x="60" y="300" width="190" height="56" rx="28" fill="${bg}" opacity="0.82"/>
      <circle cx="960" cy="180" r="120" fill="#ffffff22"/>
      <circle cx="1050" cy="120" r="62" fill="#ffffff30"/>
      <rect x="720" y="270" width="340" height="220" rx="30" fill="#ffffffbb"/>
      <rect x="760" y="315" width="260" height="18" rx="9" fill="${bg}" opacity="0.7"/>
      <rect x="760" y="350" width="220" height="14" rx="7" fill="#334155" opacity="0.3"/>
      <rect x="760" y="378" width="190" height="14" rx="7" fill="#334155" opacity="0.2"/>
      <text x="60" y="148" font-size="44" font-weight="700" font-family="Arial, Helvetica, sans-serif" fill="#0f172a">${String(title).replace(/&/g, '&amp;')}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function makeStockPhoto(theme = 'lifestyle', width = 1200) {
  const photos = {
    summer: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=' + width + '&q=80',
    beach: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=' + width + '&q=80',
    travel: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=' + width + '&q=80',
    fashion: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=' + width + '&q=80',
    beauty: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=' + width + '&q=80',
    skincare: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=' + width + '&q=80',
    food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=' + width + '&q=80',
    brunch: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=' + width + '&q=80',
    property: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=' + width + '&q=80',
    interior: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=' + width + '&q=80',
    luxury: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=' + width + '&q=80',
    wellness: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=' + width + '&q=80',
    app: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=' + width + '&q=80',
    event: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=' + width + '&q=80',
  };

  return photos[theme] || photos.luxury;
}

function presetBlock(type, props = {}) {
  return {
    id: blockId(type),
    type,
    props,
  };
}

function getPresetBlocks(preset, name = 'Email Template') {
  const footer = presetBlock('footer', {
    company: 'Your Company',
    address: '123 Street, City, Country',
    unsubscribeHref: '#',
    bgColor: '#f1f5f9',
    textColor: '#64748b',
  });

  switch (String(preset || '').toLowerCase()) {
    case 'black-friday':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Black Friday Campaign',
          subtitle: 'Big seasonal promotion with space for your hero image and offers.',
          bgColor: '#09090b',
          textColor: '#ffffff',
        }),
        presetBlock('hero', {
          imageSrc: makeThemeArt('Black Friday', '#f97316', '#111827', '#fff7ed'),
          headline: 'BLACK FRIDAY • Up to 50% Off',
          subtext: 'Add your headline offer here and click the hero image area to upload your own artwork.',
          ctaText: 'Shop The Sale',
          ctaHref: '#',
          bgColor: '#111827',
          textColor: '#ffffff',
          ctaBgColor: '#f97316',
          ctaTextColor: '#111827',
          paddingY: 40,
        }),
        presetBlock('grid', {
          bgColor: '#ffffff',
          columns: [
            { imageSrc: makeThemeArt('Top Deal', '#fb923c', '#111827', '#fff7ed'), title: 'Top Deal', text: 'Feature your hero offer or best-selling product.', linkHref: '#' },
            { imageSrc: makeThemeArt('Bonus Offer', '#f59e0b', '#7c2d12', '#ffedd5'), title: 'Bonus Offer', text: 'Add a second discount, gift, or urgency message.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Claim Your Discount',
          href: '#',
          bgColor: '#f97316',
          textColor: '#111827',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 220,
          paddingY: 12,
        }),
        footer,
      ];

    case 'newsletter':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Newsletter',
          subtitle: 'Share updates, content, and featured stories.',
          bgColor: '#0f172a',
          textColor: '#ffffff',
        }),
        presetBlock('text', {
          html: '<h2>This week\'s update</h2><p>Use this section for your intro paragraph and key message.</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('list', {
          bgColor: '#ffffff',
          items: [
            { imageSrc: makeThemeArt('Story One', '#2563eb', '#0f172a', '#dbeafe'), title: 'Story One', text: 'Add your first article or update here.', linkHref: '#' },
            { imageSrc: makeThemeArt('Story Two', '#0ea5e9', '#082f49', '#e0f2fe'), title: 'Story Two', text: 'Add your second update with a clear CTA.', linkHref: '#' },
          ],
        }),
        presetBlock('social', {
          bgColor: '#eff6ff',
          platforms: [
            { name: 'facebook', href: 'https://facebook.com/' },
            { name: 'instagram', href: 'https://instagram.com/' },
            { name: 'linkedin', href: 'https://linkedin.com/' },
          ],
        }),
        footer,
      ];

    case 'product-spotlight':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Product Spotlight',
          subtitle: 'Perfect for showcasing one main product or service.',
          bgColor: '#134e4a',
          textColor: '#ffffff',
        }),
        presetBlock('image', {
          src: makeThemeArt('Feature Product', '#14b8a6', '#134e4a', '#ccfbf1'),
          alt: 'Featured product',
          linkHref: '#',
          align: 'center',
          widthPct: 100,
          borderRadius: 8,
        }),
        presetBlock('text', {
          html: '<h2>Feature your main offer</h2><p>Add persuasive copy, benefits, and proof points here.</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('button', {
          text: 'Learn More',
          href: '#',
          bgColor: '#14b8a6',
          textColor: '#ffffff',
          borderRadius: 8,
          align: 'center',
          widthMode: 'auto',
          widthPx: 200,
          paddingY: 12,
        }),
        footer,
      ];

    case 'event-invite':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Event Invite',
          subtitle: 'Invite contacts to a webinar, launch, or live event.',
          bgColor: '#4c1d95',
          textColor: '#ffffff',
        }),
        presetBlock('hero', {
          imageSrc: makeThemeArt('You\'re Invited', '#7c3aed', '#4c1d95', '#ede9fe'),
          headline: 'You\'re Invited',
          subtext: 'Add your date, time, and event details here with a clear RSVP call to action.',
          ctaText: 'Reserve My Spot',
          ctaHref: '#',
          bgColor: '#ede9fe',
          textColor: '#312e81',
          ctaBgColor: '#7c3aed',
          ctaTextColor: '#ffffff',
          paddingY: 36,
        }),
        presetBlock('text', {
          html: '<p><strong>Date:</strong> Add your event date<br/><strong>Time:</strong> Add your start time<br/><strong>Location:</strong> Online or in-person</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        footer,
      ];

    case 'announcement':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Announcement',
          subtitle: 'Great for launches, alerts, and company news.',
          bgColor: '#1d4ed8',
          textColor: '#ffffff',
        }),
        presetBlock('text', {
          html: '<h2>Big news headline</h2><p>Share the important update here in a clear, simple layout.</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('divider', {
          color: '#dbeafe',
          thickness: 2,
          style: 'solid',
          widthPct: 86,
        }),
        presetBlock('button', {
          text: 'Read More',
          href: '#',
          bgColor: '#2563eb',
          textColor: '#ffffff',
          borderRadius: 8,
          align: 'center',
          widthMode: 'auto',
          widthPx: 190,
          paddingY: 12,
        }),
        footer,
      ];

    case 'bundle-sale':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Bundle Deal Promo',
          subtitle: 'Stack multiple products or tiers into one high-value offer.',
          bgColor: '#082f49',
          textColor: '#e0f2fe',
        }),
        presetBlock('grid', {
          bgColor: '#e0f2fe',
          columns: [
            { imageSrc: makeThemeArt('Bundle One', '#0ea5e9', '#082f49', '#e0f2fe'), title: 'Bundle Item 1', text: 'Add the first included product or bonus.', linkHref: '#' },
            { imageSrc: makeThemeArt('Bundle Two', '#38bdf8', '#164e63', '#e0f2fe'), title: 'Bundle Item 2', text: 'Use this for the second included product.', linkHref: '#' },
            { imageSrc: makeThemeArt('Bundle Three', '#7dd3fc', '#0c4a6e', '#f0f9ff'), title: 'Bundle Item 3', text: 'Highlight the final piece of the offer.', linkHref: '#' },
          ],
        }),
        presetBlock('text', {
          html: '<h2>Why this bundle converts</h2><p>Use this section for stacked value, savings, and urgency.</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('button', {
          text: 'Get The Bundle',
          href: '#',
          bgColor: '#0ea5e9',
          textColor: '#082f49',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 210,
          paddingY: 12,
        }),
        footer,
      ];

    case 'quiz-recommendation':
      return [
        presetBlock('hero', {
          imageSrc: makeThemeArt('Quiz Results', '#8b5cf6', '#312e81', '#ede9fe'),
          headline: 'Your Best Match Is Ready',
          subtext: 'Perfect for quiz outcomes, recommendation emails, and personalized next steps.',
          ctaText: 'See My Results',
          ctaHref: '#',
          bgColor: '#312e81',
          textColor: '#ffffff',
          ctaBgColor: '#8b5cf6',
          ctaTextColor: '#ffffff',
          paddingY: 36,
        }),
        presetBlock('list', {
          bgColor: '#ffffff',
          items: [
            { imageSrc: makeThemeArt('Recommended', '#8b5cf6', '#312e81', '#ede9fe'), title: 'Recommended Option', text: 'Explain the top recommendation for the lead.', linkHref: '#' },
            { imageSrc: makeThemeArt('Why It Fits', '#a855f7', '#581c87', '#f3e8ff'), title: 'Why It Fits', text: 'Add the reasoning or personalized benefits here.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Start My Plan',
          href: '#',
          bgColor: '#8b5cf6',
          textColor: '#ffffff',
          borderRadius: 999,
          align: 'center',
          widthMode: 'auto',
          widthPx: 200,
          paddingY: 12,
        }),
        footer,
      ];

    case 'cart-recovery':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Cart Recovery Reminder',
          subtitle: 'Bring customers back to complete their purchase.',
          bgColor: '#7f1d1d',
          textColor: '#ffffff',
        }),
        presetBlock('image', {
          src: makeThemeArt('Complete Your Order', '#ef4444', '#7f1d1d', '#fee2e2'),
          alt: 'Saved cart product',
          linkHref: '#',
          align: 'center',
          widthPct: 100,
          borderRadius: 10,
        }),
        presetBlock('text', {
          html: '<h2>You left something behind</h2><p>Use this area for urgency, reminders, and an optional incentive.</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('button', {
          text: 'Return To Cart',
          href: '#',
          bgColor: '#ef4444',
          textColor: '#ffffff',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 210,
          paddingY: 12,
        }),
        footer,
      ];

    case 'customer-stories':
      return [
        presetBlock('text', {
          html: '<h2>Real customer results</h2><p>Use a story-led intro here to pull readers into the proof.</p>',
          bgColor: '#fff1f2',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('list', {
          bgColor: '#ffffff',
          items: [
            { imageSrc: makeThemeArt('Story One', '#ec4899', '#831843', '#fce7f3'), title: 'Story One', text: 'Add a concise customer win or testimonial here.', linkHref: '#' },
            { imageSrc: makeThemeArt('Story Two', '#db2777', '#9d174d', '#fce7f3'), title: 'Story Two', text: 'Use another proof point with a small image if needed.', linkHref: '#' },
            { imageSrc: makeThemeArt('Story Three', '#f472b6', '#831843', '#fdf2f8'), title: 'Story Three', text: 'Finish with one more outcome-focused example.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'See More Results',
          href: '#',
          bgColor: '#ec4899',
          textColor: '#ffffff',
          borderRadius: 999,
          align: 'center',
          widthMode: 'auto',
          widthPx: 210,
          paddingY: 12,
        }),
        footer,
      ];

    case 'listicle-offer':
      return [
        presetBlock('text', {
          html: '<h2>7 reasons this works</h2><p>Use a listicle-style intro to educate and build desire before the CTA.</p>',
          bgColor: '#fffbeb',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('divider', {
          color: '#f59e0b',
          thickness: 2,
          style: 'dashed',
          widthPct: 80,
        }),
        presetBlock('grid', {
          bgColor: '#ffffff',
          columns: [
            { imageSrc: makeThemeArt('Reason 1', '#f59e0b', '#78350f', '#fef3c7'), title: 'Reason 1', text: 'Add a compelling point here.', linkHref: '#' },
            { imageSrc: makeThemeArt('Reason 2', '#fbbf24', '#92400e', '#fef3c7'), title: 'Reason 2', text: 'Use this area for another benefit or proof point.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Read The Full Story',
          href: '#',
          bgColor: '#f59e0b',
          textColor: '#111827',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 220,
          paddingY: 12,
        }),
        footer,
      ];

    case 'luxury-lookbook':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Luxury Lookbook',
          subtitle: 'A premium showcase for curated collections and featured items.',
          bgColor: '#111827',
          textColor: '#f8fafc',
        }),
        presetBlock('image', {
          src: makeThemeArt('Collection Edit', '#b45309', '#111827', '#fef3c7'),
          alt: 'Lookbook hero',
          linkHref: '#',
          align: 'center',
          widthPct: 100,
          borderRadius: 12,
        }),
        presetBlock('grid', {
          bgColor: '#fffbeb',
          columns: [
            { imageSrc: makeThemeArt('Collection One', '#b45309', '#111827', '#fef3c7'), title: 'Collection One', text: 'Highlight a premium product or category.', linkHref: '#' },
            { imageSrc: makeThemeArt('Collection Two', '#92400e', '#1f2937', '#fef3c7'), title: 'Collection Two', text: 'Use this for another featured item.', linkHref: '#' },
            { imageSrc: makeThemeArt('Collection Three', '#d97706', '#111827', '#fff7ed'), title: 'Collection Three', text: 'Add a third luxury feature here.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Browse Collection',
          href: '#',
          bgColor: '#b45309',
          textColor: '#ffffff',
          borderRadius: 999,
          align: 'center',
          widthMode: 'auto',
          widthPx: 220,
          paddingY: 12,
        }),
        footer,
      ];

    case 'webinar-registration':
      return [
        presetBlock('hero', {
          imageSrc: makeThemeArt('Live Training', '#8b5cf6', '#312e81', '#ede9fe'),
          headline: 'Join Our Live Training',
          subtext: 'Promote your webinar, demo, or masterclass with a clear registration flow.',
          ctaText: 'Register Free',
          ctaHref: '#',
          bgColor: '#312e81',
          textColor: '#ffffff',
          ctaBgColor: '#8b5cf6',
          ctaTextColor: '#ffffff',
          paddingY: 38,
        }),
        presetBlock('text', {
          html: '<p><strong>What attendees will learn:</strong></p><p>• Core strategy breakdown<br/>• Real examples and walkthroughs<br/>• Clear next steps and offer</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('list', {
          bgColor: '#ffffff',
          items: [
            { imageSrc: makeThemeArt('Expert Session', '#8b5cf6', '#312e81', '#ede9fe'), title: 'Expert Session', text: 'Add your speaker or host details here.', linkHref: '#' },
            { imageSrc: makeThemeArt('Live Q&A', '#a855f7', '#581c87', '#f3e8ff'), title: 'Live Q&A', text: 'Invite attendees to engage and ask questions.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Save My Seat',
          href: '#',
          bgColor: '#8b5cf6',
          textColor: '#ffffff',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 200,
          paddingY: 12,
        }),
        footer,
      ];

    case 'wellness-promo':
      return [
        presetBlock('hero', {
          imageSrc: makeThemeArt('Wellness Glow', '#22c55e', '#14532d', '#dcfce7'),
          headline: 'Feel Better, Look Brighter',
          subtext: 'A clean promo layout for health, beauty, skincare, and lifestyle products.',
          ctaText: 'See The Offer',
          ctaHref: '#',
          bgColor: '#14532d',
          textColor: '#ffffff',
          ctaBgColor: '#22c55e',
          ctaTextColor: '#052e16',
          paddingY: 38,
        }),
        presetBlock('text', {
          html: '<h2>Why customers love it</h2><p>Use this space for your product story, ingredients, or major benefits.</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }),
        presetBlock('list', {
          bgColor: '#f0fdf4',
          items: [
            { imageSrc: makeThemeArt('Natural Support', '#22c55e', '#14532d', '#dcfce7'), title: 'Natural Support', text: 'Highlight feature one or ingredient one.', linkHref: '#' },
            { imageSrc: makeThemeArt('Daily Results', '#16a34a', '#166534', '#f0fdf4'), title: 'Daily Results', text: 'Add another result-focused benefit here.', linkHref: '#' },
          ],
        }),
        presetBlock('social', {
          bgColor: '#dcfce7',
          platforms: [
            { name: 'instagram', href: 'https://instagram.com/' },
            { name: 'facebook', href: 'https://facebook.com/' },
            { name: 'youtube', href: 'https://youtube.com/' },
          ],
        }),
        footer,
      ];

    case 'app-launch':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'App Launch Update',
          subtitle: 'Share a product release, feature drop, or SaaS update.',
          bgColor: '#0f172a',
          textColor: '#ffffff',
        }),
        presetBlock('hero', {
          imageSrc: makeStockPhoto('app'),
          headline: 'Your New Favorite Feature Is Live',
          subtext: 'Use this for platform updates, changelogs, launches, and onboarding campaigns.',
          ctaText: 'Try It Now',
          ctaHref: '#',
          bgColor: '#082f49',
          textColor: '#e0f2fe',
          ctaBgColor: '#06b6d4',
          ctaTextColor: '#083344',
          paddingY: 34,
        }),
        presetBlock('grid', {
          bgColor: '#f8fafc',
          columns: [
            { imageSrc: makeStockPhoto('app', 900), title: 'Feature One', text: 'Explain the first improvement here.', linkHref: '#' },
            { imageSrc: makeThemeArt('Feature Two', '#0891b2', '#082f49', '#e0f2fe'), title: 'Feature Two', text: 'Add a second release note or benefit.', linkHref: '#' },
            { imageSrc: makeThemeArt('Feature Three', '#22d3ee', '#164e63', '#ecfeff'), title: 'Feature Three', text: 'Highlight one more reason to log in.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Open Dashboard',
          href: '#',
          bgColor: '#06b6d4',
          textColor: '#083344',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 210,
          paddingY: 12,
        }),
        footer,
      ];

    case 'summer-escape':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Tropical Summer Escape',
          subtitle: 'Bright, colourful, and image-heavy for travel or summer offers.',
          bgColor: '#0f172a',
          textColor: '#ffffff',
        }),
        presetBlock('hero', {
          imageSrc: makeStockPhoto('summer'),
          headline: 'Escape To Sun, Sea, And Special Offers',
          subtext: 'Use this vibrant layout for travel, holidays, seasonal sales, or resort promotions.',
          ctaText: 'Book The Escape',
          ctaHref: '#',
          bgColor: '#164e63',
          textColor: '#ecfeff',
          ctaBgColor: '#f59e0b',
          ctaTextColor: '#0f172a',
          paddingY: 40,
        }),
        presetBlock('grid', {
          bgColor: '#ffffff',
          columns: [
            { imageSrc: makeStockPhoto('beach', 900), title: 'Ocean View', text: 'Show a destination, room upgrade, or local experience.', linkHref: '#' },
            { imageSrc: makeStockPhoto('travel', 900), title: 'Adventure Deal', text: 'Add a second highlight with a strong visual hook.', linkHref: '#' },
            { imageSrc: makeThemeArt('Bonus Perks', '#06b6d4', '#155e75', '#cffafe'), title: 'Bonus Perks', text: 'Layer in extras like transfers, breakfast, or bonuses.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'See All Packages',
          href: '#',
          bgColor: '#f59e0b',
          textColor: '#0f172a',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 220,
          paddingY: 12,
        }),
        footer,
      ];

    case 'beauty-glow':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Beauty Glow Collection',
          subtitle: 'A polished beauty and lifestyle layout with bold imagery.',
          bgColor: '#831843',
          textColor: '#ffffff',
        }),
        presetBlock('hero', {
          imageSrc: makeStockPhoto('beauty'),
          headline: 'Glow Up With The New Collection',
          subtext: 'Perfect for skincare, cosmetics, wellness, or premium self-care campaigns.',
          ctaText: 'Shop The Range',
          ctaHref: '#',
          bgColor: '#be185d',
          textColor: '#fff1f2',
          ctaBgColor: '#f9a8d4',
          ctaTextColor: '#500724',
          paddingY: 40,
        }),
        presetBlock('list', {
          bgColor: '#fff1f2',
          items: [
            { imageSrc: makeStockPhoto('skincare', 900), title: 'Hydration Ritual', text: 'Feature a hero product, routine, or before-and-after story.', linkHref: '#' },
            { imageSrc: makeStockPhoto('luxury', 900), title: 'Premium Finish', text: 'Add a second benefit-led card with beautiful brand imagery.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Claim Your Glow',
          href: '#',
          bgColor: '#ec4899',
          textColor: '#ffffff',
          borderRadius: 12,
          align: 'center',
          widthMode: 'auto',
          widthPx: 220,
          paddingY: 12,
        }),
        footer,
      ];

    case 'food-festival':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Food Festival Promo',
          subtitle: 'Colourful foodie design for menus, events, or weekend specials.',
          bgColor: '#7c2d12',
          textColor: '#ffffff',
        }),
        presetBlock('image', {
          src: makeStockPhoto('food'),
          alt: 'Food highlight',
          align: 'center',
          widthPct: 100,
          borderRadius: 14,
        }),
        presetBlock('grid', {
          bgColor: '#fff7ed',
          columns: [
            { imageSrc: makeStockPhoto('brunch', 900), title: 'Weekend Brunch', text: 'Showcase your signature items, plates, or tasting menu.', linkHref: '#' },
            { imageSrc: makeStockPhoto('food', 900), title: 'Chef Special', text: 'Add a bright callout for a featured menu item or event.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Reserve A Table',
          href: '#',
          bgColor: '#f97316',
          textColor: '#ffffff',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 210,
          paddingY: 12,
        }),
        footer,
      ];

    case 'property-showcase':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Property Showcase Luxe',
          subtitle: 'Ideal for listings, venue promos, interiors, and real estate campaigns.',
          bgColor: '#111827',
          textColor: '#ffffff',
        }),
        presetBlock('hero', {
          imageSrc: makeStockPhoto('property'),
          headline: 'Step Inside A Space Worth Showing Off',
          subtext: 'A clean, premium template for property features, open homes, and venue campaigns.',
          ctaText: 'Book A Viewing',
          ctaHref: '#',
          bgColor: '#1f2937',
          textColor: '#f9fafb',
          ctaBgColor: '#c084fc',
          ctaTextColor: '#2e1065',
          paddingY: 38,
        }),
        presetBlock('grid', {
          bgColor: '#ffffff',
          columns: [
            { imageSrc: makeStockPhoto('interior', 900), title: 'Interior Detail', text: 'Highlight a room, feature wall, or premium finish.', linkHref: '#' },
            { imageSrc: makeStockPhoto('luxury', 900), title: 'Lifestyle Angle', text: 'Pair the main listing with a second image-rich detail card.', linkHref: '#' },
          ],
        }),
        presetBlock('button', {
          text: 'Request Details',
          href: '#',
          bgColor: '#8b5cf6',
          textColor: '#ffffff',
          borderRadius: 10,
          align: 'center',
          widthMode: 'auto',
          widthPx: 220,
          paddingY: 12,
        }),
        footer,
      ];

    case 'fashion-flash':
      return [
        presetBlock('header', {
          logoSrc: '',
          title: name || 'Fashion Flash Sale',
          subtitle: 'Fast-moving promo layout with style-led visuals and colour.',
          bgColor: '#111827',
          textColor: '#ffffff',
        }),
        presetBlock('hero', {
          imageSrc: makeStockPhoto('fashion'),
          headline: 'Fresh Looks. Bright Colours. Limited-Time Drop.',
          subtext: 'Built for fashion launches, retail promos, and colourful lookbook campaigns.',
          ctaText: 'Shop New Arrivals',
          ctaHref: '#',
          bgColor: '#1f2937',
          textColor: '#fdf2f8',
          ctaBgColor: '#ec4899',
          ctaTextColor: '#ffffff',
          paddingY: 40,
        }),
        presetBlock('list', {
          bgColor: '#fdf2f8',
          items: [
            { imageSrc: makeStockPhoto('fashion', 900), title: 'Statement Piece', text: 'Show the hero product or featured collection.', linkHref: '#' },
            { imageSrc: makeStockPhoto('luxury', 900), title: 'Styled For Impact', text: 'Add another visual card for accessories or bundles.', linkHref: '#' },
          ],
        }),
        footer,
      ];

    default:
      return getStarterBlocks('single', name);
  }
}

function getLegacyPreset(templatePath = '', templateName = '') {
  const key = `${templatePath} ${templateName}`.toLowerCase();

  if (/(black\s*friday|friday|coupon|sale|promo|offer)/i.test(key)) return 'black-friday';
  if (/(bundle)/i.test(key)) return 'bundle-sale';
  if (/(quiz|assessment|survey result)/i.test(key)) return 'quiz-recommendation';
  if (/(cart|abandon)/i.test(key)) return 'cart-recovery';
  if (/(customer stories|testimonial|story)/i.test(key)) return 'customer-stories';
  if (/(listicle)/i.test(key)) return 'listicle-offer';
  if (/(newsletter|blog|digest|news|magazine)/i.test(key)) return 'newsletter';
  if (/(webinar|masterclass|training)/i.test(key)) return 'webinar-registration';
  if (/(event|invite|school)/i.test(key)) return 'event-invite';
  if (/(product|spotlight|upsell|shipped)/i.test(key)) return 'product-spotlight';
  if (/(lookbook|fashion|luxury|collection)/i.test(key)) return 'luxury-lookbook';
  if (/(green|skin|summer|reignite|welcome new features)/i.test(key)) return 'wellness-promo';
  if (/(app|feature|release|launch)/i.test(key)) return 'app-launch';
  if (/(welcome|announce|update|receipt|invoice|confirm|activation|survey|birthday)/i.test(key)) return 'announcement';

  return '';
}

function getStarterBlocks(starter, name = 'Email Template') {
  const footer = {
    id: 'footer_' + Date.now().toString(36),
    type: 'footer',
    props: {
      company: 'Your Company',
      address: '123 Street, City, Country',
      unsubscribeHref: '#',
      bgColor: '#f1f5f9',
      textColor: '#64748b',
    },
  };

  const header = {
    id: 'header_' + Date.now().toString(36),
    type: 'header',
    props: {
      logoSrc: '',
      title: name,
      subtitle: 'Edit this starter layout with the tools on the left.',
      bgColor: '#0f766e',
      textColor: '#ffffff',
    },
  };

  const button = {
    id: 'button_' + Date.now().toString(36),
    type: 'button',
    props: {
      text: 'Call To Action',
      href: '#',
      bgColor: '#2563eb',
      textColor: '#ffffff',
      borderRadius: 8,
      align: 'center',
      widthMode: 'auto',
      widthPx: 200,
      paddingY: 12,
    },
  };

  if (starter === 'blank') return [];

  if (starter === 'single') {
    return [
      header,
      {
        id: 'text_' + Date.now().toString(36),
        type: 'text',
        props: {
          html: '<h2>Start writing here</h2><p>This single-column layout is ready for your content.</p>',
          bgColor: '#ffffff',
          textColor: '#1e293b',
          fontSize: 18,
          align: 'left',
          variant: 'body',
          fontFamily: 'Arial, Helvetica, sans-serif',
        },
      },
      button,
      footer,
    ];
  }

  const columns = starter === 'three'
    ? [
        { imageSrc: '', title: 'Column 1', text: 'Add your first offer or message here.', linkHref: '#' },
        { imageSrc: '', title: 'Column 2', text: 'Perfect for a second feature or product.', linkHref: '#' },
        { imageSrc: '', title: 'Column 3', text: 'Use this space for another highlight.', linkHref: '#' },
      ]
    : [
        { imageSrc: '', title: 'Column 1', text: 'Add your first message here.', linkHref: '#' },
        { imageSrc: '', title: 'Column 2', text: 'Use this space for a second item.', linkHref: '#' },
      ];

  return [
    header,
    {
      id: 'grid_' + Date.now().toString(36),
      type: 'grid',
      props: {
        bgColor: '#ffffff',
        columns,
      },
    },
    button,
    footer,
  ];
}

function withEmailSettingsBlock(blocks = [], emailSettings = null) {
  const source = Array.isArray(blocks) ? blocks : [];
  if (!emailSettings || source.some((block) => block?.type === '__emailSettings')) return source;
  return [
    {
      id: 'email-settings',
      type: '__emailSettings',
      props: emailSettings,
    },
    ...source,
  ];
}

export default function EmailEditorPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [initialBlocks, setInitialBlocks] = useState([]);
  const [docId, setDocId] = useState(null);
  const [docName, setDocName] = useState('Untitled Email');
  const [templateScope, setTemplateScope] = useState('');
  const [templatePath, setTemplatePath] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    let mounted = true;
    async function boot() {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data?.session?.user?.id || '';
        if (!mounted) return;
        setUserId(uid);
        const urlId = String(router.query?.id || '').trim();
        const qPath = String(router.query?.templatePath || '').trim();
        const qScope = String(router.query?.templateScope || '').trim() || 'public';
        const qName = String(router.query?.templateName || '').trim() || 'Untitled Email';
        const qUrl = String(router.query?.templateUrl || '').trim();
        let starter = String(router.query?.starter || '').trim();
        const preset = String(router.query?.preset || '').trim();

        if (!starter && qUrl.includes('/blank-templates/three-column/')) starter = 'three';
        if (!starter && qUrl.includes('/blank-templates/two-column/')) starter = 'two';
        if (!starter && qUrl.includes('/blank-templates/single-column/')) starter = 'single';
        if (!starter && qUrl.includes('/blank-templates/blank/')) starter = 'blank';

        if (preset) {
          setInitialBlocks(getPresetBlocks(preset, qName));
          setDocId(null);
          setDocName(qName);
          setTemplateScope('');
          setTemplatePath('');
          return;
        }

        if (starter) {
          setInitialBlocks(getStarterBlocks(starter, qName));
          setDocId(null);
          setDocName(qName);
          setTemplateScope('');
          setTemplatePath('');
          return;
        }

        if (qPath) {
          const legacyPreset = getLegacyPreset(qPath, qName);
          if (legacyPreset) {
            setInitialBlocks(getPresetBlocks(legacyPreset, qName));
            setDocId(null);
            setDocName(qName);
            setTemplateScope('');
            setTemplatePath('');
            return;
          }

          const r = await emailEditorFetch(
            '/api/templates/import?scope=' +
              encodeURIComponent(qScope) +
              '&path=' +
              encodeURIComponent(qPath) +
              '&name=' +
              encodeURIComponent(qName),
            {},
            { authErrorMessage: 'Sign in required to load this template.' }
          );
          const j = await r.json().catch(() => null);
          if (mounted && r.ok && j?.ok) {
            const importedBlocks = Array.isArray(j.blocks) && j.blocks.length
              ? withEmailSettingsBlock(j.blocks, j.emailSettings)
              : htmlToEditorBlocks(j.html || '', { assetBase: getAssetBase(qScope, qPath, qUrl), preserveFullLayout: false });
            setInitialBlocks(importedBlocks);
            setDocId(null);
            setDocName(j.templateName || j.subject || qName);
            setTemplateScope(qScope);
            setTemplatePath(qPath);
            return;
          }
        }

        if (qUrl) {
          const legacyPreset = getLegacyPreset(qUrl, qName);
          if (legacyPreset) {
            setInitialBlocks(getPresetBlocks(legacyPreset, qName));
            setDocId(null);
            setDocName(qName);
            setTemplateScope('');
            setTemplatePath('');
            return;
          }

          const r = await fetch(qUrl + (qUrl.includes('?') ? '&' : '?') + 'v=' + Date.now());
          const html = await r.text();
          if (mounted) {
            setInitialBlocks(htmlToEditorBlocks(html, { assetBase: getAssetBase(qScope, qPath, qUrl), preserveFullLayout: false }));
            setDocId(null);
            setDocName(qName);
            return;
          }
        }

        if (uid && urlId && urlId !== 'blank' && urlId !== 'mode=blank') {
          let loaded = false;

          const r = await emailEditorFetch(
            '/api/email/builder-doc-load?userId=' +
              encodeURIComponent(uid) +
              '&docId=' +
              encodeURIComponent(urlId),
            {},
            { authErrorMessage: 'Sign in required to load this email.' }
          );
          const j = await r.json().catch(() => null);
          if (mounted && j?.ok && Array.isArray(j?.doc?.blocks)) {
            const savedBlocks = withEmailSettingsBlock(
              Array.isArray(j.doc.blocks) ? j.doc.blocks : [],
              j.doc.emailSettings || null
            );
            const shouldRehydrateFromHtml =
              savedBlocks.length === 1 &&
              savedBlocks[0]?.type === 'text' &&
              savedBlocks[0]?.props?.rawHtml &&
              typeof j?.doc?.html === 'string' &&
              j.doc.html.trim();

            setInitialBlocks(
              shouldRehydrateFromHtml
                ? htmlToEditorBlocks(j.doc.html, { preserveFullLayout: false })
                : savedBlocks
            );
            setDocId(urlId);
            setDocName(j.doc.templateName || j.doc.subject || j.doc.name || 'Untitled Email');
            loaded = true;
          }

          if (!loaded) {
            const fallback = await emailEditorFetch(
              '/api/email/editor-load?userId=' +
                encodeURIComponent(uid) +
                '&templateId=' +
                encodeURIComponent(urlId),
              {},
              { authErrorMessage: 'Sign in required to load this email.' }
            );
            const alt = await fallback.json().catch(() => null);
            if (mounted && alt?.ok) {
              const blocks = Array.isArray(alt?.blocks) && alt.blocks.length
                ? alt.blocks
                : htmlToEditorBlocks(alt?.html || '', { assetBase: getAssetBase('user', '', '') });

              setInitialBlocks(blocks);
              setDocId(urlId);
              setDocName(alt?.templateId || 'Imported Email');
            }
          }
        }
      } catch (_) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [
    router.isReady,
    router.query?.id,
    router.query?.templatePath,
    router.query?.templateScope,
    router.query?.templateUrl,
    router.query?.starter,
    router.query?.templateName,
  ]);

  const [previewMode, setPreviewMode] = useState(false);

  return (
    <>
      <Head>
        <title>Email Editor | GR8</title>
      </Head>
      <div style={{ height: '100vh', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 18, color: '#e5e7eb', fontWeight: 600 }}>Loading...</div>
        ) : previewMode ? (
          <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
            <button
              style={{ position: 'absolute', top: 24, left: 24, zIndex: 101, background: '#fff', color: '#0f172a', border: '2px solid #2563eb', borderRadius: 10, padding: '10px 20px', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 12px rgba(15,23,42,0.12)' }}
              onClick={() => setPreviewMode(false)}
            >← Back to Editor</button>
            <EmailEditor
              userId={userId}
              initialBlocks={initialBlocks}
              initialDocId={docId}
              initialDocName={docName}
              initialTemplateScope={templateScope}
              initialTemplatePath={templatePath}
              previewMode={true}
            />
          </div>
        ) : (
          <>
            <EmailEditor
              userId={userId}
              initialBlocks={initialBlocks}
              initialDocId={docId}
              initialDocName={docName}
              initialTemplateScope={templateScope}
              initialTemplatePath={templatePath}
              onSaved={(id) => {
                if (typeof window !== 'undefined' && !router.query?.id) {
                  router.replace(
                    '/modules/email/editor?id=' + encodeURIComponent(id),
                    undefined,
                    { shallow: true }
                  );
                }
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
