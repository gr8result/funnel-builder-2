// /pages/modules/social_media/ads.js
// Paid Ads launcher — Meta Ads API integration (Facebook & Instagram).
// STATUS: UI complete. Requires ads_management + ads_read App Review approval before launch.
// Not included in v1 platform release.

import Head from 'next/head';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import AIWriterAssist from '../../../components/ui/AIWriterAssist';
import { supabase } from '../../../utils/supabase-client';

const PLATFORM_META = {
  facebook:  { color: '#1877F2', label: 'Facebook',  icon: '📘' },
  instagram: { color: '#E1606C', label: 'Instagram', icon: '📷' },
};

const OBJECTIVES = [
  { key: 'AWARENESS',   label: '📣 Brand Awareness',  desc: 'Reach people likely to remember your ad' },
  { key: 'TRAFFIC',     label: '🔗 Traffic',           desc: 'Send people to a destination (website, app, etc.)' },
  { key: 'ENGAGEMENT',  label: '💬 Engagement',        desc: 'Get more post reactions, comments and shares' },
  { key: 'LEADS',       label: '📋 Lead Generation',  desc: 'Collect leads with an instant form' },
  { key: 'SALES',       label: '💰 Sales / Conversions', desc: 'Drive purchases or conversions on your site' },
];

const CTA_OPTIONS = [
  'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'CONTACT_US', 'BOOK_NOW', 'DOWNLOAD', 'GET_OFFER', 'WATCH_MORE',
];

const BUDGET_TYPES = [
  { key: 'DAILY',    label: 'Daily Budget',    desc: 'Spend up to this amount per day' },
  { key: 'LIFETIME', label: 'Lifetime Budget', desc: 'Spend this amount over the full campaign run' },
];

const DEFAULT_FORM = {
  // Campaign
  campaignName:   '',
  objective:      'TRAFFIC',
  // Budget
  budgetType:     'DAILY',
  budgetAmount:   '',
  startDate:      '',
  endDate:        '',
  // Audience
  ageMin:         '18',
  ageMax:         '65',
  locations:      '',   // comma-separated country/city names
  interests:      '',   // comma-separated interest keywords
  // Placement
  platforms:      ['facebook', 'instagram'],
  // Ad creative
  pageId:         '',
  adAccountId:    '',
  headline:       '',
  primaryText:    '',
  description:    '',
  destinationUrl: '',
  ctaButton:      'SIGN_UP',
  imageUrl:       '',   // uploaded creative URL
  // Lead Gen Instant Form
  formTitle:             '',
  formIntroHeadline:     '',
  formIntroBody:         '',
  formPrivacyUrl:        '',
  formThankYouHeadline:  "Thanks for your interest!",
  formThankYouBody:      "We'll be in touch soon.",
  formRedirectUrl:       '',
};

const PREFILLED_FIELDS = [
  { key: 'EMAIL',      label: 'Email Address',  icon: '✉️' },
  { key: 'FULL_NAME',  label: 'Full Name',       icon: '👤' },
  { key: 'PHONE',      label: 'Phone Number',    icon: '📞' },
  { key: 'DOB',        label: 'Date of Birth',   icon: '🎂' },
  { key: 'CITY',       label: 'City',            icon: '🏙️' },
  { key: 'STATE',      label: 'State / Region',  icon: '🗺️' },
  { key: 'COUNTRY',    label: 'Country',         icon: '🌍' },
];

const QUESTION_TYPES = [
  { key: 'prefilled',       label: '⚡ Pre-filled',      desc: 'Auto-fills from Facebook profile' },
  { key: 'short_answer',    label: '✏️ Short Answer',    desc: 'Text input' },
  { key: 'multiple_choice', label: '🔘 Multiple Choice', desc: 'Pick one option' },
  { key: 'appointment',     label: '📅 Appointment',     desc: 'Date/time picker' },
];

let _qid = 1;
function newQuestion(type) {
  return { id: _qid++, type, label: '', options: ['', ''], required: true, prefilledKey: 'EMAIL' };
}

