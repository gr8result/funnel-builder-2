import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../utils/supabase-client";

const QUOTE_TEMPLATE_KEY_PREFIX = "crm:quotes:templates:";
const QUOTE_BRANDING_KEY_PREFIX = "crm:quotes:branding:";
const LEAD_META_KEY_PREFIX = "crm:pipeline:leadMeta:";

const DEFAULT_TEMPLATES = [
  {
    id: "website-build",
    name: "Website Build Proposal",
    description: "A standard website design and launch package.",
    taxRate: 10,
    items: [
      { description: "Discovery and planning", qty: 1, price: 450 },
      { description: "Website design and build", qty: 1, price: 2400 },
      { description: "Launch support", qty: 1, price: 350 },
    ],
    notes: "Timeline is subject to content approval and revision rounds.",
    terms: "Valid for 14 days. A deposit may be required before work commences.",
  },
  {
    id: "lead-gen",
    name: "Lead Generation Campaign",
    description: "A done-for-you lead generation and funnel setup quote.",
    taxRate: 10,
    items: [
      { description: "Campaign strategy", qty: 1, price: 600 },
      { description: "Landing page and funnel setup", qty: 1, price: 1800 },
      { description: "Ads and automation configuration", qty: 1, price: 1200 },
    ],
    notes: "Ad spend is billed separately and is not included in this quotation.",
    terms: "Valid for 14 days. Setup begins once acceptance is confirmed.",
  },
  {
    id: "crm-setup",
    name: "CRM Setup and Automation",
    description: "A CRM implementation and workflow automation package.",
    taxRate: 10,
    items: [
      { description: "CRM configuration", qty: 1, price: 950 },
      { description: "Automation workflow build", qty: 1, price: 1450 },
      { description: "Team training session", qty: 1, price: 500 },
    ],
    notes: "Includes one training session and standard onboarding support.",
    terms: "Valid for 21 days. Additional integrations may be quoted separately.",
  },
];

const QUOTE_LAYOUTS = [
  {
    id: "modern",
    name: "Modern Gold",
    description: "Strong branded header and highlight cards.",
    accent: "#f59e0b",
    preview: "linear-gradient(135deg,#f59e0b,#facc15)",
  },
  {
    id: "classic",
    name: "Classic Blue",
    description: "A polished corporate look for formal proposals.",
    accent: "#2563eb",
    preview: "linear-gradient(135deg,#1d4ed8,#60a5fa)",
  },
  {
    id: "minimal",
    name: "Minimal Mono",
    description: "Clean and understated with a premium document feel.",
    accent: "#334155",
    preview: "linear-gradient(135deg,#0f172a,#334155)",
  },
];

function s(value) {
  return String(value ?? "").trim();
}

function formatMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$0";
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function normaliseItems(items) {
  const source = Array.isArray(items) ? items : [];
  return source
    .map((item) => ({
      description: s(item?.description || item?.title),
      qty: Math.max(1, Number(item?.qty || 1) || 1),
      price: Math.max(0, Number(item?.price || 0) || 0),
    }))
    .filter((item) => item.description || item.qty || item.price);
}

function parseItemsText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [description, qty, price] = line.split("|").map((part) => part.trim());
      return {
        description: description || "",
        qty: Math.max(1, Number(qty || 1) || 1),
        price: Math.max(0, Number(price || 0) || 0),
      };
    })
    .filter((item) => item.description || item.qty || item.price);
}

function calcTotal(items, taxRate = 0) {
  const subtotal = normaliseItems(items).reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const tax = subtotal * (Math.max(0, Number(taxRate || 0)) / 100);
  return subtotal + tax;
}

