// Landing Pages: campaign dashboard. Every landing page belongs to a campaign; this is where campaigns start.

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import AuthGate from '../../../components/AuthGate';
import s from '../../../components/landing-pages/ui/admin.module.css';
import { GENERATION_TIMEOUT_MS, useLandingApi } from '../../../components/landing-pages/ui/useLandingApi';

export default function LandingPagesHome() {
  return <AuthGate><Dashboard /></AuthGate>;
}

function Dashboard() {
  const router = useRouter();
  const { call, ready } = useLandingApi();
  const [campaigns, setCampaigns] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState('');
  const [quickPrompt, setQuickPrompt] = useState('');
  const [generateImage, setGenerateImage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [error, setError] = useState('');
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await call(`/api/landing-pages/campaigns${showArchived ? '?archived=1' : ''}`);
      setCampaigns(j.campaigns);
      setError('');
      setServiceUnavailable(false);
    } catch (e) { setError(e.message); setServiceUnavailable(e.body?.retryable === false); setCampaigns(null); }
    finally { setLoading(false); }
  }, [call, showArchived]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const j = await call('/api/landing-pages/campaigns', { method: 'POST', body: { name } });
      router.push(`/modules/landing-pages/${j.campaign.id}`);
    } catch (err) { setError(err.message); setServiceUnavailable(err.body?.retryable === false); setBusy(false); }
  }

  async function quickGenerate(e) {
    e.preventDefault();
    if (!quickPrompt.trim() || quickBusy || !ready || serviceUnavailable) return;
    setQuickBusy(true);
    setError('');
    try {
      const created = await call('/api/landing-pages/campaigns', { method: 'POST', body: { prompt: quickPrompt.trim() } });
      try {
        const generated = await call(`/api/landing-pages/campaigns/${created.campaign.id}`, { method: 'POST', body: { action: 'generate', generateImage }, timeoutMs: GENERATION_TIMEOUT_MS });
        await router.push(`/modules/landing-pages/editor/${generated.pageId}?generated=1`);
      } catch (generationError) {
        if (generationError.body?.pageId) {
          await router.push(`/modules/landing-pages/editor/${generationError.body.pageId}?generated=1`);
          return;
        }
        // The campaign already exists: continue on it rather than leaving it pageless and inviting a duplicate.
        const reason = generationError.status === 400 ? 'missing' : 'failed';
        await router.push(`/modules/landing-pages/${created.campaign.id}?quick=1&generation=${reason}`);
        return;
      }
    } catch (err) {
      setError(err.message);
      setServiceUnavailable(err.body?.retryable === false);
    } finally { setQuickBusy(false); }
  }

  async function act(id, action) {
    try {
      const j = await call(`/api/landing-pages/campaigns/${id}`, { method: 'POST', body: { action } });
      if (action === 'duplicate') router.push(`/modules/landing-pages/${j.campaign.id}`);
      else load();
    } catch (err) { setError(err.message); }
  }

  const totals = (campaigns || []).reduce((t, c) => ({ visits: t.visits + c.stats.visits, leads: t.leads + c.stats.leads, live: t.live + c.pages.filter((p) => p.status === 'published').length }), { visits: 0, leads: 0, live: 0 });

  return (
    <div className={s.page}>
      <Head><title>Landing Pages | GR8 Result</title></Head>
      <div className={s.top}>
        <div>
          <div className={s.kicker}>Campaigns</div>
          <h1 className={s.title}>Landing Pages</h1>
          <p className={s.subtitle}>Name a campaign, answer a few questions, and get a professional landing page that sends every enquiry straight into Leads and CRM.</p>
        </div>
        {campaigns?.length ? (
          <div className={s.stats} style={{ minWidth: 360 }}>
            <div className={s.stat}><div className={s.statNum}>{totals.live}</div><div className={s.statLabel}>Live pages</div></div>
            <div className={s.stat}><div className={s.statNum}>{totals.visits}</div><div className={s.statLabel}>Visits</div></div>
            <div className={s.stat}><div className={s.statNum}>{totals.leads}</div><div className={s.statLabel}>Enquiries</div></div>
          </div>
        ) : null}
      </div>

      <form className={s.create} onSubmit={quickGenerate}>
        <div style={{ flex: '1 1 280px' }}>
          <h2>Quick Generate</h2>
          <p>Describe your business, campaign and audience in one prompt, or add a detailed Advanced Brief. Saved business details are reused; refine the draft in the editor.</p>
        </div>
        <textarea className={s.input} style={{ flex: '2 1 420px', minHeight: 96, resize: 'vertical' }} value={quickPrompt} onChange={(event) => setQuickPrompt(event.target.value)} placeholder="Create a page for our new spring menu, aimed at local families booking weekend tables. Use a bright editorial layout and highlight the seasonal dishes…" aria-label="Quick Generate or Advanced Brief" maxLength={4000} />
        <label className={s.help}><input type="checkbox" checked={generateImage} onChange={(event) => setGenerateImage(event.target.checked)} /> Automatically plan and source campaign imagery: Media Library photos first, then AI-generated photos only up to the account's configured image budget. Any shortage is reported in the editable draft.</label>
        <button className={`${s.btn} ${s.primary}`} type="submit" disabled={quickBusy || !ready || serviceUnavailable || loading || !quickPrompt.trim()}>{quickBusy ? 'Generating…' : 'Generate draft'}</button>
      </form>

      <form className={s.create} onSubmit={create}>
        <div style={{ flex: '1 1 280px' }}>
          <h2>Guided Generate</h2>
          <p>Choose something easy to recognise, such as 'Spring Promotion', 'New Product Launch' or 'Free Consultation Campaign'.</p>
        </div>
        <input className={s.input} style={{ flex: '2 1 320px' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" aria-label="Campaign name" maxLength={160} />
        <button className={`${s.btn} ${s.primary}`} type="submit" disabled={busy || !ready || serviceUnavailable || loading || !name.trim()}>{busy ? 'Creating…' : ready ? 'Create campaign' : 'Loading…'}</button>
      </form>

      {error ? <div className={s.alert} role="alert">{error} {!serviceUnavailable ? <button type="button" className={`${s.btn} ${s.small}`} onClick={load} disabled={loading}>{loading ? 'Retrying…' : 'Retry'}</button> : null}</div> : null}

      <div className={s.spread} style={{ marginBottom: 16 }}>
        <h2 className={s.cardTitle}>{showArchived ? 'All campaigns' : 'Your campaigns'}</h2>
        <label className={s.row} style={{ fontSize: 15, color: '#9aa4b5', cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
      </div>

      {campaigns === null ? (error ? null : <p className={s.muted}>Loading campaigns…</p>) : campaigns.length === 0 ? (
        <div className={`${s.card} ${s.empty}`}>
          <h3>No campaigns yet</h3>
          <p className={s.muted}>Create your first campaign above. The AI will ask you about your business and build the page with you.</p>
        </div>
      ) : (
        <div className={s.grid}>
          {campaigns.map((c) => {
            const page = c.pages[0];
            return (
              <article key={c.id} className={`${s.card} ${s.campaign}`}>
                <div className={s.spread}>
                  <span className={`${s.badge} ${s[`badge_${c.status}`]}`}>{c.status}</span>
                  {page ? <span className={`${s.badge} ${s[`badge_${page.status}`]}`}>{page.status === 'published' ? 'Live' : page.status}</span> : <span className={`${s.badge} ${s.badge_draft}`}>No page yet</span>}
                </div>
                {page?.thumbnail ? <Link className={s.thumbnailLink} href={`/modules/landing-pages/editor/${page.id}`} aria-label={`Preview ${c.name}`}>
                  <img className={s.thumbnail} src={page.thumbnail} alt={`${c.name} landing-page preview`} loading="lazy" />
                </Link> : <div className={s.thumbnailEmpty} aria-label="No page preview available">Page preview appears after generation</div>}
                <Link className={s.campaignName} href={`/modules/landing-pages/${c.id}`}>{c.name}</Link>
                <div className={s.stats}>
                  <div className={s.stat}><div className={s.statNum}>{c.stats.visits}</div><div className={s.statLabel}>Visits</div></div>
                  <div className={s.stat}><div className={s.statNum}>{c.stats.leads}</div><div className={s.statLabel}>Enquiries</div></div>
                  <div className={s.stat}><div className={s.statNum}>{c.stats.conversionRate}%</div><div className={s.statLabel}>Conversion</div></div>
                </div>
                {c.stats.failed ? <div className={s.alert} style={{ margin: 0 }}>{c.stats.failed} enquir{c.stats.failed === 1 ? 'y is' : 'ies are'} waiting to reach CRM — open the campaign to retry.</div> : null}
                <div className={s.row}>
                  <Link className={`${s.btn} ${s.primary} ${s.small}`} href={page ? `/modules/landing-pages/editor/${page.id}` : `/modules/landing-pages/${c.id}`}>{page ? 'Edit page' : 'Continue setup'}</Link>
                  <Link className={`${s.btn} ${s.ghost} ${s.small}`} href={`/modules/landing-pages/${c.id}`}>Campaign</Link>
                  {page?.status === 'published' ? <a className={`${s.btn} ${s.ghost} ${s.small}`} href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">View live</a> : null}
                  <button type="button" className={`${s.btn} ${s.ghost} ${s.small}`} onClick={() => act(c.id, 'duplicate')}>Duplicate</button>
                  {c.status === 'archived'
                    ? <button type="button" className={`${s.btn} ${s.ghost} ${s.small}`} onClick={() => act(c.id, 'restore')}>Restore</button>
                    : <button type="button" className={`${s.btn} ${s.danger} ${s.small}`} onClick={() => { if (window.confirm(`Delete “${c.name}”? This safely archives the campaign and takes its page offline. Enquiries, CRM records and page history are kept, and you can restore it later.`)) act(c.id, 'archive'); }}>Delete</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
