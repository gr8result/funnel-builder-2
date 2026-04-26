// /pages/modules/social_media/inbox.js
// Social Bot Builder -- ManyChat-style auto-reply rule engine + conversation log

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';

// Platform SVGs
const PM = {
  facebook:  { color: '#1877F2', label: 'Facebook',  svg: (c,s=18) => <svg viewBox="0 0 24 24" width={s} height={s} fill={c}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  instagram: { color: '#E1606C', label: 'Instagram', svg: (c,s=18) => <svg viewBox="0 0 24 24" width={s} height={s} fill={c}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
};
const DPM = { color: '#7C3AED', label: 'Page', svg: (c,s=18) => <svg viewBox="0 0 24 24" width={s} height={s} fill={c}><circle cx="12" cy="12" r="10"/></svg> };
function pm(p) { return PM[String(p||'').toLowerCase()] || DPM; }

function fmtDate(d) {
  if (!d) return 'e2 80 94';
  return new Date(d).toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}
function api(path, opts = {}) {
  return getToken().then(token =>
    fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(r => r.json())
  );
}

const BLANK_RULE = {
  account_id: '', platform: 'facebook', name: '', trigger_type: 'keyword',
  keywords: [], match_mode: 'any', scope: 'comment',
  reply_comment: '', reply_dm: '', like_comment: false, is_active: true,
};

const S = {
  page:        { minHeight: '100vh', background: '#1f0420', fontFamily: 'system-ui,sans-serif', color: '#F3F0FF' },
  banner:      { maxWidth: 1620, margin: '16px auto 0', background: 'rgba(194,7,169,0.99)', border: '1px solid rgba(167,169,250,0.2)', borderRadius: 16, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 },
  bannerLeft:  { display: 'flex', alignItems: 'center', gap: 16 },
  bannerIcon:  { width: 48, height: 48, borderRadius: 16, background: 'rgb(166,44,248)', border: '1px solid rgba(167,169,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  bannerTitle: { fontSize: 28, fontWeight: 700, color: '#F3F0FF', margin: 0 },
  bannerSub:   { fontSize: 14, color: '#ffffffcc', marginTop: 2 },
  bannerNav:   { display: 'flex', gap: 8, flexWrap: 'wrap' },
  bannerBtn:   { padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(164,58,237,0.4)', background: 'rgb(240,233,233)', color: '#4c32b3', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' },
  inner:       { maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' },
  tabs:        { display: 'flex', gap: 7, marginBottom: 22, flexWrap: 'wrap' },
  tab:  (a)  => ({ padding: '7px 18px', borderRadius: 8, border: a ? '1px solid rgba(167,169,250,0.5)' : '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: a ? 'rgba(164,58,237,0.45)' : 'rgba(255,255,255,0.04)', color: a ? '#F3F0FF' : '#9CA3AF', transition: 'all 0.15s' }),
  card:        { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', marginBottom: 14 },
  form:        { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(167,169,250,0.2)', borderRadius: 14, padding: '20px 22px', marginBottom: 22 },
  formTitle:   { fontSize: 16, fontWeight: 700, color: '#E9D5FF', marginBottom: 14, marginTop: 0 },
  row:         { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, alignItems: 'flex-start' },
  label:       { fontSize: 13, color: '#9CA3AF', marginBottom: 4, display: 'block' },
  input:       { background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '8px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  sel:         { background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '8px 12px', fontSize: 14, outline: 'none', cursor: 'pointer', width: '100%', boxSizing: 'border-box' },
  ta:          { background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '9px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 70 },
  saveBtn:     { padding: '10px 22px', borderRadius: 9, background: 'rgba(124,58,237,0.75)', border: '1px solid rgba(167,169,250,0.4)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  secBtn:      { padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#D8B4FE', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  dangerBtn:   { padding: '6px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  pill:  (c,bg) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: c, background: bg }),
  notice:      { padding: '10px 16px', borderRadius: 10, background: 'rgba(164,58,237,0.2)', border: '1px solid rgba(167,169,250,0.3)', fontSize: 14, color: '#D8B4FE', marginBottom: 16 },
  err:         { padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 14, color: '#FCA5A5', marginBottom: 16 },
  empty:       { textAlign: 'center', padding: '40px 20px', color: '#6B7280', fontSize: 14 },
  kw:          { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(124,58,237,0.35)', border: '1px solid rgba(167,169,250,0.3)', borderRadius: 20, padding: '3px 10px 3px 12px', fontSize: 13, color: '#E9D5FF', margin: '3px' },
  kwX:         { cursor: 'pointer', opacity: 0.6, fontSize: 15, lineHeight: 1 },
  toggle: (on) => ({ width: 40, height: 22, borderRadius: 11, background: on ? '#7C3AED' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }),
  toggleDot: (on) => ({ position: 'absolute', top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }),
  setupBox:    { background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 },
  convRow:     { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  convIcon:    { width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};

function Toggle({ on, onChange }) {
  return (
    <button style={S.toggle(on)} onClick={() => onChange(!on)} aria-label="toggle">
      <div style={S.toggleDot(on)} />
    </button>
  );
}

function ActionBadge({ action }) {
  if (!action || action === 'none') return <span style={S.pill('#9CA3AF','rgba(255,255,255,0.06)')}>No match</span>;
  const parts = action.split(',');
  return (
    <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {parts.map(p => {
        const map = {
          replied_comment: ['Comment reply', '#93C5FD', 'rgba(30,58,138,0.35)'],
          sent_dm:         ['DM sent',       '#6EE7B7', 'rgba(6,78,59,0.4)'],
          liked:           ['Liked',         '#FCA5A5', 'rgba(127,29,29,0.4)'],
        };
        const [lbl,c,bg] = map[p.trim()] || [p, '#D8B4FE', 'rgba(124,58,237,0.25)'];
        return <span key={p} style={S.pill(c,bg)}>{lbl}</span>;
      })}
    </span>
  );
}

export default function BotBuilderPage() {
  const router = useRouter();
  const [tab, setTab]             = useState('rules');
  const [accounts, setAccounts]   = useState([]);
  const [rules, setRules]         = useState([]);
  const [convs, setConvs]         = useState([]);
  const [convTotal, setConvTotal] = useState(0);
  const [convPage, setConvPage]   = useState(1);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [notice, setNotice]       = useState('');
  const [err, setErr]             = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [kwInput, setKwInput]     = useState('');
  const [convFilter, setConvFilter] = useState('all');

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (tab === 'log') loadConvs(1); }, [tab, convFilter]);

  async function loadAll() {
    setLoading(true);
    try {
      const [accsRes, rulesRes] = await Promise.all([
        supabase.from('social_accounts').select('account_id,account_name,platform').eq('is_active', true),
        api('/api/social/bot-rules'),
      ]);
      setAccounts((accsRes.data || []).filter(a => ['facebook','instagram'].includes(a.platform)));
      setRules(rulesRes.rules || []);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  async function loadConvs(page = 1) {
    const filter = convFilter === 'unmatched' ? '&action=unmatched' : '';
    const res = await api(`/api/social/bot-conversations?page=${page}&limit=30${filter}`);
    setConvs(res.conversations || []);
    setConvTotal(res.total || 0);
    setConvPage(page);
  }

  async function saveRule() {
    setErr(''); setNotice('');
    if (!editingRule.name.trim()) return setErr('Rule name is required');
    if (!editingRule.account_id)  return setErr('Select a connected page/account');
    if (!editingRule.reply_comment && !editingRule.reply_dm && !editingRule.like_comment)
      return setErr('Add at least one action: comment reply, DM, or like');
    setSaving(true);
    try {
      const res = editingRule.id
        ? await api('/api/social/bot-rules', { method: 'PUT',  body: editingRule })
        : await api('/api/social/bot-rules', { method: 'POST', body: editingRule });
      if (!res.ok) throw new Error(res.error);
      setNotice(editingRule.id ? 'Rule updated.' : 'Rule created.');
      setEditingRule(null);
      await loadAll();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  }

  async function toggleRule(rule) {
    await api('/api/social/bot-rules', { method: 'PUT', body: { id: rule.id, is_active: !rule.is_active } });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  }

  async function deleteRule(id) {
    if (!confirm('Delete this rule?')) return;
    await api(`/api/social/bot-rules?id=${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
  }

  function addKw() {
    const kw = kwInput.trim().toLowerCase();
    if (!kw || editingRule.keywords.includes(kw)) return;
    setEditingRule(r => ({ ...r, keywords: [...r.keywords, kw] }));
    setKwInput('');
  }
  function removeKw(kw) {
    setEditingRule(r => ({ ...r, keywords: r.keywords.filter(k => k !== kw) }));
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/facebook`
    : 'https://yourdomain.com/api/webhooks/facebook';

  const [subscribing, setSubscribing] = useState({});
  const [subResult, setSubResult]     = useState({});

  async function subscribePage(pageId) {
    setSubscribing(p => ({ ...p, [pageId]: true }));
    setSubResult(p => ({ ...p, [pageId]: null }));
    try {
      const res = await api('/api/social/bot-subscribe-page', { method: 'POST', body: { pageId } });
      setSubResult(p => ({ ...p, [pageId]: res.ok ? 'ok' : res.error }));
    } catch (e) {
      setSubResult(p => ({ ...p, [pageId]: e.message }));
    }
    setSubscribing(p => ({ ...p, [pageId]: false }));
  }

  return (
    <>
      <Head><title>Social Bot Builder</title></Head>
      <div style={S.page}>
        <div style={{ padding: '0 16px' }}>
          <div style={S.banner}>
            <div style={S.bannerLeft}>
              <div style={S.bannerIcon}>&#129302;</div>
              <div>
                <div style={S.bannerTitle}>Social Bot Builder</div>
                <div style={S.bannerSub}>Auto-reply to comments and DMs, 24/7 without you being online</div>
              </div>
            </div>
            <div style={S.bannerNav}>
              <button style={S.bannerBtn} onClick={() => router.push('/modules/social_media/dashboard')}>Back to Dashboard</button>
              <button style={S.bannerBtn} onClick={() => router.push('/modules/social_media/calendar')}>Calendar</button>
            </div>
          </div>
        </div>

        <div style={S.inner}>
          {notice && <div style={S.notice}>{notice}</div>}
          {err    && <div style={S.err}>{err}</div>}

          <div style={S.tabs}>
            <button style={S.tab(tab==='rules')} onClick={() => setTab('rules')}>Bot Rules ({rules.length})</button>
            <button style={S.tab(tab==='log')}   onClick={() => setTab('log')}>Conversation Log ({convTotal})</button>
            <button style={S.tab(tab==='setup')} onClick={() => setTab('setup')}>Webhook Setup</button>
          </div>

          {tab === 'rules' && (
            <div>
              {editingRule ? (
                <div style={S.form}>
                  <h3 style={S.formTitle}>{editingRule.id ? 'Edit Rule' : 'New Rule'}</h3>

                  <div style={S.row}>
                    <div style={{ flex: 2, minWidth: 200 }}>
                      <label style={S.label}>Rule name</label>
                      <input style={S.input} value={editingRule.name} onChange={e => setEditingRule(r=>({...r,name:e.target.value}))} placeholder="e.g. Price enquiry auto-reply" />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={S.label}>Connected page / account</label>
                      <select style={S.sel} value={editingRule.account_id} onChange={e => {
                        const acct = accounts.find(a => a.account_id === e.target.value);
                        setEditingRule(r => ({ ...r, account_id: e.target.value, platform: acct?.platform || r.platform }));
                      }}>
                        <option value="">Select account</option>
                        {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_name} ({a.platform})</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={S.row}>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <label style={S.label}>Trigger</label>
                      <select style={S.sel} value={editingRule.trigger_type} onChange={e => setEditingRule(r=>({...r,trigger_type:e.target.value}))}>
                        <option value="keyword">Contains keyword(s)</option>
                        <option value="any">Any comment</option>
                        <option value="dm_any">Any DM</option>
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <label style={S.label}>Apply to</label>
                      <select style={S.sel} value={editingRule.scope} onChange={e => setEditingRule(r=>({...r,scope:e.target.value}))}>
                        <option value="comment">Comments only</option>
                        <option value="dm">DMs only</option>
                        <option value="both">Comments + DMs</option>
                      </select>
                    </div>
                    {editingRule.trigger_type === 'keyword' && (
                      <div style={{ flex: 1, minWidth: 130 }}>
                        <label style={S.label}>Match mode</label>
                        <select style={S.sel} value={editingRule.match_mode} onChange={e => setEditingRule(r=>({...r,match_mode:e.target.value}))}>
                          <option value="any">Match ANY keyword</option>
                          <option value="all">Match ALL keywords</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {editingRule.trigger_type === 'keyword' && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={S.label}>Keywords (press Enter to add)</label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input style={{ ...S.input, flex: 1 }} value={kwInput}
                          onChange={e => setKwInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKw(); }}}
                          placeholder="price, cost, how much..." />
                        <button style={S.secBtn} onClick={addKw}>Add</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {editingRule.keywords.map(kw => (
                          <span key={kw} style={S.kw}>{kw}<span style={S.kwX} onClick={() => removeKw(kw)}>x</span></span>
                        ))}
                        {editingRule.keywords.length === 0 && <span style={{ color: '#6B7280', fontSize: 13 }}>No keywords yet</span>}
                      </div>
                    </div>
                  )}

                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '14px 0' }} />
                  <p style={{ ...S.label, marginBottom: 12 }}>Actions (choose at least one)</p>

                  <div style={{ marginBottom: 10 }}>
                    <label style={S.label}>Reply to comment publicly (leave blank to skip)</label>
                    <textarea style={S.ta} value={editingRule.reply_comment||''} onChange={e => setEditingRule(r=>({...r,reply_comment:e.target.value}))} placeholder="Great question! DM us for details" />
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={S.label}>Send DM to commenter (leave blank to skip)</label>
                    <textarea style={S.ta} value={editingRule.reply_dm||''} onChange={e => setEditingRule(r=>({...r,reply_dm:e.target.value}))} placeholder="Hi! Thanks for asking. Our plans start at..." />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Toggle on={editingRule.like_comment} onChange={v => setEditingRule(r=>({...r,like_comment:v}))} />
                    <span style={{ fontSize: 14, color: editingRule.like_comment ? '#E9D5FF' : '#6B7280' }}>Auto-like the comment</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button style={S.saveBtn} onClick={saveRule} disabled={saving}>{saving ? 'Saving...' : 'Save Rule'}</button>
                    <button style={S.secBtn} onClick={() => { setEditingRule(null); setErr(''); }}>Cancel</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                      <Toggle on={editingRule.is_active} onChange={v => setEditingRule(r=>({...r,is_active:v}))} />
                      <span style={{ fontSize: 13, color: '#9CA3AF' }}>Active</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 18 }}>
                  {accounts.length === 0 ? (
                    <div style={S.setupBox}>
                      <strong style={{ color: '#FCD34D' }}>No connected pages yet.</strong>
                      <span style={{ color: '#D8B4FE', marginLeft: 8 }}>Connect Facebook or Instagram first.</span>
                      <button style={{ ...S.secBtn, marginLeft: 10 }} onClick={() => router.push('/modules/social_media/setup')}>Account Setup</button>
                    </div>
                  ) : (
                    <button style={S.saveBtn} onClick={() => {
                      setEditingRule({ ...BLANK_RULE, account_id: accounts[0]?.account_id || '', platform: accounts[0]?.platform || 'facebook' });
                      setErr(''); setNotice('');
                    }}>+ New Rule</button>
                  )}
                </div>
              )}

              {loading ? (
                <div style={S.empty}>Loading...</div>
              ) : rules.length === 0 && !editingRule ? (
                <div style={S.empty}>No rules yet. Create a rule and the bot will start replying automatically.</div>
              ) : (
                rules.map(rule => {
                  const meta = pm(rule.platform);
                  return (
                    <div key={rule.id} style={{ ...S.card, borderLeft: `3px solid ${rule.is_active ? meta.color : '#374151'}`, opacity: rule.is_active ? 1 : 0.6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: meta.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {meta.svg(meta.color)}
                        </div>
                        <strong style={{ fontSize: 15, color: '#E9D5FF', flex: 1 }}>{rule.name}</strong>
                        <Toggle on={rule.is_active} onChange={() => toggleRule(rule)} />
                        <button style={S.secBtn} onClick={() => { setEditingRule({...rule}); setErr(''); setNotice(''); setKwInput(''); }}>Edit</button>
                        <button style={S.dangerBtn} onClick={() => deleteRule(rule.id)}>Delete</button>
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={S.pill('#C4B5FD','rgba(124,58,237,0.25)')}>
                          {rule.trigger_type === 'keyword' ? `Keywords: ${rule.keywords.join(', ') || 'none'}` : rule.trigger_type === 'any' ? 'Any comment' : 'Any DM'}
                        </span>
                        <span style={S.pill('#9CA3AF','rgba(255,255,255,0.06)')}>
                          {rule.scope === 'both' ? 'Comments + DMs' : rule.scope}
                        </span>
                        {rule.reply_comment && <span style={S.pill('#93C5FD','rgba(30,58,138,0.35)')}>Comment reply</span>}
                        {rule.reply_dm      && <span style={S.pill('#6EE7B7','rgba(6,78,59,0.4)')}>DM</span>}
                        {rule.like_comment  && <span style={S.pill('#FCA5A5','rgba(127,29,29,0.4)')}>Auto-like</span>}
                      </div>
                      {rule.reply_comment && (
                        <div style={{ marginTop: 8, fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>
                          "{rule.reply_comment.slice(0,120)}{rule.reply_comment.length>120?'...':''}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'log' && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <button style={S.tab(convFilter==='all')}       onClick={() => setConvFilter('all')}>All</button>
                <button style={S.tab(convFilter==='unmatched')} onClick={() => setConvFilter('unmatched')}>Unmatched</button>
                <span style={{ color: '#9CA3AF', fontSize: 13, marginLeft: 'auto' }}>{convTotal} total</span>
                <button style={S.secBtn} onClick={() => loadConvs(convPage)}>Refresh</button>
              </div>

              {convs.length === 0 ? (
                <div style={S.empty}>No conversations logged yet. The bot logs everything as soon as it receives events from Meta.</div>
              ) : (
                <>
                  {convs.map(c => {
                    const meta = pm(c.platform);
                    return (
                      <div key={c.id} style={S.convRow}>
                        <div style={{ ...S.convIcon, background: meta.color + '22' }}>{meta.svg(meta.color)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                            <span style={S.pill('#9CA3AF','rgba(255,255,255,0.06)')}>{c.event_type}</span>
                            <ActionBadge action={c.action_taken} />
                            {c.rule_name && <span style={{ fontSize: 12, color: '#6B7280' }}>Rule: {c.rule_name}</span>}
                            <span style={{ fontSize: 12, color: '#4B5563', marginLeft: 'auto' }}>{fmtDate(c.created_at)}</span>
                          </div>
                          {c.sender_name && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 3 }}>From: {c.sender_name}</div>}
                          <div style={{ fontSize: 14, color: '#D8B4FE', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.message_in}</div>
                          {c.reply_sent && (
                            <div style={{ fontSize: 13, color: '#6EE7B7', marginTop: 4, fontStyle: 'italic' }}>Reply: {c.reply_sent.slice(0,200)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {convTotal > 30 && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
                      {convPage > 1 && <button style={S.secBtn} onClick={() => loadConvs(convPage-1)}>Prev</button>}
                      <span style={{ color: '#9CA3AF', fontSize: 14, alignSelf: 'center' }}>Page {convPage} of {Math.ceil(convTotal/30)}</span>
                      {convPage < Math.ceil(convTotal/30) && <button style={S.secBtn} onClick={() => loadConvs(convPage+1)}>Next</button>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'setup' && (
            <div>
              <div style={{ ...S.card, borderLeft: '3px solid #FCD34D' }}>
                <h3 style={{ marginTop: 0, color: '#FCD34D', fontSize: 16 }}>One-time Meta webhook setup</h3>
                <p style={{ color: '#D8B4FE', fontSize: 14, lineHeight: 1.7 }}>
                  Register your webhook with Meta once so Facebook and Instagram send comment and DM events to your server automatically.
                </p>
                <ol style={{ color: '#E9D5FF', fontSize: 14, lineHeight: 2.2, paddingLeft: 20 }}>
                  <li>Go to Meta for Developers, open your App, then Webhooks</li>
                  <li>Click Subscribe to a Page</li>
                  <li>Set Callback URL to: <code style={{ background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 6, fontSize: 13 }}>{webhookUrl}</code></li>
                  <li>Set Verify Token to the value of META_WEBHOOK_VERIFY_TOKEN in your .env.local</li>
                  <li>Subscribe to fields: messages, feed, mention</li>
                  <li>Click Verify and Save</li>
                </ol>
                <p style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>
                  Add META_WEBHOOK_VERIFY_TOKEN=any-secret-string to your .env.local and Vercel environment variables.
                </p>
              </div>
              <div style={{ ...S.card, borderLeft: '3px solid #6EE7B7', marginTop: 16 }}>
                <h3 style={{ marginTop: 0, color: '#6EE7B7', fontSize: 16 }}>Step 2 — Subscribe your Facebook Pages</h3>
                <p style={{ color: '#D8B4FE', fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
                  After registering the webhook above, each Facebook Page must also be individually subscribed. Click the button next to each page below.
                </p>
                {accounts.filter(a => a.platform === 'facebook').length === 0 ? (
                  <div style={{ color: '#6B7280', fontSize: 14 }}>No Facebook pages connected yet. Go to Account Setup first.</div>
                ) : (
                  accounts.filter(a => a.platform === 'facebook').map(a => {
                    const result = subResult[a.account_id];
                    return (
                      <div key={a.account_id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                        <span style={{ flex: 1, fontSize: 14, color: '#E9D5FF' }}>{a.account_name}</span>
                        {result === 'ok' && <span style={S.pill('#6EE7B7', 'rgba(6,78,59,0.4)')}>✓ Subscribed</span>}
                        {result && result !== 'ok' && <span style={{ fontSize: 12, color: '#FCA5A5' }}>{result}</span>}
                        <button
                          style={S.saveBtn}
                          disabled={subscribing[a.account_id]}
                          onClick={() => subscribePage(a.account_id)}
                        >
                          {subscribing[a.account_id] ? 'Subscribing…' : result === 'ok' ? 'Re-subscribe' : 'Subscribe Page'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={S.card}>
                <h3 style={{ marginTop: 0, color: '#E9D5FF', fontSize: 16 }}>How it works</h3>
                {[
                  ['1', 'Someone comments "price" on your Facebook post'],
                  ['2', 'Meta sends that event to your webhook URL instantly'],
                  ['3', 'Your bot matches it against your rules (keyword: "price")'],
                  ['4', 'Bot replies to comment and/or sends a DM automatically'],
                  ['5', 'Everything is logged in the Conversation Log tab'],
                ].map(([n, text]) => (
                  <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(124,58,237,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{n}</div>
                    <span style={{ fontSize: 14, color: '#D8B4FE' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
