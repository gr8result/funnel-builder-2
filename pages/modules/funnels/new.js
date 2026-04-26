// pages/modules/funnels/new.js
// Funnel creation wizard:
// 1. Choose funnel type
// 2. Answer a few short questions

import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AuthGate from '../../../components/AuthGate';
import { FUNNEL_TYPES } from '../../../lib/funnelSections';

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

  const canContinue = Boolean(answers.name.trim() && answers.audience.trim() && answers.result.trim());

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

  function updateAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
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
      // Get current session to include userId
      const { supabase } = await import('../../../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/funnels/create-with-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ funnelTypeId: selectedType.id, brand, userId: session?.user?.id, useAI: false }),
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

  return (
    <>
      <Head><title>New Funnel — Funnel Builder</title></Head>

      <div style={{ minHeight: '100vh', background: '#0c121a', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

        {/* BANNER */}
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

        {/* STEP INDICATOR */}
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 16px 32px' }}>
          <div style={{ display: 'flex', gap: 0, alignItems: 'center', marginBottom: 40 }}>
            {[1, 2].map((n, i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < 2 ? 1 : 'none' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: step >= n ? '#ef465d' : '#1e2d45',
                  border: step === n ? '3px solid #f87171' : '3px solid transparent',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 18,
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

          {/* ── STEP 1: FUNNEL TYPE ── */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#e6eef5', fontSize: 28, fontWeight: 600, margin: '0 0 8px' }}>What kind of funnel do you want to build?</h2>
              <p style={{ color: '#cbd5e1', fontSize: 18, margin: '0 0 32px' }}>We'll automatically create all the right pages for your chosen funnel type.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
                {FUNNEL_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type)}
                    style={{
                      background: selectedType?.id === type.id
                        ? `linear-gradient(135deg,${type.accent}22,${type.accent}44)`
                        : '#111827',
                      border: selectedType?.id === type.id
                        ? `2px solid ${type.accent}`
                        : '2px solid #1e2d45',
                      borderRadius: 16, padding: '28px 24px',
                      textAlign: 'left', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 40, marginBottom: 14 }}>{type.icon}</div>
                    <h3 style={{ color: '#e6eef5', fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>{type.label}</h3>
                    <p style={{ color: '#cbd5e1', fontSize: 16, margin: '0 0 18px', lineHeight: 1.5 }}>{type.description}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {type.pages.map(p => (
                        <span key={p.title} style={{
                          background: `${type.accent}22`, color: type.accent,
                          border: `1px solid ${type.accent}44`,
                          borderRadius: 6, padding: '4px 10px', fontSize: 16, fontWeight: 600,
                        }}>{p.title}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => selectedType && setStep(2)}
                  disabled={!selectedType}
                  style={{
                    padding: '14px 36px', borderRadius: 12, border: 'none',
                    background: selectedType ? 'linear-gradient(135deg,#ef465d,#b5224a)' : '#1e2d45',
                    color: '#fff', fontSize: 18, fontWeight: 600, cursor: selectedType ? 'pointer' : 'default',
                    boxShadow: selectedType ? '0 4px 20px rgba(239,70,93,0.4)' : 'none',
                  }}
                >
                  Continue → Quick Questions
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: SHORT AI INTAKE ── */}
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
                    <input value={answers.name} onChange={e => updateAnswer('name', e.target.value)}
                      placeholder="e.g. CitrusBurn Metabolism System" style={inp} />
                  </Field>
                  <Field label="Who is this for? *" hint="Describe the audience in plain language.">
                    <input value={answers.audience} onChange={e => updateAnswer('audience', e.target.value)}
                      placeholder="e.g. women over 40 struggling to lose weight" style={inp} />
                  </Field>
                  <Field label="What result do they want? *" hint="The main transformation or outcome.">
                    <input value={answers.result} onChange={e => updateAnswer('result', e.target.value)}
                      placeholder="e.g. lose stubborn weight without extreme dieting" style={inp} />
                  </Field>
                  <Field label="Anything important the AI should know?" hint="Optional. Add features, proof, objections, bonuses, price positioning, or anything unique.">
                    <textarea value={answers.details} onChange={e => updateAnswer('details', e.target.value)}
                      placeholder="e.g. natural supplement, Harvard-backed ingredients, 180-day guarantee, no stimulants"
                      style={{ ...inp, minHeight: 120, resize: 'vertical' }} />
                  </Field>
                  <Field label="What vibe should it have?" hint="Optional. Examples: bold, premium, clean, urgent, friendly.">
                    <input value={answers.style} onChange={e => updateAnswer('style', e.target.value)}
                      placeholder="e.g. bold and credible" style={inp} />
                </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Field label="Price" hint="Optional. Examples: $49, $97/mo, FREE.">
                      <input value={answers.price} onChange={e => updateAnswer('price', e.target.value)}
                      placeholder="$97" style={inp} />
                    </Field>
                    <Field label="Accent Colour" hint="Optional. Used for buttons and highlights.">
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input type="color" value={answers.accentColor} onChange={e => updateAnswer('accentColor', e.target.value)}
                          style={{ width: 56, height: 48, borderRadius: 8, border: '1px solid #2b3650', cursor: 'pointer', background: 'none', padding: 4 }} />
                        <input value={answers.accentColor} onChange={e => updateAnswer('accentColor', e.target.value)}
                          style={{ ...inp, flex: 1 }} />
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
                  <p style={{ color: '#93c5fd', fontSize: 16, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1.2 }}>AI plan</p>
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
                    color: '#fff', fontSize: 20, fontWeight: 800, cursor: creating ? 'default' : 'pointer',
                    boxShadow: creating ? 'none' : `0 6px 28px ${selectedType.accent}55`,
                  }}
                >
                  {creating ? 'Building your funnel…' : `${selectedType?.icon || '🧭'} Build My Funnel`}
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

