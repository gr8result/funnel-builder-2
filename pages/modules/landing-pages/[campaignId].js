// One campaign: the AI interview until a page exists, then overview, enquiries, promotion and campaign details.

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import AuthGate from '../../../components/AuthGate';
import s from '../../../components/landing-pages/ui/admin.module.css';
import { GENERATION_TIMEOUT_MS, useLandingApi } from '../../../components/landing-pages/ui/useLandingApi';
import Interview from '../../../components/landing-pages/ui/Interview';

export default function CampaignPage() {
  return <AuthGate><Campaign /></AuthGate>;
}

function Campaign() {
  const router = useRouter();
  const { campaignId } = router.query;
  const { call, ready } = useLandingApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    try { setData(await call(`/api/landing-pages/campaigns/${campaignId}`)); setError(''); } catch (e) { setError(e.message); }
  }, [call, campaignId]);
  useEffect(() => { if (ready && campaignId) load(); }, [ready, campaignId, load]);

  if (error && !data) return <div className={s.page}><Link className={s.back} href="/modules/landing-pages">← All campaigns</Link><div className={s.alert}>{error}</div></div>;
  if (!data) return <div className={s.page}><p className={s.muted}>Loading campaign…</p></div>;

  const { campaign, pages, stats } = data;
  const page = pages[0];

  return (
    <div className={s.page}>
      <Head><title>{campaign.name} | Landing Pages</title></Head>
      <Link className={s.back} href="/modules/landing-pages">← All campaigns</Link>
      <div className={s.top}>
        <div>
          <div className={s.kicker}>Campaign</div>
          <h1 className={s.title}>{campaign.name}</h1>
          <div className={s.row} style={{ marginTop: 10 }}>
            <span className={`${s.badge} ${s[`badge_${campaign.status}`]}`}>{campaign.status}</span>
            {page ? <span className={`${s.badge} ${s[`badge_${page.status}`]}`}>{page.status === 'published' ? 'Page live' : `Page ${page.status}`}</span> : null}
            {campaign.starts_on || campaign.ends_on ? <span className={s.help}>{campaign.starts_on || '…'} → {campaign.ends_on || '…'}</span> : null}
          </div>
        </div>
        {page ? (
          <div className={s.row}>
            {page.status === 'published' ? <a className={`${s.btn} ${s.ghost}`} href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">View live page</a> : null}
            <Link className={`${s.btn} ${s.primary}`} href={`/modules/landing-pages/editor/${page.id}`}>Open editor</Link>
          </div>
        ) : null}
      </div>
      {error ? <div className={s.alert}>{error}</div> : null}
      {!page && router.query.generation === 'failed' ? (
        <div className={s.alert} role="status" data-testid="generation-resume-notice">The first draft could not be finished. Your campaign and brief are saved here — review the answers below and select Generate to try again. There is no need to start a new campaign.</div>
      ) : null}

      {!page ? (
        <Interview
          campaign={campaign}
          interview={data.interview}
          aiAvailable={data.aiAvailable}
          call={call}
          onUpdated={(j) => setData(j)}
          onGenerated={(pageId) => router.push(`/modules/landing-pages/editor/${pageId}?generated=1`)}
        />
      ) : (
        <>
          <div className={s.tabs} role="tablist">
            {[['overview', 'Overview'], ['enquiries', `Enquiries (${stats.leads})`], ['promote', 'Promote'], ['details', 'Campaign details']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`${s.tab} ${tab === k ? s.tabOn : ''}`} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          {tab === 'overview' ? <Overview data={data} page={page} /> : null}
          {tab === 'enquiries' ? <Enquiries data={data} call={call} campaignId={campaign.id} onData={setData} /> : null}
          {tab === 'promote' ? <Promote page={page} call={call} /> : null}
          {tab === 'details' ? <Details data={data} call={call} onData={setData} onError={setError} router={router} /> : null}
        </>
      )}
    </div>
  );
}

function Overview({ data, page }) {
  const { stats } = data;
  const url = typeof window !== 'undefined' ? `${window.location.origin}/lp/${page.slug}` : `/lp/${page.slug}`;
  return (
    <div className={s.two}>
      <div className={s.card}>
        <h2 className={s.cardTitle}>Performance</h2>
        <div className={s.stats} style={{ marginTop: 14 }}>
          <div className={s.stat}><div className={s.statNum}>{stats.visits}</div><div className={s.statLabel}>Visits</div></div>
          <div className={s.stat}><div className={s.statNum}>{stats.leads}</div><div className={s.statLabel}>Enquiries</div></div>
          <div className={s.stat}><div className={s.statNum}>{stats.conversionRate}%</div><div className={s.statLabel}>Conversion</div></div>
        </div>
        {stats.failed ? <div className={s.alert} style={{ marginTop: 14 }}>{stats.failed} enquiry not yet in CRM — see the Enquiries tab.</div> : null}
      </div>
      <div className={s.card}>
        <h2 className={s.cardTitle}>Landing page</h2>
        <p className={s.muted} style={{ margin: '6px 0 14px' }}>{page.status === 'published' ? `Live since ${new Date(page.published_at).toLocaleString()}` : page.status === 'unpublished' ? 'Offline — republish from the editor.' : 'Draft — publish from the editor when you are happy with it.'}</p>
        <div className={s.label}>Public address</div>
        {page.status === 'published' ? <a className={s.link} href={url} target="_blank" rel="noreferrer">{url}</a> : <span className={s.muted}>{url} (not live yet)</span>}
        <div className={s.row} style={{ marginTop: 16 }}>
          <Link className={`${s.btn} ${s.primary} ${s.small}`} href={`/modules/landing-pages/editor/${page.id}`}>Edit page</Link>
          <Link className={`${s.btn} ${s.ghost} ${s.small}`} href={`/modules/landing-pages/preview/${page.id}`} target="_blank">Preview draft</Link>
        </div>
      </div>
    </div>
  );
}

function Enquiries({ data, call, campaignId, onData }) {
  const [busy, setBusy] = useState(false);
  const failed = data.submissions.filter((x) => x.status !== 'synced').length;
  async function retry() {
    setBusy(true);
    try { onData(await call(`/api/landing-pages/campaigns/${campaignId}`, { method: 'POST', body: { action: 'retry-sync' } })); } finally { setBusy(false); }
  }
  if (!data.submissions.length) return <div className={`${s.card} ${s.empty}`}><h3>No enquiries yet</h3><p className={s.muted}>Enquiries from this page appear here and in Leads, tagged with this campaign.</p></div>;
  return (
    <div className={s.card} style={{ overflowX: 'auto' }}>
      <div className={s.spread} style={{ marginBottom: 12 }}>
        <p className={s.muted} style={{ margin: 0 }}>Every enquiry is saved here first, then added to Leads and CRM.</p>
        {failed ? <button type="button" className={`${s.btn} ${s.primary} ${s.small}`} disabled={busy} onClick={retry}>{busy ? 'Retrying…' : `Retry ${failed} CRM update${failed > 1 ? 's' : ''}`}</button> : null}
      </div>
      <table className={s.table}>
        <thead><tr><th>Received</th><th>Name</th><th>Contact</th><th>Details</th><th>Source</th><th>CRM</th></tr></thead>
        <tbody>
          {data.submissions.map((x) => (
            <tr key={x.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{new Date(x.created_at).toLocaleString()}</td>
              <td>{x.name || '—'}</td>
              <td>{x.email}<br /><span className={s.muted}>{x.phone || ''}</span></td>
              <td className={s.muted} style={{ maxWidth: 320 }}>{Object.entries(x.fields || {}).filter(([k]) => !['name', 'email', 'phone'].includes(k)).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ') || '—'}</td>
              <td className={s.muted}>{x.attribution?.utm_source || (x.attribution?.referrer ? new URL(x.attribution.referrer).hostname : 'Direct')}</td>
              <td>
                <span className={`${s.badge} ${s[`badge_${x.status}`]}`}>{x.status === 'synced' ? 'In CRM' : x.status === 'failed' ? 'Retrying' : 'Queued'}</span>
                {x.lead_id ? <div style={{ marginTop: 6 }}><Link className={s.link} href={`/leads?lead=${x.lead_id}`}>Open in CRM</Link></div> : null}
                {x.last_error && x.status !== 'synced' ? <div className={s.help} style={{ marginTop: 4 }}>Attempt {x.attempts} failed</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Promote({ page, call }) {
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const load = useCallback(async (writePosts = false) => {
    setBusy(true);
    try { setM(await call(`/api/landing-pages/pages/${page.id}`, { method: 'POST', body: { action: 'marketing', writePosts }, timeoutMs: GENERATION_TIMEOUT_MS })); } finally { setBusy(false); }
  }, [call, page.id]);
  useEffect(() => { load(false); }, [load]);
  const copy = async (key, text) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { /* clipboard blocked */ } };
  if (!m) return <p className={s.muted}>Loading…</p>;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {!m.published ? <div className={s.note}>Publish the page before sharing these links — until then they show a “not found” page.</div> : null}
      <div className={s.card}>
        <h2 className={s.cardTitle}>Tracked links</h2>
        <p className={s.muted} style={{ margin: '4px 0 14px' }}>Use a different link per channel so every enquiry in CRM shows where it came from.</p>
        <table className={s.table}><tbody>
          {m.links.map((l) => (
            <tr key={l.key}><td style={{ width: 160, fontWeight: 650 }}>{l.label}</td><td><span className={s.link}>{l.url}</span></td><td style={{ width: 100 }}><button type="button" className={`${s.btn} ${s.ghost} ${s.small}`} onClick={() => copy(l.key, l.url)}>{copied === l.key ? 'Copied' : 'Copy'}</button></td></tr>
          ))}
        </tbody></table>
      </div>
      <div className={s.two}>
        <div className={s.card}>
          <h2 className={s.cardTitle}>Social share preview</h2>
          <div style={{ marginTop: 14, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)', background: '#0b1220' }}>
            {m.preview.image ? <img src={m.preview.image} alt="" style={{ width: '100%', aspectRatio: '1.91/1', objectFit: 'cover', display: 'block' }} /> : <div style={{ aspectRatio: '1.91/1', display: 'grid', placeItems: 'center' }} className={s.muted}>Add a sharing image in the editor (Page settings)</div>}
            <div style={{ padding: 14 }}><div className={s.help}>{m.url.replace(/^https?:\/\//, '').split('/')[0]}</div><div style={{ fontWeight: 700, color: '#fff', marginTop: 4 }}>{m.preview.title}</div><div className={s.help} style={{ marginTop: 4 }}>{m.preview.description}</div></div>
          </div>
        </div>
        <div className={s.card}>
          <div className={s.spread}><h2 className={s.cardTitle}>Facebook & Instagram posts</h2><button type="button" className={`${s.btn} ${s.ghost} ${s.small}`} disabled={busy} onClick={() => load(true)}>{busy ? 'Writing…' : 'Rewrite with AI'}</button></div>
          <div className={s.label} style={{ marginTop: 14 }}>Facebook</div>
          <div className={s.copyBox}>{m.posts.facebook}</div>
          <button type="button" className={`${s.btn} ${s.ghost} ${s.small}`} style={{ marginTop: 8 }} onClick={() => copy('fb', m.posts.facebook)}>{copied === 'fb' ? 'Copied' : 'Copy'}</button>
          <div className={s.label} style={{ marginTop: 16 }}>Instagram</div>
          <div className={s.copyBox}>{m.posts.instagram}{m.posts.hashtags?.length ? `\n\n${m.posts.hashtags.map((h) => `#${String(h).replace(/^#/, '')}`).join(' ')}` : ''}</div>
          <button type="button" className={`${s.btn} ${s.ghost} ${s.small}`} style={{ marginTop: 8 }} onClick={() => copy('ig', `${m.posts.instagram}\n\n${(m.posts.hashtags || []).map((h) => `#${String(h).replace(/^#/, '')}`).join(' ')}`)}>{copied === 'ig' ? 'Copied' : 'Copy'}</button>
          <p className={s.help} style={{ marginTop: 16 }}>These are drafts. Schedule or publish them from <Link className={s.link} href="/modules/social_media/create">Social Media</Link>, or add the email link in <Link className={s.link} href="/modules/email">Email Marketing</Link>. Nothing is posted until you publish it there.</p>
        </div>
      </div>
    </div>
  );
}

function Details({ data, call, onData, onError, router }) {
  const { campaign } = data;
  const b = campaign.brief || {};
  const [form, setForm] = useState({ name: campaign.name, starts_on: campaign.starts_on || '', ends_on: campaign.ends_on || '', offering: b.offering || '', audience: b.audience || '', serviceArea: b.serviceArea || '', offer: b.offer || '', ctaLabel: b.ctaLabel || '', usps: (b.usps || []).join('\n') });
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function save() {
    setBusy('save');
    try {
      onData(await call(`/api/landing-pages/campaigns/${campaign.id}`, { method: 'PATCH', body: { name: form.name, starts_on: form.starts_on || null, ends_on: form.ends_on || null, brief: { offering: form.offering, audience: form.audience, serviceArea: form.serviceArea, offer: form.offer, ctaLabel: form.ctaLabel, usps: form.usps.split('\n') } } }));
    } catch (e) { onError(e.message); }
    setBusy('');
  }
  async function regenerate() {
    if (!window.confirm('Regenerate the page from the campaign details? Your current draft is kept in version history and the live page is not changed until you publish.')) return;
    const generateImage = window.confirm('Also plan and source images? Media Library photos are used first. Any AI-generated photos are paid, count against the configured image budget and are refused once that budget is used. Choose Cancel to regenerate without sourcing images.');
    setBusy('regen');
    try {
      await save();
      const j = await call(`/api/landing-pages/campaigns/${campaign.id}`, { method: 'POST', body: { action: 'generate', replace: true, generateImage }, timeoutMs: GENERATION_TIMEOUT_MS });
      router.push(`/modules/landing-pages/editor/${j.pageId}?generated=1`);
    } catch (e) { onError(e.message); setBusy(''); }
  }
  async function status(next) {
    setBusy(next);
    try { onData(await call(`/api/landing-pages/campaigns/${campaign.id}`, next === 'archived' ? { method: 'POST', body: { action: 'archive' } } : { method: 'PATCH', body: { status: next } })); } catch (e) { onError(e.message); }
    setBusy('');
  }
  return (
    <div className={s.card} style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      <div><label className={s.label} htmlFor="c-name">Campaign name</label><input id="c-name" className={s.input} value={form.name} onChange={set('name')} /></div>
      <div className={s.two}>
        <div><label className={s.label} htmlFor="c-s">Start date</label><input id="c-s" type="date" className={s.input} value={form.starts_on} onChange={set('starts_on')} /></div>
        <div><label className={s.label} htmlFor="c-e">End date</label><input id="c-e" type="date" className={s.input} value={form.ends_on} onChange={set('ends_on')} /></div>
      </div>
      <div><label className={s.label} htmlFor="c-off">Products or services promoted</label><input id="c-off" className={s.input} value={form.offering} onChange={set('offering')} /></div>
      <div className={s.two}>
        <div><label className={s.label} htmlFor="c-aud">Target customer</label><input id="c-aud" className={s.input} value={form.audience} onChange={set('audience')} /></div>
        <div><label className={s.label} htmlFor="c-area">Service area</label><input id="c-area" className={s.input} value={form.serviceArea} onChange={set('serviceArea')} /></div>
      </div>
      <div className={s.two}>
        <div><label className={s.label} htmlFor="c-offer">Offer</label><input id="c-offer" className={s.input} value={form.offer} onChange={set('offer')} /></div>
        <div><label className={s.label} htmlFor="c-cta">Main button text</label><input id="c-cta" className={s.input} value={form.ctaLabel} onChange={set('ctaLabel')} /></div>
      </div>
      <div><label className={s.label} htmlFor="c-usp">Strengths (one per line)</label><textarea id="c-usp" className={s.textarea} value={form.usps} onChange={set('usps')} /></div>
      <p className={s.help} style={{ margin: 0 }}>Saving changes the campaign brief only. Your page keeps its edits — regenerate if you want a fresh page from these details.</p>
      <div className={s.row}>
        <button type="button" className={`${s.btn} ${s.primary}`} disabled={!!busy} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save details'}</button>
        <button type="button" className={`${s.btn} ${s.ghost}`} disabled={!!busy} onClick={regenerate}>{busy === 'regen' ? 'Regenerating…' : 'Regenerate page'}</button>
        <span style={{ flex: 1 }} />
        {campaign.status === 'active' ? <button type="button" className={`${s.btn} ${s.ghost}`} disabled={!!busy} onClick={() => status('paused')}>Pause (take page offline)</button> : null}
        {campaign.status === 'paused' ? <button type="button" className={`${s.btn} ${s.ghost}`} disabled={!!busy} onClick={() => status('active')}>Resume campaign</button> : null}
        {campaign.status !== 'archived' ? <button type="button" className={`${s.btn} ${s.danger}`} disabled={!!busy} onClick={() => { if (window.confirm('Archive this campaign? Its page goes offline; enquiries and CRM records are kept.')) status('archived'); }}>Archive</button> : null}
      </div>
    </div>
  );
}