const S = {
  page:          { minHeight: '100vh', background: '#1f0420', padding: '0 20px 48px', fontFamily: 'system-ui,sans-serif', color: '#F3F0FF' },
  shell:         { maxWidth: 1320, margin: '0 auto', padding: '0' },
  banner:        { maxWidth: 1320, margin: '16px auto 0', background: 'linear-gradient(90deg,#b45309,#d97706)', borderRadius: 16, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  bannerLeft:    { display: 'flex', alignItems: 'center', gap: 16 },
  bannerIcon:    { background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 14px', fontSize: 24 },
  bannerTitle:   { fontSize: 48, fontWeight: 600, color: '#fff', margin: 0 },
  bannerSub:     { fontSize: 18, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  bannerNav:     { display: 'flex', gap: 8, flexWrap: 'wrap' },
  bannerBtn:     { padding: '9px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600, fontSize: 18, cursor: 'pointer', whiteSpace: 'nowrap' },
  // Status notice
  statusBar:     { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start' },
  statusIcon:    { fontSize: 22, flexShrink: 0, marginTop: 2 },
  statusText:    { fontSize: 16, color: '#FCD34D', lineHeight: 1.7 },
  // Layout
  section:       { marginTop: 28 },
  twoCol:        { display: 'grid', gridTemplateColumns: '1fr 400px', gap: 22, marginTop: 24, alignItems: 'start' },
  card:          { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(167,169,250,0.12)', borderRadius: 16, padding: '24px 26px' },
  sectionTitle:  { fontSize: 28, fontWeight: 600, color: '#E9D5FF', marginBottom: 18, marginTop: 0 },
  // Form elements
  label:         { fontSize: 16, color: '#9CA3AF', marginBottom: 6, display: 'block' },
  input:         { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '10px 14px', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  textarea:      { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '10px 14px', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', minHeight: 90 },
  select:        { width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '10px 14px', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  row:           { marginBottom: 18 },
  twoFieldRow:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 },
  // Objective cards
  objGrid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginBottom: 24 },
  objCard: (a)  => ({ padding: '14px 16px', borderRadius: 12, border: a ? '2px solid #d97706' : '1px solid rgba(167,169,250,0.18)', background: a ? 'rgba(217,119,6,0.18)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left' }),
  objLabel:      { fontSize: 16, fontWeight: 600, color: '#F3F0FF', marginBottom: 4 },
  objDesc:       { fontSize: 16, color: '#9CA3AF', lineHeight: 1.4 },
  // Platform toggles
  platRow:       { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 },
  platBtn: (a,c)=> ({ padding: '8px 18px', borderRadius: 20, border: a ? `2px solid ${c}` : '1px solid rgba(167,169,250,0.2)', background: a ? c + '22' : 'rgba(255,255,255,0.03)', color: a ? c : '#9CA3AF', fontWeight: 600, fontSize: 16, cursor: 'pointer' }),
  // Preview card
  previewCard:   { background: '#fff', borderRadius: 14, overflow: 'hidden', color: '#111', fontSize: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' },
  previewHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #eee' },
  previewAvatar: { width: 38, height: 38, borderRadius: '50%', background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 16, flexShrink: 0 },
  previewPage:   { fontWeight: 600, color: '#111', fontSize: 16 },
  previewSponsored: { fontSize: 16, color: '#65676B' },
  previewImage:  { width: '100%', minHeight: 200, background: 'linear-gradient(135deg,#e0e7ff,#f3e8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 },
  previewBody:   { padding: '12px 14px' },
  previewHeadline: { fontWeight: 600, fontSize: 16, color: '#111', marginBottom: 4 },
  previewDesc:   { fontSize: 16, color: '#65676B', marginBottom: 10 },
  previewCTA:    { display: 'inline-block', padding: '8px 18px', borderRadius: 6, background: '#1877F2', color: '#fff', fontWeight: 600, fontSize: 16 },
  // Launch button
  launchBtn:     { width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', background: 'rgba(180,83,9,0.35)', color: 'rgba(255,255,255,0.35)', fontSize: 18, fontWeight: 600, cursor: 'not-allowed', marginTop: 18 },
  launchBtnNote: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 10, lineHeight: 1.6 },
  // Steps
  stepBadge:     { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'rgba(217,119,6,0.4)', color: '#FCD34D', fontWeight: 600, fontSize: 20, flexShrink: 0, marginRight: 10 },
  divider:       { border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '22px 0' },
  hint:          { fontSize: 16, color: '#6B7280', marginTop: 4 },
  charCount: (n,max) => ({ fontSize: 16, color: n > max ? '#FCA5A5' : '#6B7280', textAlign: 'right', marginTop: 4 }),
  // Lead form builder
  qTypeGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, marginBottom: 18 },
  qTypeCard: (a)=> ({ padding: '10px 12px', borderRadius: 10, border: a ? '2px solid #d97706' : '1px solid rgba(167,169,250,0.18)', background: a ? 'rgba(217,119,6,0.15)' : 'rgba(255,255,255,0.03)', cursor: 'pointer' }),
  qBlock:        { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(167,169,250,0.15)', borderRadius: 12, padding: '16px', marginBottom: 12 },
  qBlockHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  qTag: (t)    => ({ fontSize: 16, padding: '3px 10px', borderRadius: 20, background: t === 'prefilled' ? 'rgba(99,102,241,0.2)' : t === 'multiple_choice' ? 'rgba(52,211,153,0.15)' : t === 'appointment' ? 'rgba(251,191,36,0.15)' : 'rgba(167,169,250,0.1)', color: t === 'prefilled' ? '#818CF8' : t === 'multiple_choice' ? '#34D399' : t === 'appointment' ? '#FCD34D' : '#C4B5FD', fontWeight: 600 }),
  removeBtn:     { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: 8, padding: '4px 12px', fontSize: 16, cursor: 'pointer', fontWeight: 600 },
  addQBtn:       { width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed rgba(217,119,6,0.4)', background: 'transparent', color: '#d97706', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  // Form preview (lead)
  fPreview:      { background: '#fff', borderRadius: 14, overflow: 'hidden', color: '#111', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', marginTop: 18 },
  fPreviewHeader:{ background: '#1877F2', padding: '18px 16px', color: '#fff' },
  fPreviewTitle: { fontWeight: 600, fontSize: 16, marginBottom: 4 },
  fPreviewIntro: { fontSize: 16, opacity: 0.9 },
  fPreviewBody:  { padding: '16px' },
  fPreviewField: { marginBottom: 14 },
  fPreviewLabel: { fontSize: 16, color: '#65676B', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  fPreviewInput: { width: '100%', border: '1px solid #ddd', borderRadius: 6, padding: '8px 12px', fontSize: 16, background: '#f9f9f9', boxSizing: 'border-box', color: '#111' },
  fPreviewCTA:   { width: '100%', padding: '12px', borderRadius: 8, background: '#1877F2', color: '#fff', fontWeight: 600, fontSize: 16, border: 'none', marginTop: 8, cursor: 'default' },
};

function Field({ label, hint, children }) {
  return (
    <div style={S.row}>
      {label && <label style={S.label}>{label}</label>}
      {children}
      {hint && <div style={S.hint}>{hint}</div>}
    </div>
  );
}

export default function AdsLauncher() {
  const router    = useRouter();
  const [form, setForm]           = useState(DEFAULT_FORM);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [leadQuestions, setLeadQ] = useState([
    newQuestion('prefilled'),  // Email pre-filled by default
  ]);
  const [addQType, setAddQType]   = useState('short_answer');

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        const { data } = await supabase
          .from('social_accounts')
          .select('platform,account_name,page_id,is_active')
          .eq('user_id', session.user.id)
          .in('platform', ['facebook', 'instagram']);
        setAccounts(data || []);
        if (data?.length) {
          setForm(f => ({ ...f, pageId: data[0].page_id || '' }));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  function togglePlatform(p) {
    setForm(f => {
      const next = f.platforms.includes(p)
        ? f.platforms.filter(x => x !== p)
        : [...f.platforms, p];
      return { ...f, platforms: next.length ? next : f.platforms }; // must keep at least one
    });
  }

  function addQuestion() {
    setLeadQ(qs => [...qs, newQuestion(addQType)]);
  }

  function removeQuestion(id) {
    setLeadQ(qs => qs.filter(q => q.id !== id));
  }

  function updateQuestion(id, field, val) {
    setLeadQ(qs => qs.map(q => q.id === id ? { ...q, [field]: val } : q));
  }

  function updateOption(id, idx, val) {
    setLeadQ(qs => qs.map(q => {
      if (q.id !== id) return q;
      const options = [...q.options];
      options[idx] = val;
      return { ...q, options };
    }));
  }

  function addOption(id) {
    setLeadQ(qs => qs.map(q => q.id === id ? { ...q, options: [...q.options, ''] } : q));
  }

  function removeOption(id, idx) {
    setLeadQ(qs => qs.map(q => {
      if (q.id !== id) return q;
      const options = q.options.filter((_, i) => i !== idx);
      return { ...q, options: options.length >= 1 ? options : q.options };
    }));
  }

  const pageOptions = useMemo(() =>
    accounts.filter(a => a.platform === 'facebook' && a.page_id),
    [accounts]
  );

  const fbPage = useMemo(() =>
    accounts.find(a => a.page_id === form.pageId) || accounts[0],
    [accounts, form.pageId]
  );

  const pageName = fbPage?.account_name || 'Your Page';
  const pageInitial = pageName.charAt(0).toUpperCase();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Head><title>Paid Ads — Social Media</title></Head>
      <div style={S.page}>

        {/* Banner */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div style={S.bannerIcon}>📣</div>
            <div>
              <h1 style={S.bannerTitle}>Paid Ads</h1>
              <div style={S.bannerSub}>Create and launch Facebook &amp; Instagram ad campaigns</div>
            </div>
          </div>
          <div style={S.bannerNav}>
            <button style={S.bannerBtn} onClick={() => router.push('/modules/social_media/roi')}>📊 ROI Analytics</button>
            <button style={S.bannerBtn} onClick={() => router.push('/modules/social_media/create')}>+ Create Posts</button>
            <button style={S.bannerBtn} onClick={() => router.push('/modules/social_media/dashboard')}>Back to Dashboard</button>
          </div>
        </div>

        <div style={S.shell}>

          {/* Status notice */}
          <div style={{ ...S.section }}>
            <div style={S.statusBar}>
              <div style={S.statusIcon}>🔒</div>
              <div style={S.statusText}>
                <strong>Under Development — Not active in v1.</strong><br />
                Launching ads requires <code>ads_management</code> and <code>ads_read</code> permissions from Meta App Review — a separate, higher-sensitivity review from <code>pages_manage_posts</code>. You can build and preview campaigns here, but the <strong>Launch Campaign</strong> button will remain disabled until those permissions are approved. A verified Meta Business Manager account and active ad account are also required.
              </div>
            </div>
          </div>

          <div style={S.twoCol}>

            {/* LEFT — Campaign builder */}
            <div>

              {/* Step 1: Objective */}
              <div style={S.card}>
                <p style={S.sectionTitle}><span style={S.stepBadge}>1</span> Campaign Objective</p>
                <div style={S.objGrid}>
                  {OBJECTIVES.map(obj => (
                    <div key={obj.key} style={S.objCard(form.objective === obj.key)} onClick={() => set('objective', obj.key)}>
                      <div style={S.objLabel}>{obj.label}</div>
                      <div style={S.objDesc}>{obj.desc}</div>
                    </div>
                  ))}
                </div>

                <Field label="Campaign Name">
                  <input
                    style={S.input}
                    placeholder="e.g. Spring Sale — Traffic Campaign"
                    value={form.campaignName}
                    onChange={e => set('campaignName', e.target.value)}
                  />
                </Field>
              </div>

              <hr style={S.divider} />

              {/* Step 2: Budget & Schedule */}
              <div style={S.card}>
                <p style={S.sectionTitle}><span style={S.stepBadge}>2</span> Budget &amp; Schedule</p>

                <div style={S.platRow}>
                  {BUDGET_TYPES.map(bt => (
                    <button key={bt.key} style={S.platBtn(form.budgetType === bt.key, '#d97706')} onClick={() => set('budgetType', bt.key)}>
                      {bt.label}
                    </button>
                  ))}
                </div>
                <div style={S.hint}>
                  {BUDGET_TYPES.find(b => b.key === form.budgetType)?.desc}
                </div>

                <div style={{ ...S.twoFieldRow, marginTop: 16 }}>
                  <Field label={`${form.budgetType === 'DAILY' ? 'Daily' : 'Lifetime'} Budget (AUD $)`}>
                    <input
                      style={S.input}
                      type="number" min="1" step="0.01"
                      placeholder="e.g. 20.00"
                      value={form.budgetAmount}
                      onChange={e => set('budgetAmount', e.target.value)}
                    />
                  </Field>
                  <div /> {/* spacer */}
                </div>

                <div style={S.twoFieldRow}>
                  <Field label="Start Date">
                    <input
                      style={S.input}
                      type="date" min={today}
                      value={form.startDate}
                      onChange={e => set('startDate', e.target.value)}
                    />
                  </Field>
                  <Field label="End Date (optional)">
                    <input
                      style={S.input}
                      type="date" min={form.startDate || today}
                      value={form.endDate}
                      onChange={e => set('endDate', e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <hr style={S.divider} />

              {/* Step 3: Audience */}
              <div style={S.card}>
                <p style={S.sectionTitle}><span style={S.stepBadge}>3</span> Audience Targeting</p>

                <div style={S.twoFieldRow}>
                  <Field label="Min Age">
                    <input style={S.input} type="number" min="18" max="65" value={form.ageMin} onChange={e => set('ageMin', e.target.value)} />
                  </Field>
                  <Field label="Max Age">
                    <input style={S.input} type="number" min="18" max="65" value={form.ageMax} onChange={e => set('ageMax', e.target.value)} />
                  </Field>
                </div>

                <Field label="Locations" hint="Comma-separated — e.g. Australia, New Zealand, United States">
                  <input
                    style={S.input}
                    placeholder="Australia, New Zealand"
                    value={form.locations}
                    onChange={e => set('locations', e.target.value)}
                  />
                </Field>

                <Field label="Interests" hint="Comma-separated keywords Meta will use to target — e.g. Digital marketing, Small business, Ecommerce">
                  <textarea
                    style={S.textarea}
                    placeholder="Digital marketing, Small business, Online shopping"
                    value={form.interests}
                    onChange={e => set('interests', e.target.value)}
                  />
                </Field>

                <div style={{ ...S.row }}>
                  <label style={S.label}>Placements</label>
                  <div style={S.platRow}>
                    {['facebook', 'instagram'].map(p => {
                      const meta = PLATFORM_META[p];
                      return (
                        <button key={p} style={S.platBtn(form.platforms.includes(p), meta.color)} onClick={() => togglePlatform(p)}>
                          {meta.icon} {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <hr style={S.divider} />

              {/* Step 4: Ad Creative */}
              <div style={S.card}>
                <p style={S.sectionTitle}><span style={S.stepBadge}>4</span> Ad Creative</p>

                {pageOptions.length > 0 && (
                  <Field label="Facebook Page to run ad from">
                    <select style={S.select} value={form.pageId} onChange={e => set('pageId', e.target.value)}>
                      {pageOptions.map(p => (
                        <option key={p.page_id} value={p.page_id}>{p.account_name}</option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Ad Account ID" hint="Found in Meta Business Manager → Ad Accounts (format: act_XXXXXXXX)">
                  <input
                    style={S.input}
                    placeholder="act_123456789"
                    value={form.adAccountId}
                    onChange={e => set('adAccountId', e.target.value)}
                  />
                </Field>

                <Field label="Image URL" hint="Upload to your image library first, then paste the URL here">
                  <input
                    style={S.input}
                    placeholder="https://..."
                    value={form.imageUrl}
                    onChange={e => set('imageUrl', e.target.value)}
                  />
                </Field>

                <Field label={`Headline (${form.headline.length}/40)`}>
                  <input
                    style={{ ...S.input, borderColor: form.headline.length > 40 ? '#FCA5A5' : undefined }}
                    placeholder="Short, punchy headline"
                    maxLength={60}
                    value={form.headline}
                    onChange={e => set('headline', e.target.value)}
                  />
                  <AIWriterAssist
                    value={form.headline}
                    contextLabel="social ad headline"
                    placeholder="Product, audience, tone..."
                    onApply={(text) => set('headline', text)}
                  />
                  <div style={S.charCount(form.headline.length, 40)}>{form.headline.length}/40 recommended</div>
                </Field>

                <Field label={`Primary Text (${form.primaryText.length}/125)`}>
                  <textarea
                    style={{ ...S.textarea, borderColor: form.primaryText.length > 125 ? '#FCA5A5' : undefined }}
                    placeholder="The main ad body copy — what you want people to read"
                    value={form.primaryText}
                    onChange={e => set('primaryText', e.target.value)}
                  />
                  <AIWriterAssist
                    value={form.primaryText}
                    contextLabel="social ad primary text"
                    placeholder="Pain point, benefit, hook..."
                    onApply={(text) => set('primaryText', text)}
                  />
                  <div style={S.charCount(form.primaryText.length, 125)}>{form.primaryText.length}/125 recommended</div>
                </Field>

                <Field label="Description (optional)">
                  <input
                    style={S.input}
                    placeholder="Additional line under the headline"
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                  />
                  <AIWriterAssist
                    value={form.description}
                    contextLabel="social ad description"
                    placeholder="Support line, trust angle, offer detail..."
                    onApply={(text) => set('description', text)}
                  />
                </Field>

                <div style={S.twoFieldRow}>
                  <Field label="Destination URL">
                    <input
                      style={S.input}
                      placeholder="https://yoursite.com/landing"
                      value={form.destinationUrl}
                      onChange={e => set('destinationUrl', e.target.value)}
                    />
                  </Field>
                  <Field label="Call-to-Action Button">
                    <select style={S.select} value={form.ctaButton} onChange={e => set('ctaButton', e.target.value)}>
                      {CTA_OPTIONS.map(c => (
                        <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <hr style={S.divider} />

              {/* Step 5: Instant Form */}
              <div style={S.card}>
                  <p style={S.sectionTitle}><span style={S.stepBadge}>5</span> Instant Form Builder</p>
                  <div style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 20, lineHeight: 1.7 }}>
                    People tap your ad and see this form directly inside Facebook/Instagram — no need to leave the app. You choose what info to collect, then they get sent to your website after submitting.
                  </div>

                  {/* Form title */}
                  <Field label="Form Name (internal)">
                    <input style={S.input} placeholder="e.g. May Leads Form" value={form.formTitle} onChange={e => set('formTitle', e.target.value)} />
                  </Field>

                  {/* Intro screen */}
                  <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '16px', marginBottom: 18 }}>
                    <div style={{ fontSize: 16, color: '#818CF8', fontWeight: 600, marginBottom: 12 }}>📖 Intro Screen</div>
                    <Field label="Headline">
                      <input style={S.input} placeholder="e.g. Get your free consultation" value={form.formIntroHeadline} onChange={e => set('formIntroHeadline', e.target.value)} />
                    </Field>
                    <Field label="Paragraph text (optional)">
                      <textarea style={S.textarea} placeholder="A short sentence about what they'll get..." value={form.formIntroBody} onChange={e => set('formIntroBody', e.target.value)} />
                    </Field>
                  </div>

                  {/* Questions */}
                  <div style={{ fontSize: 16, color: '#E9D5FF', fontWeight: 600, marginBottom: 12 }}>❓ Questions</div>
                  {leadQuestions.map((q, qi) => (
                    <div key={q.id} style={S.qBlock}>
                      <div style={S.qBlockHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16, color: '#6B7280' }}>#{qi + 1}</span>
                          <span style={S.qTag(q.type)}>{QUESTION_TYPES.find(t => t.key === q.type)?.label || q.type}</span>
                        </div>
                        <button style={S.removeBtn} onClick={() => removeQuestion(q.id)}>Remove</button>
                      </div>

                      {q.type === 'prefilled' ? (
                        <Field label="Pre-filled field">
                          <select style={S.select} value={q.prefilledKey} onChange={e => updateQuestion(q.id, 'prefilledKey', e.target.value)}>
                            {PREFILLED_FIELDS.map(pf => (
                              <option key={pf.key} value={pf.key}>{pf.icon} {pf.label}</option>
                            ))}
                          </select>
                          <div style={S.hint}>Facebook auto-fills this from the user&apos;s profile — they just confirm it.</div>
                        </Field>
                      ) : q.type === 'multiple_choice' ? (
                        <>
                          <Field label="Question label">
                            <input style={S.input} placeholder="e.g. What are you interested in?" value={q.label} onChange={e => updateQuestion(q.id, 'label', e.target.value)} />
                          </Field>
                          <div style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 8 }}>Options</div>
                          {q.options.map((opt, oi) => (
                            <div key={oi} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <input style={{ ...S.input, flex: 1 }} placeholder={`Option ${oi + 1}`} value={opt} onChange={e => updateOption(q.id, oi, e.target.value)} />
                              {q.options.length > 1 && (
                                <button style={S.removeBtn} onClick={() => removeOption(q.id, oi)}>✕</button>
                              )}
                            </div>
                          ))}
                          {q.options.length < 10 && (
                            <button style={{ ...S.addQBtn, marginTop: 0, fontSize: 16 }} onClick={() => addOption(q.id)}>+ Add Option</button>
                          )}
                        </>
                      ) : q.type === 'appointment' ? (
                        <Field label="Question label">
                          <input style={S.input} placeholder="e.g. When would you like to book?" value={q.label} onChange={e => updateQuestion(q.id, 'label', e.target.value)} />
                          <div style={S.hint}>Shows a date/time picker to the user.</div>
                        </Field>
                      ) : (
                        <Field label="Question label">
                          <input style={S.input} placeholder="e.g. What is your business name?" value={q.label} onChange={e => updateQuestion(q.id, 'label', e.target.value)} />
                        </Field>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <input type="checkbox" id={`req-${q.id}`} checked={q.required} onChange={e => updateQuestion(q.id, 'required', e.target.checked)} />
                        <label htmlFor={`req-${q.id}`} style={{ fontSize: 16, color: '#9CA3AF', cursor: 'pointer' }}>Required</label>
                      </div>
                    </div>
                  ))}

                  {/* Add question controls */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, marginBottom: 4 }}>
                    <select style={{ ...S.select, flex: 1, minWidth: 180 }} value={addQType} onChange={e => setAddQType(e.target.value)}>
                      {QUESTION_TYPES.map(t => (
                        <option key={t.key} value={t.key}>{t.label} — {t.desc}</option>
                      ))}
                    </select>
                    <button style={{ ...S.addQBtn, width: 'auto', padding: '10px 20px', marginTop: 0 }} onClick={addQuestion}>
                      + Add Question
                    </button>
                  </div>

                  {/* Privacy policy */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 18, marginTop: 18 }}>
                    <Field label="Privacy Policy URL" hint="Required by Meta for all lead gen forms">
                      <input style={{ ...S.input, borderColor: !form.formPrivacyUrl ? 'rgba(252,165,165,0.4)' : undefined }} placeholder="https://yoursite.com/privacy" value={form.formPrivacyUrl} onChange={e => set('formPrivacyUrl', e.target.value)} />
                    </Field>
                  </div>

                  {/* Thank you screen */}
                  <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '16px', marginTop: 8 }}>
                    <div style={{ fontSize: 16, color: '#34D399', fontWeight: 600, marginBottom: 12 }}>✅ Thank You Screen</div>
                    <Field label="Headline">
                      <input style={S.input} value={form.formThankYouHeadline} onChange={e => set('formThankYouHeadline', e.target.value)} />
                    </Field>
                    <Field label="Body text">
                      <textarea style={S.textarea} value={form.formThankYouBody} onChange={e => set('formThankYouBody', e.target.value)} />
                    </Field>
                    <Field label="Redirect to website after submit (optional)">
                      <input style={S.input} placeholder="https://yoursite.com/thank-you" value={form.formRedirectUrl} onChange={e => set('formRedirectUrl', e.target.value)} />
                    </Field>
                  </div>
                </div>

              {/* Disabled launch button */}
              <button style={S.launchBtn} disabled>
                🔒 Launch Campaign
              </button>
              <div style={S.launchBtnNote}>
                Requires <strong>ads_management</strong> permission approved via Meta App Review.<br />
                This feature is not active in v1 of the platform.
              </div>

            </div>

            {/* RIGHT — Preview + summary */}
            <div>
              <div style={S.card}>
                <p style={S.sectionTitle}>👁️ Ad Preview</p>
                <div style={S.previewCard}>
                  {/* Simulated Facebook feed card */}
                  <div style={S.previewHeader}>
                    <div style={S.previewAvatar}>{pageInitial}</div>
                    <div>
                      <div style={S.previewPage}>{pageName}</div>
                      <div style={S.previewSponsored}>Sponsored · {form.platforms.map(p => PLATFORM_META[p]?.label).join(' & ')}</div>
                    </div>
                  </div>
                  {form.primaryText && (
                    <div style={{ padding: '10px 14px 0', fontSize: 16, color: '#111', lineHeight: 1.6 }}>
                      {form.primaryText.slice(0, 200)}{form.primaryText.length > 200 ? '…' : ''}
                    </div>
                  )}
                  <div style={S.previewImage}>
                    {form.imageUrl
                      ? <img src={form.imageUrl} alt="ad creative" style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 260 }} />
                      : <span style={{ color: '#9CA3AF', fontSize: 16 }}>Image preview</span>
                    }
                  </div>
                  <div style={S.previewBody}>
                    {form.destinationUrl && (
                      <div style={{ fontSize: 16, color: '#65676B', marginBottom: 4, textTransform: 'uppercase' }}>
                        {form.destinationUrl.replace(/^https?:\/\//, '').split('/')[0]}
                      </div>
                    )}
                    <div style={S.previewHeadline}>{form.headline || 'Your headline here'}</div>
                    {form.description && <div style={S.previewDesc}>{form.description}</div>}
                    <div style={S.previewCTA}>{form.ctaButton.replace(/_/g, ' ')}</div>
                  </div>
                </div>
              </div>

              {/* Lead form preview */}
              <div style={{ marginTop: 18 }}>
                <div style={S.card}>
                  <p style={S.sectionTitle}>📋 Instant Form Preview</p>
                    <div style={S.fPreview}>
                      <div style={S.fPreviewHeader}>
                        <div style={S.fPreviewTitle}>{form.formIntroHeadline || 'Form headline'}</div>
                        {form.formIntroBody && <div style={S.fPreviewIntro}>{form.formIntroBody}</div>}
                      </div>
                      <div style={S.fPreviewBody}>
                        {leadQuestions.map((q, qi) => {
                          const pf = PREFILLED_FIELDS.find(f => f.key === q.prefilledKey);
                          const label = q.type === 'prefilled' ? pf?.label : (q.label || `Question ${qi + 1}`);
                          return (
                            <div key={q.id} style={S.fPreviewField}>
                              <div style={S.fPreviewLabel}>{label}{q.required ? ' *' : ''}</div>
                              {q.type === 'multiple_choice' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {q.options.filter(Boolean).map((opt, i) => (
                                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#111', cursor: 'pointer' }}>
                                      <input type="radio" name={`preview-${q.id}`} readOnly /> {opt}
                                    </label>
                                  ))}
                                  {q.options.every(o => !o) && <div style={{ fontSize: 16, color: '#9CA3AF' }}>Add options above</div>}
                                </div>
                              ) : q.type === 'appointment' ? (
                                <input type="datetime-local" style={S.fPreviewInput} readOnly disabled />
                              ) : (
                                <input
                                  style={S.fPreviewInput}
                                  placeholder={q.type === 'prefilled' ? `Auto-filled: ${pf?.label}` : 'Type your answer...'}
                                  readOnly
                                />
                              )}
                            </div>
                          );
                        })}
                        {leadQuestions.length === 0 && (
                          <div style={{ fontSize: 16, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>Add questions above to see them here</div>
                        )}
                        <button style={S.fPreviewCTA}>Submit</button>
                        {form.formPrivacyUrl && (
                          <div style={{ fontSize: 16, color: '#65676B', marginTop: 10, textAlign: 'center' }}>
                            By submitting you agree to our <span style={{ color: '#1877F2' }}>Privacy Policy</span>
                          </div>
                        )}
                      </div>
                      {/* Thank you screen preview */}
                      <div style={{ background: '#f0fdf4', padding: '14px 16px', borderTop: '1px solid #d1fae5' }}>
                        <div style={{ fontWeight: 600, fontSize: 16, color: '#065f46', marginBottom: 4 }}>✅ {form.formThankYouHeadline}</div>
                        <div style={{ fontSize: 16, color: '#047857' }}>{form.formThankYouBody}</div>
                        {form.formRedirectUrl && (
                          <div style={{ fontSize: 16, color: '#1877F2', marginTop: 6 }}>→ Redirects to: {form.formRedirectUrl}</div>
                        )}
                      </div>
                    </div>
                </div>
              </div>

              {/* Campaign summary */}
              <div style={{ ...S.card, marginTop: 18 }}>
                <p style={S.sectionTitle}>📋 Campaign Summary</p>
                <SummaryRow label="Objective"  value={OBJECTIVES.find(o => o.key === form.objective)?.label || '—'} />
                <SummaryRow label="Budget"     value={form.budgetAmount ? `$${form.budgetAmount} AUD (${form.budgetType === 'DAILY' ? 'daily' : 'lifetime'})` : '—'} />
                <SummaryRow label="Schedule"   value={form.startDate ? `${form.startDate}${form.endDate ? ` → ${form.endDate}` : ' (ongoing)'}` : '—'} />
                <SummaryRow label="Age Range"  value={`${form.ageMin}–${form.ageMax}`} />
                <SummaryRow label="Locations"  value={form.locations || '—'} />
                <SummaryRow label="Placements" value={form.platforms.map(p => PLATFORM_META[p]?.label).join(', ')} />
                <SummaryRow label="CTA"        value={form.ctaButton.replace(/_/g, ' ')} />
                {form.budgetAmount && form.startDate && form.endDate && (
                  <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(217,119,6,0.1)', borderRadius: 10, fontSize: 16, color: '#FCD34D', lineHeight: 1.7 }}>
                    {form.budgetType === 'DAILY'
                      ? (() => {
                          const days = Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000);
                          const total = (parseFloat(form.budgetAmount) * days).toFixed(2);
                          return days > 0 ? `Estimated total spend: $${total} AUD over ${days} days` : null;
                        })()
                      : `Fixed total spend: $${parseFloat(form.budgetAmount).toFixed(2)} AUD`
                    }
                  </div>
                )}
              </div>

              {/* What happens next */}
              <div style={{ ...S.card, marginTop: 18 }}>
                <p style={S.sectionTitle}>🚀 What Happens When Launched</p>
                <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 16, color: '#9CA3AF', lineHeight: 2 }}>
                  <li>Campaign created in Meta Ads Manager via API</li>
                  <li>Ad set built with your audience &amp; budget</li>
                  <li>Ad creative uploaded and linked</li>
                  <li>Campaign goes live on selected placements</li>
                  <li>Performance data will appear in ROI Analytics once connected</li>
                </ol>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 16, gap: 12 }}>
      <span style={{ color: '#6B7280', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#E9D5FF', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
