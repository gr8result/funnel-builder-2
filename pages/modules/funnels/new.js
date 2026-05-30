// pages/modules/funnels/new.js
// Funnel creation wizard:
// 1. Choose funnel type
// 2. Answer a few short questions

import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AuthGate from '../../../components/AuthGate';
import { FUNNEL_TYPES, assemblePage, getFunnelTemplateLibraryAssets } from '../../../lib/funnelSections';
import { supabase } from '../../../lib/supabaseClient';
import { getWebsiteBuilderAssets, saveWebsiteBuilderAssets } from '../../../lib/website-builder/projectStore';

export default function NewFunnelWizard() {
  return (
    <AuthGate>
      <Wizard />
    </AuthGate>
  );
}

function Wizard() {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [customTradeName, setCustomTradeName] = useState('');
  const [previewGroup, setPreviewGroup] = useState(null);
  const [previewVariantKey, setPreviewVariantKey] = useState('');
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [previewViewport, setPreviewViewport] = useState('desktop');
  const [showPreviewInfo, setShowPreviewInfo] = useState(false);
  const [startingFromScratch, setStartingFromScratch] = useState(false);
  const [answers, setAnswers] = useState({
    name: '',
    audience: '',
    result: '',
    details: '',
    style: '',
    price: '',
    accentColor: '#ef465d',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const syncSharedLibrary = async () => {
      const existingAssets = getWebsiteBuilderAssets();
      const funnelAssets = getFunnelTemplateLibraryAssets();

      if (cancelled) return;

      const existingBySrc = new Set((existingAssets.images || []).map((image) => String(image?.src || '').trim()).filter(Boolean));
      const missingAssets = funnelAssets.filter((image) => !existingBySrc.has(String(image?.src || '').trim()));
      if (!missingAssets.length) return;

      saveWebsiteBuilderAssets({
        ...existingAssets,
        images: [...missingAssets, ...(existingAssets.images || [])],
      });
    };

    syncSharedLibrary().catch((syncError) => {
      console.warn('Could not sync funnel template assets into the shared media library', syncError);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const canContinue = Boolean(answers.name.trim() && answers.audience.trim() && answers.result.trim());

  const templateGroups = useMemo(() => {
    const grouped = [];
    const map = new Map();

    for (const type of FUNNEL_TYPES) {
      const key = type.label;
      if (!map.has(key)) {
        const group = {
          key,
          label: type.label,
          icon: type.icon,
          accent: type.accent,
          descriptions: [],
          examples: new Set(),
          variants: [],
        };
        map.set(key, group);
        grouped.push(group);
      }

      const group = map.get(key);
      if (type.description && !group.descriptions.includes(type.description)) {
        group.descriptions.push(type.description);
      }
      for (const example of type.examples || []) {
        group.examples.add(example);
      }
      group.variants.push({ ...type, groupKey: key });
    }

    const resolvedGroups = grouped.map((group) => ({
      ...group,
      description: group.descriptions[0] || '',
      examples: Array.from(group.examples),
    }));

    if (!customTradeName) {
      return resolvedGroups;
    }

    const genericTradesGroup = resolvedGroups.find((group) => group.label === 'Trades / Local Service Quote');
    if (!genericTradesGroup) {
      return resolvedGroups;
    }

    const customKey = `custom-trade:${customTradeName.toLowerCase()}`;
    const customTradeGroup = {
      ...genericTradesGroup,
      key: customKey,
      label: `${customTradeName} Quote`,
      description: `Use the proven local-service layout, but positioned for ${customTradeName.toLowerCase()} enquiries from the first screen.`,
      examples: [
        `${customTradeName} leads`,
        'Local search traffic',
        'Quote requests',
      ],
      variants: genericTradesGroup.variants.map((variant) => ({
        ...variant,
        label: `${customTradeName} Quote`,
        description: `${variant.variant || 'This template'} is tuned to feel relevant for ${customTradeName.toLowerCase()} buyers while keeping the stronger local-service conversion structure.`,
        examples: [`${customTradeName} jobs`, 'Local service enquiries', 'Suburb-based traffic'],
        groupKey: customKey,
        customTradeName,
      })),
    };

    return [customTradeGroup, ...resolvedGroups];
  }, [customTradeName]);

  const funnelSummary = useMemo(() => {
    const offer = answers.name.trim();
    const audience = answers.audience.trim();
    const result = answers.result.trim();
    const details = answers.details.trim();
    const style = answers.style.trim();
    const segments = [];

    if (audience && result) {
      segments.push(`Built for ${audience} who want ${result}.`);
    }
    if (details) {
      segments.push(details);
    }
    if (style) {
      segments.push(`Tone: ${style}.`);
    }

    return {
      headline: offer ? `Discover ${offer}` : '',
      subheadline: audience && result ? `A funnel for ${audience} ready to ${result}.` : '',
      offerDescription: segments.join(' ').trim(),
      ctaText: selectedType?.id === 'lead-magnet' ? 'GET FREE ACCESS' : selectedType?.id === 'webinar' ? 'SAVE MY SEAT' : 'GET STARTED NOW',
    };
  }, [answers, selectedType]);

  const activePreviewVariant = useMemo(() => {
    if (!previewGroup) return null;
    return previewGroup.variants.find((variant) => `${variant.id}::${variant.groupKey}` === previewVariantKey)
      || previewGroup.variants[0]
      || null;
  }, [previewGroup, previewVariantKey]);

  const activePreviewPage = useMemo(() => {
    if (!activePreviewVariant) return null;
    return activePreviewVariant.pages?.[previewPageIndex] || activePreviewVariant.pages?.[0] || null;
  }, [activePreviewVariant, previewPageIndex]);

  const activePreviewHtml = useMemo(() => {
    if (!activePreviewPage?.sectionIds?.length) return '';
    try {
      return assemblePage(activePreviewPage.sectionIds);
    } catch {
      return '';
    }
  }, [activePreviewPage]);

  const activePreviewDocument = useMemo(() => {
    if (!activePreviewHtml) return '';
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${activePreviewPage?.title || 'Preview'}</title>
    <style>
      html, body { margin: 0; padding: 0; background: #ffffff; }
      body { overflow-x: hidden; }
      img { max-width: 100%; }
    </style>
  </head>
  <body>${activePreviewHtml}</body>
</html>`;
  }, [activePreviewHtml, activePreviewPage]);

  function updateAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function selectTemplate(variant) {
    setSelectedType(variant);
    setStep(2);
  }

  function openTemplatePreview(group, preferredVariant = null) {
    const initialVariant = preferredVariant || group?.variants?.[0] || null;
    setPreviewGroup(group);
    setPreviewVariantKey(initialVariant ? `${initialVariant.id}::${initialVariant.groupKey}` : '');
    setPreviewPageIndex(0);
    setPreviewViewport('desktop');
    setShowPreviewInfo(false);
  }

  function closeTemplatePreview() {
    setPreviewGroup(null);
    setPreviewVariantKey('');
    setPreviewPageIndex(0);
    setPreviewViewport('desktop');
    setShowPreviewInfo(false);
  }

  function normalizeTradeName(value) {
    return `${value || ''}`
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  function addCustomTrade() {
    const nextTrade = window.prompt('Enter your trade or service', customTradeName || '');
    if (nextTrade === null) return;

    const normalizedTrade = normalizeTradeName(nextTrade);
    if (!normalizedTrade) return;

    setCustomTradeName(normalizedTrade);

    if (step !== 1) {
      setStep(1);
    }
  }

  function normalizeOfferName(value) {
    return `${value || ''}`
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => {
        if (/^[A-Z0-9]{2,}$/.test(word)) return word;
        if (/^GR8$/i.test(word)) return 'GR8';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  async function buildBrandPayload() {
    const normalizedName = normalizeOfferName(answers.name);
    const baseDescription = [
      answers.audience ? `Audience: ${answers.audience.trim()}.` : '',
      answers.result ? `Primary result: ${answers.result.trim()}.` : '',
      answers.details ? `Offer details: ${answers.details.trim()}.` : '',
      answers.style ? `Preferred tone: ${answers.style.trim()}.` : '',
      selectedType?.label ? `Funnel type: ${selectedType.label}.` : '',
    ].filter(Boolean).join(' ');

    const fallbackBrand = {
      name: normalizedName,
      headline: funnelSummary.headline,
      subheadline: funnelSummary.subheadline,
      offerDescription: baseDescription || funnelSummary.offerDescription || `${normalizedName} helps ${answers.audience.trim()} ${answers.result.trim()}.`,
      ctaText: funnelSummary.ctaText,
      price: answers.price.trim(),
      accentColor: answers.accentColor,
      audience: answers.audience.trim(),
      primaryResult: answers.result.trim(),
      style: answers.style.trim(),
    };

    try {
      const res = await fetch('/api/funnels/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: fallbackBrand.name,
          headline: `${answers.audience.trim()} ${answers.result.trim()}`.trim(),
          description: fallbackBrand.offerDescription,
          funnelType: selectedType?.label || selectedType?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) return fallbackBrand;
      return {
        ...fallbackBrand,
        name: json.offerName || fallbackBrand.name,
        headline: json.headline || fallbackBrand.headline,
        subheadline: json.subheadline || fallbackBrand.subheadline,
        ctaText: json.ctaText || fallbackBrand.ctaText,
        offerDescription: json.offerDescription || fallbackBrand.offerDescription,
      };
    } catch {
      return fallbackBrand;
    }
  }

  async function createFunnel() {
    if (!canContinue || !selectedType) return;
    setCreating(true);
    setError('');
    try {
      const brand = await buildBrandPayload();
      const { supabase } = await import('../../../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/funnels/create-with-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ funnelTypeId: selectedType.id, brand, userId: session?.user?.id, useAI: true }),
      });
      const json = await res.json();
      if (json.ok && json.funnelId) {
        window.location.href = `/modules/funnels/edit/${json.funnelId}`;
      } else {
        setError(json.error || 'Failed to create funnel');
        setCreating(false);
      }
    } catch (e) {
      setError('Request failed: ' + e.message);
      setCreating(false);
    }
  }

  async function startFromScratch() {
    if (startingFromScratch) return;

    setStartingFromScratch(true);
    setError('');

    try {
      const { supabase } = await import('../../../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        setError('You need to be signed in to start a blank funnel.');
        setStartingFromScratch(false);
        return;
      }

      const funnelName = customTradeName ? `${customTradeName} Funnel` : 'Blank Funnel';
      const slug = `${funnelName}`
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-]+|[-]+$/g, '')
        .slice(0, 80) + '-' + Math.random().toString(36).slice(2, 7);

      const funnelInsert = await supabase
        .from('funnels')
        .insert({
          owner_user_id: userId,
          name: funnelName,
          slug,
          status: 'draft',
        })
        .select('id')
        .single();

      if (funnelInsert.error || !funnelInsert.data?.id) {
        throw new Error(funnelInsert.error?.message || 'Could not create blank funnel');
      }

      const stepInsert = await supabase
        .from('funnel_steps')
        .insert({
          funnel_id: funnelInsert.data.id,
          title: 'Page 1',
          content: '',
          order_index: 0,
        });

      if (stepInsert.error) {
        await supabase.from('funnels').delete().eq('id', funnelInsert.data.id);
        throw new Error(stepInsert.error.message || 'Could not create blank page');
      }

      window.location.href = `/modules/funnels/edit/${funnelInsert.data.id}`;
    } catch (e) {
      setError('Request failed: ' + e.message);
      setStartingFromScratch(false);
    }
  }

  return (
    <>
      <Head><title>New Funnel - Funnel Builder</title></Head>

      <div style={{ minHeight: '100vh', background: '#0c121a', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 16px' }}>
          <div style={{
            background: 'linear-gradient(135deg,#ef465d 0%,#b5224a 100%)',
            borderRadius: 16, padding: '22px 28px',
            margin: '16px auto 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '50%', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 36 }}>🧭</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 48, fontWeight: 600, color: '#fff' }}>Create New Funnel</h1>
                <p style={{ margin: '4px 0 0', fontSize: 18, color: 'rgba(255,255,255,0.88)' }}>
                  Answer a few short questions and the AI will build the funnel for you.
                </p>
              </div>
            </div>
            <Link href="/modules/funnels">
              <button style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '10px 22px', fontSize: 18, fontWeight: 600, cursor: 'pointer' }}>
                ← Back
              </button>
            </Link>
          </div>
        </div>

        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 16px 32px' }}>
          <div style={{ display: 'flex', gap: 0, alignItems: 'center', marginBottom: 40 }}>
            {[1, 2].map((n) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < 2 ? 1 : 'none' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: step >= n ? '#ef465d' : '#1e2d45',
                  border: step === n ? '3px solid #f87171' : '3px solid transparent',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: 18,
                }}>
                  {step > n ? '✓' : n}
                </div>
                <div style={{ marginLeft: 10, marginRight: n < 2 ? 16 : 0 }}>
                  <p style={{ margin: 0, color: step >= n ? '#fff' : '#64748b', fontWeight: 600, fontSize: 16 }}>
                    {n === 1 ? 'Funnel Type' : 'Quick Answers'}
                  </p>
                </div>
                {n < 2 && <div style={{ flex: 1, height: 2, background: step > n ? '#ef465d' : '#1e2d45', margin: '0 16px 0 0' }} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                <h2 style={{ color: '#e6eef5', fontSize: 28, fontWeight: 600, margin: 0 }}>Choose the template you want to start from</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {customTradeName ? (
                    <span style={{
                      background: 'rgba(56,189,248,0.15)',
                      color: '#7dd3fc',
                      border: '1px solid rgba(56,189,248,0.35)',
                      borderRadius: 999,
                      padding: '8px 12px',
                      fontSize: 16,
                      fontWeight: 600,
                    }}>
                      Showing: {customTradeName}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={addCustomTrade}
                    style={{
                      background: 'linear-gradient(135deg,#0ea5e9,#2563eb)',
                      color: '#eff6ff',
                      border: '1px solid rgba(125,211,252,0.35)',
                      borderRadius: 999,
                      padding: '10px 16px',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 10px 30px rgba(37,99,235,0.18)',
                    }}
                  >
                    + Add Your Trade
                  </button>
                </div>
              </div>
              <p style={{ color: '#cbd5e1', fontSize: 18, margin: '0 0 32px' }}>Pick a funnel structure or an industry-specific landing page. Long-form templates are better for colder traffic. Short-form templates are better for warm traffic and faster conversions.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
                {templateGroups.map((group) => {
                  const activeVariant = group.variants.find((variant) => variant.id === selectedType?.id && variant.groupKey === selectedType?.groupKey) || group.variants[0];
                  const isSelected = group.variants.some((variant) => variant.id === selectedType?.id && variant.groupKey === selectedType?.groupKey);
                  const longVariant = group.variants.find((variant) => `${variant.variant || ''}`.toLowerCase().includes('long')) || group.variants[0] || null;
                  const shortVariant = group.variants.find((variant) => `${variant.variant || ''}`.toLowerCase().includes('short')) || null;

                  return (
                    <div
                      key={group.key}
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg,${group.accent}22,${group.accent}44)`
                          : '#111827',
                        border: isSelected
                          ? `2px solid ${group.accent}`
                          : '2px solid #1e2d45',
                        borderRadius: 16,
                        padding: '28px 24px',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ fontSize: 40 }}>{group.icon}</div>
                        {group.variants.length > 1 ? (
                          <span style={{
                            background: `${group.accent}22`, color: group.accent,
                            border: `1px solid ${group.accent}44`,
                            borderRadius: 999, padding: '6px 10px', fontSize: 16, fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>{activeVariant.variant || 'Template'}</span>
                        ) : null}
                      </div>
                      <h3 style={{ color: '#e6eef5', fontSize: 22, fontWeight: 600, margin: '0 0 10px' }}>{group.label}</h3>
                      <p style={{ color: '#cbd5e1', fontSize: 16, margin: '0 0 18px', lineHeight: 1.5 }}>{activeVariant.description || group.description}</p>
                      {group.examples.length ? (
                        <p style={{ color: '#94a3b8', fontSize: 16, margin: '0 0 16px', lineHeight: 1.5 }}>
                          Ideal for: {group.examples.join(', ')}
                        </p>
                      ) : null}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {longVariant ? (
                            <button
                              type="button"
                              onClick={() => openTemplatePreview(group, longVariant)}
                              style={{
                                background: 'rgba(15,23,42,0.6)',
                                color: '#dbeafe',
                                border: '1px solid #334155',
                                borderRadius: 999,
                                padding: '8px 14px',
                                fontSize: 16,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              View Long
                            </button>
                          ) : null}
                          {shortVariant ? (
                            <button
                              type="button"
                              onClick={() => openTemplatePreview(group, shortVariant)}
                              style={{
                                background: 'rgba(15,23,42,0.6)',
                                color: '#dbeafe',
                                border: '1px solid #334155',
                                borderRadius: 999,
                                padding: '8px 14px',
                                fontSize: 16,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              View Short
                            </button>
                          ) : null}
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 16, fontWeight: 600 }}>
                          Preview the full page before choosing
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {activeVariant.pages.map((page) => (
                          <span key={`${activeVariant.id}-${page.title}`} style={{
                            background: `${group.accent}22`, color: group.accent,
                            border: `1px solid ${group.accent}44`,
                            borderRadius: 6, padding: '4px 10px', fontSize: 16, fontWeight: 600,
                          }}>{page.title}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {previewGroup ? (
            <div
              role="dialog"
              aria-modal="true"
              onClick={closeTemplatePreview}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2,6,23,0.82)',
                backdropFilter: 'blur(6px)',
                display: 'block',
                padding: 0,
                zIndex: 1000,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'relative',
                  width: '100vw',
                  height: '100vh',
                  overflow: 'hidden',
                  background: '#020617',
                }}
              >
                <div style={{ position: 'absolute', inset: 16, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 2 }}>
                  <div style={{ display: 'grid', gap: 12, alignSelf: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{
                        pointerEvents: 'auto',
                        display: 'grid',
                        gap: 10,
                        padding: '16px 18px',
                        borderRadius: 20,
                        background: 'rgba(2,6,23,0.72)',
                        border: `1px solid ${previewGroup.accent}40`,
                        backdropFilter: 'blur(10px)',
                        maxWidth: 760,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ fontSize: 34 }}>{previewGroup.icon}</div>
                          <div>
                            <p style={{ color: previewGroup.accent, fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.3, margin: 0 }}>Template Preview</p>
                            <h3 style={{ color: '#f8fafc', fontSize: 28, fontWeight: 600, margin: '4px 0 0' }}>{previewGroup.label}</h3>
                          </div>
                        </div>
                        <p style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1.5, margin: 0 }}>{previewGroup.description}</p>
                      </div>

                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', pointerEvents: 'auto' }}>
                        <button
                          type="button"
                          onClick={() => setShowPreviewInfo((current) => !current)}
                          style={{
                            background: showPreviewInfo ? `${previewGroup.accent}22` : 'rgba(2,6,23,0.72)',
                            color: '#e2e8f0',
                            border: showPreviewInfo ? `1px solid ${previewGroup.accent}55` : '1px solid #334155',
                            borderRadius: 999,
                            padding: '10px 14px',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          {showPreviewInfo ? 'Hide Info' : 'Info'}
                        </button>
                        <button
                          type="button"
                          onClick={closeTemplatePreview}
                          style={{
                            background: 'rgba(2,6,23,0.72)',
                            color: '#e2e8f0',
                            border: '1px solid #334155',
                            borderRadius: 999,
                            padding: '10px 14px',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', pointerEvents: 'auto' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      {previewGroup.variants.map((variant) => {
                        const variantKey = `${variant.id}::${variant.groupKey}`;
                        const isActive = variantKey === previewVariantKey;
                        return (
                          <button
                            key={variantKey}
                            type="button"
                            onClick={() => {
                              setPreviewVariantKey(variantKey);
                              setPreviewPageIndex(0);
                            }}
                            style={{
                              background: isActive ? previewGroup.accent : 'rgba(15,23,42,0.7)',
                              color: isActive ? '#08111c' : '#e2e8f0',
                              border: isActive ? `1px solid ${previewGroup.accent}` : '1px solid #334155',
                              borderRadius: 999,
                              padding: '10px 14px',
                              fontSize: 16,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {variant.variant || 'Template'}
                          </button>
                        );
                      })}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                        {activePreviewVariant ? (
                          <span style={{
                            background: `${previewGroup.accent}22`,
                            color: previewGroup.accent,
                            border: `1px solid ${previewGroup.accent}44`,
                            borderRadius: 999,
                            padding: '8px 12px',
                            fontSize: 16,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>
                            {activePreviewVariant.pages.length} pages
                          </span>
                        ) : null}
                        {[
                          { id: 'desktop', label: 'Full Page' },
                          { id: 'mobile', label: 'Mobile' },
                        ].map((option) => {
                          const isActive = previewViewport === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setPreviewViewport(option.id)}
                              style={{
                                background: isActive ? previewGroup.accent : 'rgba(2,6,23,0.72)',
                                color: isActive ? '#08111c' : '#e2e8f0',
                                border: isActive ? `1px solid ${previewGroup.accent}` : '1px solid #334155',
                                borderRadius: 999,
                                padding: '8px 12px',
                                fontSize: 16,
                                fontWeight: 600,
                                cursor: 'pointer',
                                backdropFilter: 'blur(10px)',
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {showPreviewInfo ? (
                    <div style={{
                      display: 'grid',
                      gap: 14,
                      padding: '14px 16px',
                      borderRadius: 20,
                      border: '1px solid #1e293b',
                      background: 'rgba(2,6,23,0.72)',
                      backdropFilter: 'blur(10px)',
                      pointerEvents: 'auto',
                      maxWidth: 980,
                    }}>
                      {activePreviewVariant ? (
                        <p style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1.6, margin: 0, maxWidth: 820 }}>{activePreviewVariant.description}</p>
                      ) : null}

                      {previewGroup.examples?.length ? (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <p style={{ color: '#94a3b8', fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, margin: 0 }}>Ideal For</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {previewGroup.examples.map((example) => (
                              <span key={`${previewGroup.key}-${example}`} style={{
                                background: `${previewGroup.accent}22`,
                                color: '#e2e8f0',
                                border: `1px solid ${previewGroup.accent}44`,
                                borderRadius: 999,
                                padding: '8px 12px',
                                fontSize: 16,
                                fontWeight: 600,
                              }}>
                                {example}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
                        {activePreviewVariant?.pages?.length ? (
                          <div style={{ display: 'grid', gap: 8, flex: '1 1 520px' }}>
                            <p style={{ color: '#94a3b8', fontSize: 16, fontWeight: 600, margin: 0 }}>Page</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {activePreviewVariant.pages.map((page, index) => {
                                const isActive = index === previewPageIndex;
                                return (
                                  <button
                                    key={`${activePreviewVariant.id}-${page.title}`}
                                    type="button"
                                    onClick={() => setPreviewPageIndex(index)}
                                    style={{
                                      background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.7)',
                                      color: '#e2e8f0',
                                      border: isActive ? `1px solid ${previewGroup.accent}` : '1px solid #334155',
                                      borderRadius: 999,
                                      padding: '8px 12px',
                                      fontSize: 16,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {page.title}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {activePreviewVariant ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', pointerEvents: 'auto' }}>
                      <div style={{
                        display: 'grid',
                        gap: 4,
                        padding: '12px 14px',
                        borderRadius: 16,
                        background: 'rgba(2,6,23,0.72)',
                        border: '1px solid #1e293b',
                        backdropFilter: 'blur(10px)',
                      }}>
                        <p style={{ color: '#f8fafc', fontSize: 16, fontWeight: 600, margin: 0 }}>{activePreviewPage?.title || 'Preview'}</p>
                        <p style={{ color: '#94a3b8', fontSize: 16, margin: 0 }}>{previewViewport === 'desktop' ? 'Full page preview' : 'Mobile preview'}</p>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={startFromScratch}
                          disabled={startingFromScratch}
                          style={{
                            background: startingFromScratch ? '#1e293b' : 'rgba(2,6,23,0.72)',
                            color: startingFromScratch ? '#64748b' : '#e2e8f0',
                            border: '1px solid #334155',
                            borderRadius: 12,
                            padding: '12px 16px',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: startingFromScratch ? 'default' : 'pointer',
                            minWidth: 190,
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          {startingFromScratch ? 'Opening Blank Funnel...' : 'Start From Scratch'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            closeTemplatePreview();
                            selectTemplate(activePreviewVariant);
                          }}
                          style={{
                            background: previewGroup.accent,
                            color: '#08111c',
                            border: `1px solid ${previewGroup.accent}`,
                            borderRadius: 12,
                            padding: '12px 16px',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: 'pointer',
                            minWidth: 190,
                          }}
                        >
                          Use {activePreviewVariant.variant || 'Template'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div style={{
                  position: 'absolute',
                  inset: 0,
                  paddingTop: previewViewport === 'mobile' ? 140 : 0,
                  background: previewViewport === 'mobile' ? 'radial-gradient(circle at top, rgba(148,163,184,0.12), transparent 36%), #0b1120' : '#ffffff',
                  overflow: previewViewport === 'mobile' ? 'auto' : 'hidden',
                }}>
                  {previewViewport === 'mobile' ? (
                    <div style={{ width: 430, maxWidth: 'calc(100vw - 24px)', margin: '0 auto 32px', background: '#ffffff', borderRadius: 24, boxShadow: '0 24px 60px rgba(2,6,23,0.4)', border: '8px solid #0f172a', overflow: 'hidden' }}>
                      {activePreviewDocument ? (
                        <iframe
                          title={`${previewGroup.label} preview`}
                          srcDoc={activePreviewDocument}
                          style={{
                            display: 'block',
                            width: '100%',
                            minHeight: 940,
                            border: 'none',
                            background: '#ffffff',
                          }}
                        />
                      ) : (
                        <div style={{ padding: 40, color: '#334155', fontSize: 16 }}>Preview unavailable for this page.</div>
                      )}
                    </div>
                  ) : activePreviewDocument ? (
                    <iframe
                      title={`${previewGroup.label} preview`}
                      srcDoc={activePreviewDocument}
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        background: '#ffffff',
                      }}
                    />
                  ) : (
                    <div style={{ padding: 40, color: '#334155', fontSize: 16 }}>Preview unavailable for this page.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 && (
            <div>
              <h2 style={{ color: '#e6eef5', fontSize: 28, fontWeight: 600, margin: '0 0 8px' }}>A few short answers</h2>
              <p style={{ color: '#cbd5e1', fontSize: 18, margin: '0 0 32px' }}>
                Keep it simple. We will generate the headline, subheadline, button copy, and page content for you.
              </p>

              {error && <div style={{ background: '#3a0d16', border: '1px solid #5b1a28', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#f87171', fontSize: 16 }}>{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: 24, alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: 20 }}>
                  <Field label="What is the offer? *" hint="The product, service, lead magnet, webinar, or program name.">
                    <input value={answers.name} onChange={(e) => updateAnswer('name', e.target.value)} placeholder="e.g. CitrusBurn Metabolism System" style={inp} />
                  </Field>
                  <Field label="Who is this for? *" hint="Describe the audience in plain language.">
                    <input value={answers.audience} onChange={(e) => updateAnswer('audience', e.target.value)} placeholder="e.g. women over 40 struggling to lose weight" style={inp} />
                  </Field>
                  <Field label="What result do they want? *" hint="The main transformation or outcome.">
                    <input value={answers.result} onChange={(e) => updateAnswer('result', e.target.value)} placeholder="e.g. lose stubborn weight without extreme dieting" style={inp} />
                  </Field>
                  <Field label="Anything important the AI should know?" hint="Optional. Add features, proof, objections, bonuses, price positioning, or anything unique.">
                    <textarea value={answers.details} onChange={(e) => updateAnswer('details', e.target.value)} placeholder="e.g. natural supplement, Harvard-backed ingredients, 180-day guarantee, no stimulants" style={{ ...inp, minHeight: 120, resize: 'vertical' }} />
                  </Field>
                  <Field label="What vibe should it have?" hint="Optional. Examples: bold, premium, clean, urgent, friendly.">
                    <input value={answers.style} onChange={(e) => updateAnswer('style', e.target.value)} placeholder="e.g. bold and credible" style={inp} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Field label="Price" hint="Optional. Examples: $49, $97/mo, FREE.">
                      <input value={answers.price} onChange={(e) => updateAnswer('price', e.target.value)} placeholder="$97" style={inp} />
                    </Field>
                    <Field label="Accent Colour" hint="Optional. Used for buttons and highlights.">
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input type="color" value={answers.accentColor} onChange={(e) => updateAnswer('accentColor', e.target.value)} style={{ width: 56, height: 48, borderRadius: 8, border: '1px solid #2b3650', cursor: 'pointer', background: 'none', padding: 4 }} />
                        <input value={answers.accentColor} onChange={(e) => updateAnswer('accentColor', e.target.value)} style={{ ...inp, flex: 1 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                        {['#ef465d', '#dc2626', '#ea580c', '#f59e0b', '#16a34a', '#0ea5e9', '#2563eb', '#7c3aed', '#111827', '#ffffff'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => updateAnswer('accentColor', color)}
                            aria-label={`Set accent colour to ${color}`}
                            title={color}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              background: color,
                              border: answers.accentColor === color
                                ? '3px solid #f8fafc'
                                : color === '#ffffff'
                                  ? '2px solid #94a3b8'
                                  : '2px solid rgba(255,255,255,0.18)',
                              boxShadow: color === '#ffffff' ? 'inset 0 0 0 1px #cbd5e1' : 'none',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                      </div>
                    </Field>
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 16, padding: '24px 22px', position: 'sticky', top: 16 }}>
                  <p style={{ color: '#93c5fd', fontSize: 16, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1.2 }}>AI plan</p>
                  <h3 style={{ color: '#e6eef5', fontSize: 22, margin: '0 0 12px' }}>{answers.name || 'Your funnel'}</h3>
                  <p style={{ color: '#dbeafe', fontSize: 16, margin: '0 0 18px', lineHeight: 1.6 }}>
                    {funnelSummary.offerDescription || 'Answer the short questions and the funnel copy will be generated automatically.'}
                  </p>
                  <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                    <MiniStat label="Funnel type" value={selectedType?.label || 'Not selected'} />
                    <MiniStat label="Audience" value={answers.audience || 'Not set'} />
                    <MiniStat label="Desired result" value={answers.result || 'Not set'} />
                    <MiniStat label="Default CTA" value={funnelSummary.ctaText} />
                  </div>
                  <div style={{ background: '#0c121a', border: '1px solid #243047', borderRadius: 12, padding: '14px 14px' }}>
                    <p style={{ color: '#cbd5e1', fontSize: 16, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 1.1 }}>What happens next</p>
                    <p style={{ color: '#e2e8f0', fontSize: 16, margin: 0, lineHeight: 1.6 }}>
                      We generate the copy, assemble the pages for this funnel type, and open the builder so you can fine-tune anything.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(1)} style={{ ...navBtn }}>← Back</button>
                <button
                  onClick={createFunnel}
                  disabled={creating || !canContinue}
                  style={{
                    padding: '16px 48px', borderRadius: 12, border: 'none',
                    background: creating ? '#1e2d45' : `linear-gradient(135deg,${selectedType.accent},${selectedType.accent}cc)`,
                    color: '#fff', fontSize: 20, fontWeight: 600, cursor: creating ? 'default' : 'pointer',
                    boxShadow: creating ? 'none' : `0 6px 28px ${selectedType.accent}55`,
                  }}
                >
                  {creating ? 'Building your funnel...' : `${selectedType?.icon || '🧭'} Build My Funnel`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#dabe1d', fontSize: 24, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ color: '#cbd5e1', fontSize: 16, margin: '0 0 8px', lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: 16, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1.1 }}>{label}</p>
      <p style={{ color: '#e6eef5', fontSize: 16, margin: 0, lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}

const inp = {
  width: '100%', padding: '12px 16px', borderRadius: 10,
  border: '1px solid #2b3650', background: '#0c121a', color: '#e6eef5',
  fontSize: 16, outline: 'none', boxSizing: 'border-box',
};

const navBtn = {
  padding: '12px 28px', borderRadius: 10, border: '1px solid #2b3650',
  background: '#1e2d45', color: '#dabe1d', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};
