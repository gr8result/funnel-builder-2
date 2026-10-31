// Full-screen preview of a landing page draft (signed-in builders only). Renders exactly as the live page will;
// the form shows a preview notice instead of sending.

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import AuthGate from '../../../../components/AuthGate';
import LandingPageRenderer from '../../../../components/landing-pages/renderer/LandingPageRenderer';
import { fontHref } from '../../../../components/landing-pages/renderer/styles';
import { useLandingApi } from '../../../../components/landing-pages/ui/useLandingApi';

function Preview() {
  const { pageId, version } = useRouter().query;
  const { call, ready } = useLandingApi();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready || !pageId) return;
    let active = true;
    setDoc(null);
    setError('');
    (async () => {
      try {
        const result = version
          ? await call(`/api/landing-pages/pages/${pageId}?version=${encodeURIComponent(version)}`)
          : await call(`/api/landing-pages/pages/${pageId}`);
        if (active) setDoc(version ? result.version.document : result.page.document);
      } catch (e) { if (active) setError(e.message); }
    })();
    return () => { active = false; };
  }, [ready, pageId, version, call, attempt]);
  if (error) return <div style={{ padding: 32, fontFamily: 'system-ui' }}><p role="alert">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div>;
  if (!doc) return <p style={{ padding: 32, fontFamily: 'system-ui' }} role="status">Loading preview…</p>;
  return (
    <>
      <Head>
        <title>{`Preview — ${doc.seo?.title || doc.brand?.name || 'Landing page'}`}</title>
        <meta name="robots" content="noindex,nofollow" />
        <link rel="stylesheet" href={fontHref(doc.theme)} />
      </Head>
      <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#111827', color: '#fff', padding: '10px 18px', borderRadius: 999, fontFamily: 'system-ui', fontSize: 15, boxShadow: '0 10px 30px rgba(0,0,0,.3)' }}>
        Preview of your {version ? 'saved version' : 'draft'} — not the live page
      </div>
      <LandingPageRenderer doc={doc} runtime={{ mode: 'preview' }} />
    </>
  );
}

export default function PreviewPage() {
  return <AuthGate><Preview /></AuthGate>;
}
PreviewPage.disableLayout = true;