function normaliseBranding(source = {}) {
  return {
    companyName: s(source.companyName || source.brand_name || source.business_name || source.company_name),
    email: s(source.email || source.business_email || source.sendgrid_from_email || source.from_email),
    phone: s(source.phone || source.business_phone || source.alt_phone),
    website: s(source.website),
    address:
      s(source.address) ||
      [
        s(source.business_address || source.postal_address || source.residential_address),
        s(source.business_city || source.postal_city || source.residential_city),
        s(source.business_state || source.postal_state || source.residential_state),
        s(source.business_postcode || source.postal_postcode || source.residential_postcode),
        s(source.business_country || source.postal_country || source.residential_country),
      ]
        .filter(Boolean)
        .join(", "),
    logoUrl: resolvePublicAssetUrl(
      source.logoUrl ||
      source.business_logo_url ||
      source.business_logo ||
      source.logo_url ||
      source.business_avatar ||
      source.business_avatar_url
    ),
    heroImageUrl: resolvePublicAssetUrl(source.heroImageUrl || source.quote_hero_image_url || source.quoteHeroImageUrl),
  };
}

function resolvePublicAssetUrl(rawValue) {
  let value = s(rawValue);
  if (!value) return "";

  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.url) value = parsed.url;
    } catch {
      // ignore invalid JSON wrappers
    }
  }

  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;

  const cleanPath = String(value)
    .replace(/^https:\/\/[^/]+\/storage\/v1\/object\/public\//, "")
    .replace(/^public-assets\//i, "")
    .replace(/^\/+/, "");

  if (!cleanPath) return "";
  try {
    const { data } = supabase.storage.from("public-assets").getPublicUrl(cleanPath);
    return data?.publicUrl || "";
  } catch {
    return "";
  }
}

async function readImageAsOptimizedDataUrl(file, options = {}) {
  const maxWidth = Number(options.maxWidth || 1400);
  const maxHeight = Number(options.maxHeight || 1400);
  const quality = Number(options.quality || 0.82);

  if (!file || typeof window === "undefined") return "";
  if (!String(file.type || "").startsWith("image/")) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsDataURL(file);
    });
  }

  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Unable to load image."));
    el.src = src;
  });

  const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function CRMQuotesPage() {
  const [userId, setUserId] = useState("");
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [quoteRows, setQuoteRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingStatus, setBrandingStatus] = useState("");
  const [branding, setBranding] = useState({
    companyName: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    logoUrl: "",
    heroImageUrl: "",
  });
  const [form, setForm] = useState({
    name: "",
    description: "",
    taxRate: 10,
    itemsText: "Service package | 1 | 1000",
    notes: "",
    terms: "Valid for 14 days.",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id || "guest";
      setUserId(uid);

      try {
        const storedBranding = normaliseBranding(readStoredJson(`${QUOTE_BRANDING_KEY_PREFIX}${uid}`, {}));
        const { data: account } = await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();

        const dbBranding = normaliseBranding(account || {});
        setBranding({
          companyName: storedBranding.companyName || dbBranding.companyName,
          email: storedBranding.email || dbBranding.email,
          phone: storedBranding.phone || dbBranding.phone,
          website: storedBranding.website || dbBranding.website,
          address: storedBranding.address || dbBranding.address,
          logoUrl: storedBranding.logoUrl || dbBranding.logoUrl,
          heroImageUrl: storedBranding.heroImageUrl || dbBranding.heroImageUrl,
        });
      } catch {
        // ignore branding load issues here
      }

      const storedTemplates = readStoredJson(`${QUOTE_TEMPLATE_KEY_PREFIX}${uid}`, []);
      const merged = [...DEFAULT_TEMPLATES, ...(Array.isArray(storedTemplates) ? storedTemplates : [])];
      const byId = new Map();
      merged.forEach((template) => {
        if (!template?.id) return;
        byId.set(template.id, { ...template, items: normaliseItems(template.items) });
      });
      setTemplates(Array.from(byId.values()));

      if (uid && uid !== "guest") {
        const { data: leadRows, error } = await supabase
          .from("leads")
          .select("id, name, email, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(500);

        if (error) {
          console.error("Quote page lead load error:", error);
          setQuoteRows([]);
        } else {
          const metaMap = readStoredJson(`${LEAD_META_KEY_PREFIX}${uid}`, {});
          const rows = (leadRows || [])
            .map((lead) => {
              const meta = metaMap?.[lead.id] || {};
              return {
                ...lead,
                quoteStatus: s(meta.quoteStatus || ""),
                quoteNumber: s(meta.quoteNumber || ""),
                quoteTemplateName: s(meta.quoteTemplateName || ""),
                quoteLayout: s(meta.quoteLayout || "modern"),
                quoteValidUntil: s(meta.quoteValidUntil || ""),
                total: calcTotal(meta.quoteItems || [], meta.quoteTaxRate || 0),
              };
            })
            .filter((row) => row.quoteStatus || row.quoteNumber || row.quoteTemplateName);
          setQuoteRows(rows);
        }
      }
    } catch (err) {
      console.error("Quote page load exception:", err);
      setQuoteRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveBranding() {
    if (!userId || userId === "guest") {
      alert("Please sign in to save company branding.");
      return;
    }

    setBrandingSaving(true);
    setBrandingStatus("");
    try {
      const nextBranding = normaliseBranding(branding);
      writeStoredJson(`${QUOTE_BRANDING_KEY_PREFIX}${userId}`, nextBranding);
      setBranding(nextBranding);

      const payload = {
        business_name: nextBranding.companyName || null,
        business_email: nextBranding.email || null,
        business_phone: nextBranding.phone || null,
        website: nextBranding.website || null,
        business_address: nextBranding.address || null,
        business_logo_url: nextBranding.logoUrl || null,
        quote_hero_image_url: nextBranding.heroImageUrl || null,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase.from("accounts").select("id").eq("user_id", userId).maybeSingle();
      let error = null;

      if (existing?.id) {
        const result = await supabase.from("accounts").update(payload).eq("user_id", userId);
        error = result.error || null;
      } else {
        const result = await supabase.from("accounts").insert({ user_id: userId, ...payload });
        error = result.error || null;
      }

      if (error) {
        console.warn("Branding DB sync error:", error);
        setBrandingStatus("Branding saved locally for quotes. Database sync had an issue.");
      } else {
        setBrandingStatus("Company branding saved for quotations.");
      }

      await loadData();
    } catch (err) {
      console.error("Save branding error:", err);
      setBrandingStatus(err?.message || "Unable to save company branding.");
    } finally {
      setBrandingSaving(false);
    }
  }

  async function handleLogoUpload(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
      const nextUrl = await readImageAsOptimizedDataUrl(file, { maxWidth: 700, maxHeight: 700, quality: 0.84 });
      setBranding((prev) => ({ ...prev, logoUrl: nextUrl }));
      setBrandingStatus("Logo uploaded. Click Save company branding to use it on quotes.");
    } catch {
      setBrandingStatus("Unable to read that logo file.");
    }
  }

  async function handleHeroImageUpload(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
      const nextUrl = await readImageAsOptimizedDataUrl(file, { maxWidth: 1600, maxHeight: 1000, quality: 0.82 });
      setBranding((prev) => ({ ...prev, heroImageUrl: nextUrl }));
      setBrandingStatus("Hero image uploaded. Click Save company branding to use it on quotes.");
    } catch {
      setBrandingStatus("Unable to read that hero image file.");
    }
  }

  function saveTemplate() {
    const items = parseItemsText(form.itemsText);
    if (!form.name.trim() || items.length === 0) {
      alert("Add a template name and at least one line item.");
      return;
    }

    const nextTemplate = {
      id: `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      taxRate: Math.max(0, Number(form.taxRate || 0)),
      items,
      notes: form.notes.trim(),
      terms: form.terms.trim(),
    };

    const currentCustom = readStoredJson(`${QUOTE_TEMPLATE_KEY_PREFIX}${userId}`, []);
    const next = [...(Array.isArray(currentCustom) ? currentCustom : []), nextTemplate];
    writeStoredJson(`${QUOTE_TEMPLATE_KEY_PREFIX}${userId}`, next);
    setForm({
      name: "",
      description: "",
      taxRate: 10,
      itemsText: "Service package | 1 | 1000",
      notes: "",
      terms: "Valid for 14 days.",
    });
    loadData();
  }

  const stats = useMemo(() => {
    const draft = quoteRows.filter((row) => row.quoteStatus === "draft").length;
    const sent = quoteRows.filter((row) => row.quoteStatus === "sent").length;
    const accepted = quoteRows.filter((row) => row.quoteStatus === "accepted").length;
    return {
      templateCount: templates.length,
      layoutCount: QUOTE_LAYOUTS.length,
      draft,
      sent,
      accepted,
    };
  }, [templates, quoteRows]);

  return (
    <main style={styles.main}>
      <div style={styles.bannerWrap}>
        <div style={styles.banner}>
          <div>
            <h1 style={styles.bannerTitle}>Quotation Templates</h1>
            <p style={styles.bannerSub}>Use both item presets and visual quote layout styles in the CRM lead modal.</p>
          </div>
          <div style={styles.bannerActions}>
            <Link href="/modules/email/crm/pipelines" style={styles.secondaryBtn}>Open Pipeline</Link>
            <Link href="/modules/email/crm" style={styles.backBtn}>← Back</Link>
          </div>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.editorCard}>
          <div style={styles.reportHeaderRow}>
            <div>
              <h2 style={styles.sectionTitle}>Company branding on quotes</h2>
              <p style={styles.sectionSub}>This is the business name, address, phone and logo that will appear on your quotation document.</p>
            </div>
            <Link href="/account" style={styles.inlineLink}>Open full account profile →</Link>
          </div>

          <div style={styles.brandingGrid}>
            <input value={branding.companyName} onChange={(e) => setBranding((prev) => ({ ...prev, companyName: e.target.value }))} placeholder="Company name" style={styles.input} />
            <input value={branding.email} onChange={(e) => setBranding((prev) => ({ ...prev, email: e.target.value }))} placeholder="Company email" style={styles.input} />
            <input value={branding.phone} onChange={(e) => setBranding((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone number" style={styles.input} />
            <input value={branding.website} onChange={(e) => setBranding((prev) => ({ ...prev, website: e.target.value }))} placeholder="Website" style={styles.input} />
            <textarea value={branding.address} onChange={(e) => setBranding((prev) => ({ ...prev, address: e.target.value }))} placeholder="Business address" style={styles.textarea} />
            <input value={branding.logoUrl} onChange={(e) => setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))} placeholder="Logo URL or saved logo path" style={styles.input} />
          </div>

          <div style={styles.brandingGrid}>
            <input value={branding.heroImageUrl} onChange={(e) => setBranding((prev) => ({ ...prev, heroImageUrl: e.target.value }))} placeholder="Hero/banner image URL" style={styles.input} />
          </div>

          <div style={styles.brandActionsRow}>
            <label style={styles.uploadBtn}>
              Upload logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
            </label>
            <label style={{ ...styles.uploadBtn, background: "#7c3aed" }}>
              Upload hero image
              <input type="file" accept="image/*" onChange={handleHeroImageUpload} style={{ display: "none" }} />
            </label>
            <span style={styles.sectionSub}>You can upload a logo and a brochure hero image directly here.</span>
          </div>

          {(branding.logoUrl || branding.heroImageUrl) ? (
            <div style={styles.brandLogoWrap}>
              {branding.logoUrl ? <img src={branding.logoUrl} alt="Company logo" style={styles.brandLogoPreview} /> : null}
              {branding.heroImageUrl ? <img src={branding.heroImageUrl} alt="Quote hero" style={styles.heroImagePreview} /> : null}
              <div style={styles.sectionSub}>{branding.companyName || "Your company"}</div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={saveBranding} style={styles.primaryBtn}>
              {brandingSaving ? "Saving…" : "Save company branding"}
            </button>
            <span style={styles.sectionSub}>{brandingStatus || "These details feed directly into quote email and PDF branding."}</span>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <StatCard label="Item Templates" value={String(stats.templateCount)} color="#facc15" />
          <StatCard label="Layout Styles" value={String(stats.layoutCount)} color="#38bdf8" />
          <StatCard label="Draft Quotes" value={String(stats.draft)} color="#60a5fa" />
          <StatCard label="Sent Quotes" value={String(stats.sent)} color="#a855f7" />
        </div>

        <div style={styles.editorCard}>
          <div>
            <h2 style={styles.sectionTitle}>Document style templates</h2>
            <p style={styles.sectionSub}>These are full quotation designs, not just line-item bundles.</p>
          </div>

          <div style={styles.layoutGrid}>
            {QUOTE_LAYOUTS.map((layout) => (
              <div key={layout.id} style={styles.layoutCard}>
                <div style={{ ...styles.layoutSwatch, background: layout.preview }} />
                <div style={styles.templateTitle}>{layout.name}</div>
                <div style={styles.templateDesc}>{layout.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.editorCard}>
          <div>
            <h2 style={styles.sectionTitle}>Create a custom item template</h2>
            <p style={styles.sectionSub}>Use one line per item in the format: description | quantity | price</p>
          </div>

          <div style={styles.formGrid}>
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Template name" style={styles.input} />
            <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Short description" style={styles.input} />
            <input type="number" min="0" value={form.taxRate} onChange={(e) => setForm((prev) => ({ ...prev, taxRate: e.target.value }))} placeholder="Tax rate" style={styles.input} />
            <textarea value={form.itemsText} onChange={(e) => setForm((prev) => ({ ...prev, itemsText: e.target.value }))} style={styles.textarea} />
            <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Client notes" style={styles.textarea} />
            <textarea value={form.terms} onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))} placeholder="Terms and conditions" style={styles.textarea} />
          </div>

          <button type="button" onClick={saveTemplate} style={styles.primaryBtn}>Save template</button>
        </div>

        <div style={styles.templateGrid}>
          {templates.map((template) => (
            <div key={template.id} style={styles.templateCard}>
              <div style={styles.templateHeaderRow}>
                <div>
                  <div style={styles.templateTitle}>{template.name}</div>
                  <div style={styles.templateDesc}>{template.description || "Reusable quote template"}</div>
                </div>
                <span style={styles.templateTax}>{template.taxRate || 0}% tax</span>
              </div>

              <div style={styles.templateItems}>
                {normaliseItems(template.items).map((item, idx) => (
                  <div key={`${template.id}-${idx}`} style={styles.templateItemRow}>
                    <span>{item.description}</span>
                    <strong>{item.qty} × {formatMoney(item.price)}</strong>
                  </div>
                ))}
              </div>

              <div style={styles.templateFooter}>
                <div>Total: {formatMoney(calcTotal(template.items, template.taxRate))}</div>
                <Link href="/modules/email/crm/pipelines" style={styles.inlineLink}>Use in CRM →</Link>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.reportCard}>
          <div style={styles.reportHeaderRow}>
            <h2 style={styles.sectionTitle}>Recent lead quotations</h2>
            <span style={styles.sectionSub}>{loading ? "Loading…" : `${quoteRows.length} quotes found`}</span>
          </div>

          {quoteRows.length === 0 ? (
            <div style={styles.emptyState}>No quotes have been saved to leads yet.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Lead</th>
                    <th style={styles.th}>Template</th>
                    <th style={styles.th}>Quote #</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Style</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>Valid Until</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteRows.slice(0, 50).map((row) => (
                    <tr key={row.id}>
                      <td style={styles.td}>{row.name || row.email || "Unnamed lead"}</td>
                      <td style={styles.td}>{row.quoteTemplateName || "Custom"}</td>
                      <td style={styles.td}>{row.quoteNumber || "—"}</td>
                      <td style={styles.td}>{String(row.quoteStatus || "draft").toUpperCase()}</td>
                      <td style={styles.td}>{QUOTE_LAYOUTS.find((layout) => layout.id === row.quoteLayout)?.name || "Modern Gold"}</td>
                      <td style={styles.td}>{formatMoney(row.total)}</td>
                      <td style={styles.td}>{row.quoteValidUntil || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...styles.statCard, borderColor: `${color}66` }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color }}>{value}</div>
    </div>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    background: "#08111f",
    color: "#e5eefc",
    paddingBottom: 40,
  },
  bannerWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    paddingTop: 24,
  },
  banner: {
    width: "min(1320px, calc(100% - 32px))",
    borderRadius: 18,
    padding: "22px 24px",
    background: "linear-gradient(135deg, #f59e0b, #facc15)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    display: "flex",
    gap: 18,
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    color: "#111827",
  },
  bannerTitle: { margin: 0, fontSize: 42, fontWeight: 600 },
  bannerSub: { margin: "8px 0 0", fontSize: 16, opacity: 0.9 },
  bannerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  backBtn: {
    border: "1px solid rgba(17,24,39,0.2)",
    borderRadius: 10,
    background: "rgba(255,255,255,0.7)",
    color: "#111827",
    padding: "10px 14px",
    fontWeight: 600,
    textDecoration: "none",
  },
  secondaryBtn: {
    border: "1px solid rgba(17,24,39,0.2)",
    borderRadius: 10,
    background: "rgba(255,255,255,0.7)",
    color: "#111827",
    padding: "10px 14px",
    fontWeight: 600,
    textDecoration: "none",
  },
  primaryBtn: {
    border: "none",
    borderRadius: 10,
    background: "#22c55e",
    color: "#04120a",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  container: {
    width: "min(1320px, calc(100% - 32px))",
    margin: "22px auto 0",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  statCard: {
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.18)",
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 16,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#94a3b8",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 600,
  },
  editorCard: {
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: "#fff",
  },
  sectionSub: {
    margin: "6px 0 0",
    fontSize: 16,
    color: "#94a3b8",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 14,
    marginBottom: 12,
  },
  brandingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 14,
    marginBottom: 12,
  },
  brandActionsRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  uploadBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  brandLogoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  brandLogoPreview: {
    width: 64,
    height: 64,
    objectFit: "contain",
    borderRadius: 10,
    background: "#fff",
    padding: 4,
    border: "1px solid rgba(148,163,184,0.25)",
  },
  heroImagePreview: {
    width: 140,
    height: 64,
    objectFit: "cover",
    borderRadius: 10,
    background: "#fff",
    border: "1px solid rgba(148,163,184,0.25)",
  },
  layoutGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  layoutCard: {
    background: "#08111f",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 14,
    padding: 12,
  },
  layoutSwatch: {
    height: 70,
    borderRadius: 10,
    marginBottom: 10,
  },
  input: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#08111f",
    color: "#fff",
    padding: "0 12px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: 88,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#08111f",
    color: "#fff",
    padding: "10px 12px",
    boxSizing: "border-box",
    resize: "vertical",
  },
  templateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  templateCard: {
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 16,
    padding: 16,
  },
  templateHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  templateTitle: { fontSize: 18, fontWeight: 600, color: "#fff" },
  templateDesc: { fontSize: 16, color: "#94a3b8", marginTop: 4 },
  templateTax: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(250,204,21,0.18)",
    color: "#fde68a",
    fontSize: 16,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  templateItems: { display: "grid", gap: 8 },
  templateItemRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 16,
    color: "#e2e8f0",
    padding: "8px 10px",
    borderRadius: 10,
    background: "#08111f",
  },
  templateFooter: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    color: "#cbd5e1",
    fontWeight: 600,
    flexWrap: "wrap",
  },
  inlineLink: {
    textDecoration: "none",
    color: "#93c5fd",
    fontWeight: 600,
  },
  reportCard: {
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 16,
    padding: 18,
  },
  reportHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 16,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "10px 8px",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
  },
  td: {
    fontSize: 16,
    color: "#e2e8f0",
    padding: "10px 8px",
    borderBottom: "1px solid rgba(148,163,184,0.12)",
  },
  emptyState: {
    padding: "20px 8px",
    color: "#94a3b8",
    textAlign: "center",
  },
};
