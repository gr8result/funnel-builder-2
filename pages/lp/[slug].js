// Public landing page: /lp/<slug>. Server-renders the *published* version with the same renderer the editor uses.

import Head from 'next/head';
import { useEffect } from 'react';
import LandingPageRenderer from '../../components/landing-pages/renderer/LandingPageRenderer';
import { fontHref } from '../../components/landing-pages/renderer/styles';
import { safeUrl } from '../../lib/landing-pages/pageModel';

export default function PublicLandingPage({ doc, pageId, formToken, canonical }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const attribution = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) if (params.get(k)) attribution[k] = params.get(k);
    if (document.referrer) attribution.referrer = document.referrer;
    const payload = JSON.stringify({ pageId, attribution });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/landing-pages/track', new Blob([payload], { type: 'application/json' }));
      else fetch('/api/landing-pages/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
    } catch { /* analytics only */ }
  }, [pageId]);

  const seo = doc.seo || {};
  const og = safeUrl(seo.ogImage);
  const b = doc.brand || {};
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'HomeAndConstructionBusiness', name: b.name || undefined, url: canonical,
    telephone: b.phone || undefined, email: b.email || undefined, areaServed: b.serviceArea || undefined, image: og || undefined, logo: safeUrl(b.logoUrl) || undefined,
  };
  return (
    <>
      <Head>
        <title>{seo.title || b.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {seo.description ? <meta name="description" content={seo.description} /> : null}
        {seo.noindex ? <meta name="robots" content="noindex,nofollow" /> : null}
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seo.title || b.name} />
        {seo.description ? <meta property="og:description" content={seo.description} /> : null}
        <meta property="og:url" content={canonical} />
        {og ? <meta property="og:image" content={og} /> : null}
        <meta name="twitter:card" content={og ? 'summary_large_image' : 'summary'} />
        <meta name="theme-color" content={doc.theme?.palette?.ink || '#0B0F1A'} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontHref(doc.theme)} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      </Head>
      <LandingPageRenderer doc={doc} runtime={{ mode: 'live', pageId, formToken }} animate />
    </>
  );
}

PublicLandingPage.disableLayout = true;
PublicLandingPage.disableRouteProgress = true;

export async function getServerSideProps({ params, req, res }) {
  const { getPublishedBySlug } = await import('../../lib/landing-pages/repository');
  const { signFormToken } = await import('../../lib/landing-pages/submission');
  const { publicBaseUrl } = await import('../../lib/landing-pages/http');
  let published = null;
  try {
    published = await getPublishedBySlug(String(params.slug || ''));
  } catch (e) {
    console.error('[lp] load failed', e.message);
    res.statusCode = 503;
    res.setHeader('Retry-After', '30');
    throw new Error('Landing page temporarily unavailable');
  }
  if (!published) return { notFound: true };
  // Short shared cache so a republish shows within about a minute, with a signed form token per render.
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  return {
    props: {
      doc: JSON.parse(JSON.stringify(published.document)),
      pageId: published.page.id,
      formToken: signFormToken(published.page.id),
      canonical: `${publicBaseUrl(req)}/lp/${published.page.slug}`,
    },
  };
}
