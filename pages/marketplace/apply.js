    // ...existing code...
// Style object for the page (copied from previous working version)
const page = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    display: "flex",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 600,
  },
  inner: { width: "100%", maxWidth: 1320 },
  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#22c55e",
    borderRadius: 14,
    padding: "18px 22px",
    fontWeight: 600,
    marginBottom: 18,
    gap: 18,
  },
  bannerLeft: { display: "flex", alignItems: "center", gap: 18 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    background: "rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: { fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.1 },
  subtitle: { fontSize: 18, fontWeight: 600, opacity: 0.95, marginTop: 6 },
  backBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 20,
    padding: "10px 18px",
    fontSize: 18,
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  formCard: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 16,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  label: { display: "block", fontSize: 16, fontWeight: 600, marginBottom: 6 },
  input: {
    width: "100%",
    background: "#0b1220",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 12px",
    fontSize: 16,
    fontWeight: 600,
    outline: "none",
  },
  textarea: {
    width: "100%",
    background: "#0b1220",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 12px",
    fontSize: 16,
    fontWeight: 600,
    outline: "none",
    minHeight: 110,
    resize: "vertical",
  },
  sectionTitle: { marginTop: 16, marginBottom: 10, fontSize: 18, fontWeight: 600 },
  agreementBox: {
    background: "#0b1220",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: 600,
    whiteSpace: "pre-wrap",
  },
  checkboxRow: {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    marginTop: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 2,
    cursor: "pointer",
  },
  checkboxText: { fontSize: 16, fontWeight: 600, lineHeight: 1.3 },
  checkboxSub: { fontSize: 16, opacity: 0.85, fontWeight: 600, marginTop: 3 },
  submitBtn: {
    width: "100%",
    marginTop: 18,
    background: "#facc15",
    color: "#000",
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  msg: (type) => ({
    marginTop: 18,
    padding: "10px 12px",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    background:
      type === "ok"
        ? "rgba(34,197,94,0.12)"
        : "rgba(239,68,68,0.12)",
    border:
      type === "ok"
        ? "1px solid rgba(34,197,94,0.35)"
        : "1px solid rgba(239,68,68,0.35)",
  }),
  debug: {
    marginTop: 18,
    fontSize: 16,
    opacity: 0.75,
    wordBreak: "break-all",
  },
};
// /modules/affiliates/affiliate-marketplace/offers/apply.js

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabase-client";
import { ShoppingCart } from "lucide-react";

export default function AffiliateApplicationForm() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in
  const [debugUserCode, setDebugUserCode] = useState("");
  const [debugSupabaseError, setDebugSupabaseError] = useState("");

  // On mount, load user_code from localStorage and fetch user from Supabase
  useEffect(() => {
    async function loadUser() {
      if (typeof window !== 'undefined') {
        const code = localStorage.getItem('xchange_user_code');
        setDebugUserCode(code || "(none)");
        if (code) {
          // Fetch user from Supabase by user_code
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('user_code', code)
            .maybeSingle();
          if (error) setDebugSupabaseError(error.message);
          if (data) {
            setUser(data);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    }
    loadUser();
  }, []);
  const [form, setForm] = useState({
    name: "",
    email: "",
    business_name: "",
    phone_number: "",
    website: "",
    abn_tax_number: "",
    affiliate_id: "",
    affiliate_user_id: "",
    facebook_handle: "",
    instagram_handle: "",
    linkedin_handle: "",
    tictoc_handle: "",
    youtube_handle: "",
    pintrest_handle: "",
    other_social_media_handles: "",
    marketing_tools: "",
    experience_years: "",
    paypal: false,
    paypal_user_email: "",
    bank_account: false,
    bank_account_details: "",
    bsb_number: "",
    account_number: "",
    swift_code: "",
    notes_to_vendor: "",
    agree_terms: false,
    confirm_truth: false,
  });
  const [highlightFields, setHighlightFields] = useState({});
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", msg: "" });
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    if (user && !form.affiliate_id) {
      setForm(f => ({ ...f, affiliate_id: user.user_code ? user.user_code.slice(0, 8).toUpperCase() : '' }));
    }
  }, [user, form.affiliate_id]);
  const setField = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };
  const canSubmit = (() => {
    const requiredFields = [
      "name", "email", "business_name", "phone_number", "website", "abn_tax_number",
      "facebook_handle", "instagram_handle", "linkedin_handle", "tictoc_handle", "youtube_handle",
      "pintrest_handle", "other_social_media_handles", "marketing_tools", "experience_years"
    ];
    for (const field of requiredFields) {
      if (!form[field] || (typeof form[field] === 'string' && !form[field].trim())) return false;
    }
    if (!form.agree_terms || !form.confirm_truth) return false;
    return true;
  })();
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', msg: '' });
    (async () => {
      try {
        // Only include fields that exist in the affiliate_applications table
        const allowedFields = [
          'affiliate_user_id', 'affiliate_id', 'name', 'email', 'business_name', 'phone_number', 'website', 'abn_tax_number',
          'facebook_handle', 'instagram_handle', 'linkedin_handle', 'tictoc_handle', 'youtube_handle', 'pintrest_handle',
          'other_social_media_handles', 'marketing_tools', 'experience_years', 'paypal', 'paypal_user_email', 'bank_account',
          'bank_account_details', 'bsb_number', 'account_number', 'swift_code', 'notes_to_vendor'
        ];
            const payload = {
              ...form,
              affiliate_user_id: user.id,
              affiliate_id: form.affiliate_id,
              submitted_at: new Date().toISOString(),
            };

            // Explicitly remove fields that should never be sent
            delete payload.user_code;

            // Remove fields not in DB but ALWAYS keep affiliate_id
          Object.keys(payload).forEach(key => {
            if (!allowedFields.includes(key) && key !== "affiliate_id") {
              delete payload[key];
            }
          });

        // Upsert by affiliate_user_id (one application per user)
        const { data, error } = await supabase
          .from('affiliate_applications')
          .upsert([payload], { onConflict: ['affiliate_user_id'] });
        if (error) {
          setStatus({ type: 'error', msg: 'Submission failed: ' + error.message });
        } else {
          setStatus({ type: 'ok', msg: 'Application submitted! You will be notified after review.' });
        }
      } catch (err) {
        setStatus({ type: 'error', msg: 'Unexpected error: ' + (err.message || err) });
      } finally {
        setSubmitting(false);
      }
    })();
  };
  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (user === undefined) {
    return (
      <div style={{ color: '#fff', textAlign: 'center', padding: 40 }}>
        Checking login...
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ color: '#fff', textAlign: 'center', padding: 40 }}>
        You must be logged in to access this form.<br />
        <div style={{ marginTop: 20, color: '#aaa', fontSize: 14 }}>
          <b>Debug info:</b><br />
          user_code from localStorage: <code>{debugUserCode}</code><br />
          Supabase error: <code>{debugSupabaseError || "(none)"}</code><br />
          User found: <code>{user === null ? "No" : "Yes"}</code>
        </div>
      </div>
    );
  }

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        <div style={page.banner}>
          <div style={page.bannerLeft}>
            <div style={page.iconWrap}>
              <ShoppingCart size={48} color="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={page.title}>Affiliate Application</div>
              <div style={page.subtitle}>
                Apply for permission to join the affiliate program.
              </div>
            </div>
          </div>
        </div>
        <div style={{ height: 32 }} />

        {hasMounted && status.msg && (
          <div style={page.msg(status.type === "ok" ? "ok" : "error")}>...
            {status.msg}
          </div>
        )}

        <div style={page.formCard}>
          <div style={{ marginBottom: 16 }}>
            {user?.id && (
              <span><b>User ID:</b> <span style={{ fontFamily: 'monospace' }}>{user.id}</span></span>
            )}
            {form.affiliate_id && (
              <span style={{ marginLeft: 24 }}><b>Your Xchange Marketplace ID:</b> <span style={{ fontFamily: 'monospace' }}>{form.affiliate_id}</span></span>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                background: '#f59e0b',
                color: '#222',
                padding: '14px 18px',
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              All fields are required. If you do not have a social media channel, enter <b>N/A</b> or <b>NIL</b> (do not leave blank). Please provide real information—applications with fake or placeholder data will be rejected.
            </div>
            <div style={page.grid2}>
              <div>
                <label style={page.label}>Full Name *</label>
                <input style={{ ...page.input, borderColor: highlightFields.name ? '#ef4444' : page.input.borderColor, background: highlightFields.name ? '#2f0a0a' : page.input.background }} value={form.name} onChange={e => setField("name", e.target.value)} required />
              </div>
              <div>
                <label style={page.label}>Email *</label>
                <input style={{ ...page.input, borderColor: highlightFields.email ? '#ef4444' : page.input.borderColor, background: highlightFields.email ? '#2f0a0a' : page.input.background }} value={form.email} onChange={e => setField("email", e.target.value)} type="email" required />
              </div>
            </div>
            <div style={page.grid2}>
              <div>
                <label style={page.label}>Business Name</label>
                <input style={{ ...page.input, borderColor: highlightFields.business_name ? '#ef4444' : page.input.borderColor, background: highlightFields.business_name ? '#2f0a0a' : page.input.background }} value={form.business_name} onChange={e => setField("business_name", e.target.value)} />
              </div>
              <div>
                <label style={page.label}>Phone Number (International Format) *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={form.countryCode || '+61'}
                    onChange={e => setForm(f => ({ ...f, countryCode: e.target.value }))}
                    style={{
                      ...page.input,
                      width: 100,
                      maxWidth: 120,
                      border: '2px solid #fff',
                      boxSizing: 'border-box',
                    }}
                    required
                  >
                    <option value="+61">+61 (AU)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+64">+64 (NZ)</option>
                    <option value="+91">+91 (IN)</option>
                    <option value="+81">+81 (JP)</option>
                    <option value="+65">+65 (SG)</option>
                    <option value="+49">+49 (DE)</option>
                    <option value="+33">+33 (FR)</option>
                    <option value="+27">+27 (ZA)</option>
                    <option value="+34">+34 (ES)</option>
                    <option value="+39">+39 (IT)</option>
                    <option value="+7">+7 (RU)</option>
                    <option value="+86">+86 (CN)</option>
                    <option value="+852">+852 (HK)</option>
                    <option value="+62">+62 (ID)</option>
                    <option value="+60">+60 (MY)</option>
                    <option value="+66">+66 (TH)</option>
                    <option value="+63">+63 (PH)</option>
                    <option value="+55">+55 (BR)</option>
                    <option value="+20">+20 (EG)</option>
                    <option value="+234">+234 (NG)</option>
                    <option value="+92">+92 (PK)</option>
                    <option value="+880">+880 (BD)</option>
                    <option value="+82">+82 (KR)</option>
                    <option value="+90">+90 (TR)</option>
                    <option value="+358">+358 (FI)</option>
                    <option value="+46">+46 (SE)</option>
                    <option value="+31">+31 (NL)</option>
                    <option value="+32">+32 (BE)</option>
                    <option value="+41">+41 (CH)</option>
                    <option value="+43">+43 (AT)</option>
                    <option value="+420">+420 (CZ)</option>
                    <option value="+48">+48 (PL)</option>
                    <option value="+351">+351 (PT)</option>
                    <option value="+386">+386 (SI)</option>
                    <option value="+421">+421 (SK)</option>
                    <option value="+36">+36 (HU)</option>
                    <option value="+40">+40 (RO)</option>
                    <option value="+372">+372 (EE)</option>
                    <option value="+370">+370 (LT)</option>
                    <option value="+371">+371 (LV)</option>
                    <option value="+47">+47 (NO)</option>
                    <option value="+45">+45 (DK)</option>
                  </select>
                  <input
                    type="tel"
                    style={{ ...page.input, flex: 1, borderColor: highlightFields.phone_number ? '#ef4444' : page.input.borderColor, background: highlightFields.phone_number ? '#2f0a0a' : page.input.background }}
                    value={form.phone_number}
                    onChange={e => setField("phone_number", e.target.value)}
                    pattern="[0-9]{6,15}"
                    required
                    placeholder="Phone (no spaces, e.g. 412345678)"
                    title="Enter your phone number in international format, e.g. 412345678 for +61 412345678"
                  />
                </div>
              </div>
            </div>
            <div style={page.grid2}>
              <div>
                <label style={page.label}>Website</label>
                <input style={{ ...page.input, borderColor: highlightFields.website ? '#ef4444' : page.input.borderColor, background: highlightFields.website ? '#2f0a0a' : page.input.background }} value={form.website} onChange={e => setField("website", e.target.value)} />
              </div>
              <div>
                <label style={page.label}>ABN/TAX Number</label>
                <input style={{ ...page.input, borderColor: highlightFields.abn_tax_number ? '#ef4444' : page.input.borderColor, background: highlightFields.abn_tax_number ? '#2f0a0a' : page.input.background }} value={form.abn_tax_number} onChange={e => setField("abn_tax_number", e.target.value)} />
              </div>
            </div>
            <div style={page.grid2}>
              <div>
                <label style={page.label}>Affiliate Code (auto-generated, used for 90-day cookie offers)</label>
                  {hasMounted ? (
                    <input
                      style={{ ...page.input, borderColor: highlightFields.affiliate_id ? '#ef4444' : page.input.borderColor, background: highlightFields.affiliate_id ? '#2f0a0a' : page.input.background, letterSpacing: 2, fontWeight: 700 }}
                      value={form.affiliate_id}
                      readOnly
                      maxLength={8}
                      disabled
                      placeholder="Will be generated on submit"
                    />
                  ) : (
                    <input
                      style={{ ...page.input, letterSpacing: 2, fontWeight: 700 }}
                      value={""}
                      readOnly
                      maxLength={8}
                      disabled
                      placeholder="Will be generated on submit"
                    />
                  )}
              </div>
              <div>
                <label style={page.label}>Facebook Handle</label>
                <input style={{ ...page.input, borderColor: highlightFields.facebook_handle ? '#ef4444' : page.input.borderColor, background: highlightFields.facebook_handle ? '#2f0a0a' : page.input.background }} value={form.facebook_handle} onChange={e => setField("facebook_handle", e.target.value)} />
              </div>
            </div>
            <div style={page.grid2}>
              <div>
                <label style={page.label}>Instagram Handle</label>
                <input style={{ ...page.input, borderColor: highlightFields.instagram_handle ? '#ef4444' : page.input.borderColor, background: highlightFields.instagram_handle ? '#2f0a0a' : page.input.background }} value={form.instagram_handle} onChange={e => setField("instagram_handle", e.target.value)} />
              </div>
              <div>
                <label style={page.label}>LinkedIn Handle</label>
                <input style={{ ...page.input, borderColor: highlightFields.linkedin_handle ? '#ef4444' : page.input.borderColor, background: highlightFields.linkedin_handle ? '#2f0a0a' : page.input.background }} value={form.linkedin_handle} onChange={e => setField("linkedin_handle", e.target.value)} />
              </div>
            </div>
            <div style={page.grid2}>
              <div>
                <label style={page.label}>TikTok Handle</label>
                <input style={{ ...page.input, borderColor: highlightFields.tictoc_handle ? '#ef4444' : page.input.borderColor, background: highlightFields.tictoc_handle ? '#2f0a0a' : page.input.background }} value={form.tictoc_handle} onChange={e => setField("tictoc_handle", e.target.value)} />
              </div>
              <div>
                <label style={page.label}>YouTube Handle</label>
                <input style={{ ...page.input, borderColor: highlightFields.youtube_handle ? '#ef4444' : page.input.borderColor, background: highlightFields.youtube_handle ? '#2f0a0a' : page.input.background }} value={form.youtube_handle} onChange={e => setField("youtube_handle", e.target.value)} />
              </div>
            </div>
            <div style={page.grid2}>
              <div>
                <label style={page.label}>Pinterest Handle</label>
                <input style={{ ...page.input, borderColor: highlightFields.pintrest_handle ? '#ef4444' : page.input.borderColor, background: highlightFields.pintrest_handle ? '#2f0a0a' : page.input.background }} value={form.pintrest_handle} onChange={e => setField("pintrest_handle", e.target.value)} />
              </div>
              <div>
                <label style={page.label}>Other Social Media Handles</label>
                <input style={{ ...page.input, borderColor: highlightFields.other_social_media_handles ? '#ef4444' : page.input.borderColor, background: highlightFields.other_social_media_handles ? '#2f0a0a' : page.input.background }} value={form.other_social_media_handles} onChange={e => setField("other_social_media_handles", e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <label style={page.label}>Marketing Tools (Email, SMS, Social Media, Blog, Website, etc) Explain your marketing strategy.</label>
                <input style={{ ...page.input, borderColor: highlightFields.marketing_tools ? '#ef4444' : page.input.borderColor, background: highlightFields.marketing_tools ? '#2f0a0a' : page.input.background }} value={form.marketing_tools} onChange={e => setField("marketing_tools", e.target.value)} />
            </div>
            <div style={{ marginTop: 18 }}>
              <label style={page.label}>Experience (Brief explanation of your experience and years in ecomm.)</label>
                <input style={{ ...page.input, borderColor: highlightFields.experience_years ? '#ef4444' : page.input.borderColor, background: highlightFields.experience_years ? '#2f0a0a' : page.input.background }} value={form.experience_years} onChange={e => setField("experience_years", e.target.value)} />
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18, color: '#22c55e', padding: '8px 16px', borderRadius: 8, display: 'inline-block' }}>
                Add your Preferred Payout details
              </div>
            </div>
            <div style={page.grid2}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <input type="checkbox" checked={form.paypal} onChange={e => setField("paypal", e.target.checked)} style={page.checkbox} />
                <label style={page.label}>PayPal</label>
              </div>
              <div>
                <label style={page.label}>PayPal User Email</label>
                <input style={{ ...page.input, borderColor: highlightFields.paypal_user_email ? '#ef4444' : page.input.borderColor, background: highlightFields.paypal_user_email ? '#2f0a0a' : page.input.background }} value={form.paypal_user_email} onChange={e => setField("paypal_user_email", e.target.value)} />
              </div>
            </div>
            <div style={page.grid2}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.bank_account} onChange={e => setField("bank_account", e.target.checked)} style={page.checkbox} />
                <label style={page.label}>Bank Account</label>
              </div>
              <div>
                <label style={page.label}>Bank Account Details</label>
                <input style={{ ...page.input, borderColor: highlightFields.bank_account_details ? '#ef4444' : page.input.borderColor, background: highlightFields.bank_account_details ? '#2f0a0a' : page.input.background }} value={form.bank_account_details} onChange={e => setField("bank_account_details", e.target.value)} />
              </div>
            </div>
            <div style={page.grid2}>
              <div>
                <label style={page.label}>BSB Number</label>
                <input style={{ ...page.input, borderColor: highlightFields.bsb_number ? '#ef4444' : page.input.borderColor, background: highlightFields.bsb_number ? '#2f0a0a' : page.input.background }} value={form.bsb_number} onChange={e => setField("bsb_number", e.target.value)} />
              </div>
              <div>
                <label style={page.label}>Account Number</label>
                <input style={{ ...page.input, borderColor: highlightFields.account_number ? '#ef4444' : page.input.borderColor, background: highlightFields.account_number ? '#2f0a0a' : page.input.background }} value={form.account_number} onChange={e => setField("account_number", e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={page.label}>Swift Code</label>
                <input style={{ ...page.input, borderColor: highlightFields.swift_code ? '#ef4444' : page.input.borderColor, background: highlightFields.swift_code ? '#2f0a0a' : page.input.background }} value={form.swift_code} onChange={e => setField("swift_code", e.target.value)} />
            </div>
            <div style={{ marginTop: 18 }}>
              <label style={page.label}>Notes to Vendor</label>
                <textarea style={{ ...page.textarea, borderColor: highlightFields.notes_to_vendor ? '#ef4444' : page.textarea.borderColor, background: highlightFields.notes_to_vendor ? '#2f0a0a' : page.textarea.background, minHeight: 90 }} value={form.notes_to_vendor} onChange={e => setField("notes_to_vendor", e.target.value)} />
            </div>
            <div style={page.grid2}>


            </div>
            <div style={page.sectionTitle}>Standard Affiliate Agreement (Summary)</div>
            <div style={page.agreementBox}>
              {"• You will not misrepresent offers or make false claims.\n" +
                "• You will comply with advertising laws and platform policies.\n" +
                "• No spam or deceptive pages.\n" +
                "• Commission is paid only on valid sales.\n" +
                "• Approval may be revoked at any time.\n" +
                "• All information must be true and accurate."}
            </div>
            <div style={page.checkboxRow}>
              <input
                type="checkbox"
                checked={form.agree_terms}
                onChange={(e) => setField("agree_terms", e.target.checked)}
                style={page.checkbox}
                required
              />
              <div>
                <div style={page.checkboxText}>I accept the affiliate agreement terms *</div>
                <div style={page.checkboxSub}>
                  I will comply with all rules and promote ethically.
                </div>
              </div>
            </div>
            <div style={page.checkboxRow}>
              <input
                type="checkbox"
                checked={form.confirm_truth}
                onChange={(e) => setField("confirm_truth", e.target.checked)}
                style={page.checkbox}
                required
              />
              <div>
                <div style={page.checkboxText}>I confirm the information is accurate *</div>
                <div style={page.checkboxSub}>
                  Applications with incomplete details may be rejected.
                </div>
              </div>
            </div>
            {/* Remove broken submit button and add a new one */}
            <div style={{ width: '100%', marginTop: 18 }}>
              <button
                type="button"
                onClick={e => {
                  if (submitting) return;
                  if (user === undefined) {
                    setStatus({ type: "error", msg: "Checking login status..." });
                    return;
                  }
                  if (!user) {
                    setStatus({ type: "error", msg: "You must be logged in to apply." });
                    return;
                  }
                  if (!canSubmit) {
                    setStatus({ type: "error", msg: "Please complete all required fields and check all required boxes above." });
                    return;
                  }
                  handleSubmit(e);
                }}
                style={{
                  width: '100%',
                  background: submitting || user === undefined || !user || !canSubmit ? '#facc15a0' : '#facc15',
                  color: '#000',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 16px',
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: (submitting || user === undefined || !user || !canSubmit) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                  boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)'
                }}
              >
                {user === undefined ? "Checking login..." : submitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
            {!canSubmit && !submitting && user && (
              <>
                <div style={{ color: '#ef4444', fontWeight: 600, marginTop: 8, fontSize: 16 }}>
                  Please complete all required fields and check all required boxes above.
                </div>
                <div style={{ color: '#0ff', fontWeight: 600, marginTop: 8, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                  {(() => {
                    const missing = [];
                    Object.entries(form).forEach(([k, v]) => {
                      if (["paypal", "paypal_user_email", "bank_account", "bank_account_details", "bsb_number", "account_number", "swift_code", "affiliate_id"].includes(k)) return;
                      if (k === "agree_terms" || k === "confirm_truth") { if (!v) missing.push(k); return; }
                      if (typeof v === "string" && !v.trim()) missing.push(k);
                    });
                    if (!((form.paypal && form.paypal_user_email.trim().length > 0) || (form.bank_account && form.bank_account_details.trim().length > 0 && form.account_number.trim().length > 0))) {
                      missing.push("payout method (PayPal or Bank)");
                    }
                    return missing.length ? `Missing/invalid: ${missing.join(", ")}` : "";
                  })()}
                </div>
              </>
            )}
            {hasMounted && user?.id && (
              <div style={{ marginTop: 8, color: '#22c55e', fontSize: 16, fontWeight: 600 }}>
                User verified! Your User Code: {user.id}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}