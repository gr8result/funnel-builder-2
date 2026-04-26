// FULL REPLACEMENT — FIXES BROKEN ENDPOINT WIRING + ENABLES LIST-BASED SMS CAMPAIGNS
//
// ✅ Keeps your existing structure + banner
// ✅ Campaign queues into sms_queue via POST /api/smsglobal/launch-sequence
// ✅ Campaign supports audience.type === "lead" or "list"
// ✅ Single sends via POST /api/smsglobal/send-single (lead_id OR manual to)
// ✅ Emoji picker kept — BIG + stays open until you close it
// ✅ Pulls lead_id from URL (?lead_id=...) and preselects Campaign + Single
// ✅ IMPORTANT: Never sends empty Authorization header (cached tokenRef)

import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../../../utils/supabase-client";

const CLEAN_FONT =
  "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'";

function s(v) {
  return String(v ?? "").trim();
}

function digitsOnly(v) {
  return s(v).replace(/[^\d]/g, "");
}

function formatPhonePretty(raw) {
  const d = digitsOnly(raw);
  if (!d) return "";
  if (d.length === 10 && d.startsWith("04"))
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return raw;
}

function normalizePhoneForSend(raw) {
  const t = s(raw);
  if (!t) return "";
  if (t.startsWith("+")) return `+${digitsOnly(t)}`;
  return digitsOnly(t);
}

const DEFAULT_TEMPLATES = [
  {
    id: "welcome_quick",
    name: "Welcome — Quick",
    text: "Hey, 👋 Thanks for connecting. Reply STOP to opt out.",
  },
  {
    id: "follow_up",
    name: "Follow-up",
    text: "Hi — are you keen on our offer? Need help choosing the best strategy? Reply YES or reply STOP to opt out.",
  },
  {
    id: "offer_short",
    name: "Offer — Short pitch",
    text: "Hey, quick one: want us to help set up your system so it runs on autopilot? Reply HELP. Reply STOP to opt out.",
  },
];

const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","😊","🙂","😉","😍","😘","😎","🤩","🤔","😴",
  "👍","👎","👏","🙏","💪","🔥","✨","⭐","✅","❌","⚠️","📞","💬","📩","📅","⏰",
  "🎉","🎯","💡","📌","🧠","🫶","❤️","💛","💚","💙","💜","🖤","🤍",
];

function BannerIcon({ size = 48 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        background: "rgba(255,255,255,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
      aria-hidden="true"
    >
      <svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M7.5 18.2 4 20V6.8C4 5.8 4.8 5 5.8 5H18.2C19.2 5 20 5.8 20 6.8V14.2C20 15.2 19.2 16 18.2 16H9.6L7.5 18.2Z"
          stroke="white"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M7.2 9.2H16.8M7.2 12H14.8"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ✅ BIGGER GLYPHS (but not bigger tiles) + DOES NOT AUTO CLOSE UNLESS ESC / OUTSIDE CLICK / Close BUTTON
function EmojiPicker({ open, onPick, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    function onDown(e) {
      // if click/tap is outside the picker container, close it
      if (!containerRef.current) return;
      const el = containerRef.current;
      if (!el.contains(e.target)) onClose?.();
    }

    window.addEventListener("keydown", onKey, true);
    // use capture so clicks are detected even if other handlers stop propagation
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 10px)",
        zIndex: 50,
        width: 720, // keep panel width as original
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.14)",
        background: "rgba(5,10,20,0.98)",
        boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
        padding: 14,
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,0.88)",
          fontSize: 18,
          marginBottom: 10,
          fontWeight: 700,
        }}
      >
        Pick emojis (stays open — press Close when done)
      </div>

      {/* keep original grid (many columns) but scale the emoji glyph only */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 12 }}>
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick?.(e)}
            style={{
              height: 64, // original tile height
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.07)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            aria-label={`emoji ${e}`}
            title={e}
          >
            {/* scale only the emoji glyph so the tile stays the same size; slightly reduced from previous */}
            <span style={{ display: "inline-block", fontSize: 36, transform: "scale(1.5)", lineHeight: 1, transformOrigin: "center" }}>
              {e}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "12px 12px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.16)",
          color: "#fff",
          fontWeight: 900,
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        Close
      </button>
    </div>
  );
}

export default function SmsMarketingPage() {
  const router = useRouter();

  const [bannerError, setBannerError] = useState("");
  const [loading, setLoading] = useState(true);
  const [smsConfig, setSmsConfig] = useState(null);
  const [smsUsage, setSmsUsage] = useState({ sent: 0, limit: 0, percentage: 0 });
  const [smsPlanTier, setSmsPlanTier] = useState(null);

  const SMS_PLAN_LABELS = {
    'sms-starter':      'Starter — A$25/month',
    'sms-growth':       'Growth — A$120/month',
    'sms-professional': 'Professional — A$229/month',
    'sms-business':     'Business — A$429/month',
    'sms-enterprise':   'Enterprise — Contact Support',
  };

  const [accessToken, setAccessToken] = useState("");
  const tokenRef = useRef("");

  const [leads, setLeads] = useState([]);
  const [lists, setLists] = useState([]);

  // Campaign audience
  const [campaignAudienceType, setCampaignAudienceType] = useState("lead");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedListId, setSelectedListId] = useState("");

  const [templates] = useState(DEFAULT_TEMPLATES);

  const [steps, setSteps] = useState([
    { templateId: "welcome_quick", delay: 0, unit: "minutes", message: DEFAULT_TEMPLATES[0].text },
    { templateId: "follow_up", delay: 1, unit: "minutes", message: DEFAULT_TEMPLATES[1].text },
    { templateId: "offer_short", delay: 1, unit: "minutes", message: DEFAULT_TEMPLATES[2].text },
  ]);

  const [sendingCampaign, setSendingCampaign] = useState(false);

  // Single audience (lead/manual only)
  const [singleAudienceType, setSingleAudienceType] = useState("lead"); // manual | lead
  const [singleLeadId, setSingleLeadId] = useState("");
  const [singleManualPhone, setSingleManualPhone] = useState("");
  const [singleMessage, setSingleMessage] = useState("");
  const [sendingSingle, setSendingSingle] = useState(false);

  // Emoji picker state
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTarget, setEmojiTarget] = useState({ kind: null, index: null }); // {kind:'step'|'single', index:number|null}

  // --- AUTH HELPERS (NO EMPTY AUTH HEADER EVER) ---
  function requireToken() {
    const t = tokenRef.current || "";
    if (!t) {
      const err = new Error("Not logged in (missing session token). Please refresh and log in again.");
      err.status = 401;
      throw err;
    }
    return t;
  }

  async function apiGet(path) {
    const token = requireToken();
    const r = await fetch(path, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false) {
      const err = new Error(j?.error || "Request failed");
      err.detail = j?.detail || null;
      err.status = r.status;
      throw err;
    }
    return j;
  }

  async function apiPost(path, body) {
    const token = requireToken();
    const r = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false) {
      const msg = j?.error || "Request failed";
      const err = new Error(msg);
      err.detail = j?.detail || j || null;
      err.status = r.status;
      throw err;
    }
    return j;
  }

  const leadOptions = useMemo(() => {
    const arr = Array.isArray(leads) ? leads : [];
    return arr.map((l) => {
      const labelParts = [];
      if (s(l?.name)) labelParts.push(s(l.name));
      if (s(l?.email)) labelParts.push(s(l.email));
      const ph = s(l?.phone_number || l?.mobile_phone || l?.phone || l?.mobile);
      if (ph) labelParts.push(ph);
      const label = labelParts.length ? labelParts.join(" — ") : l?.id;
      return { id: l?.id, label };
    });
  }, [leads]);

  const listOptions = useMemo(() => {
    const arr = Array.isArray(lists) ? lists : [];
    return arr.map((item) => {
      const count = Number(item?.subscriber_count || item?.count || 0);
      const name = s(item?.name) || "Untitled list";
      return {
        id: item?.id,
        label: count > 0 ? `${name} — ${count} contact${count === 1 ? "" : "s"}` : name,
      };
    });
  }, [lists]);

  // ✅ keep token in sync even if session refreshes
  useEffect(() => {
    let alive = true;

    async function initToken() {
      try {
        const { data } = await supabase.auth.getSession();
        const t = data?.session?.access_token || "";
        if (!alive) return;
        setAccessToken(t);
        tokenRef.current = t;
      } catch {
        if (!alive) return;
        setAccessToken("");
        tokenRef.current = "";
      }
    }

    initToken();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const t = session?.access_token || "";
      setAccessToken(t);
      tokenRef.current = t;
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ✅ preload lead_id from URL (both campaign + single)
  useEffect(() => {
    const qLead = s(router?.query?.lead_id);
    if (qLead) {
      setSelectedLeadId(qLead);
      setSingleAudienceType("lead");
      setSingleLeadId(qLead);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router?.query?.lead_id]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setBannerError("");

      try {
        if (!tokenRef.current) {
          throw new Error("Not logged in (missing session). Please refresh and log in again.");
        }

        const [leadRes, listRes] = await Promise.all([
          apiGet("/api/crm/leads?limit=50000"),
          apiGet("/api/crm/lead-lists"),
        ]);
        const leadArr = Array.isArray(leadRes?.leads) ? leadRes.leads : [];
        const listArr = Array.isArray(listRes?.lists) ? listRes.lists : [];

        if (!alive) return;

        setLeads(leadArr);
        setLists(listArr);

        const qLead = s(router?.query?.lead_id);

        if (qLead) {
          setCampaignAudienceType("lead");
          setSelectedLeadId(qLead);
          setSingleLeadId(qLead);
        } else {
          if (!selectedLeadId && leadArr.length) setSelectedLeadId(leadArr[0].id);
          if (!singleLeadId && leadArr.length) setSingleLeadId(leadArr[0].id);
        }

        if (!selectedListId && listArr.length) setSelectedListId(listArr[0].id);

        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setBannerError(e?.message ? `Failed to load SMS data: ${e.message}` : "Failed to load SMS data");
        setLoading(false);
      }
    }

    if (tokenRef.current) load();
    else {
      setLoading(false);
      setBannerError("Not logged in (missing session). Please refresh and log in again.");
    }

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Load SMS config to check sender_id
  useEffect(() => {
    let alive = true;

    async function loadSmsConfig() {
      try {
        if (!tokenRef.current) return;
        const config = await apiGet("/api/debug/check-sms-config");
        if (!alive) return;
        setSmsConfig(config);
      } catch (e) {
        console.warn("Could not load SMS config:", e.message);
      }
    }

    if (tokenRef.current) loadSmsConfig();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Load SMS usage for slider under banner
  useEffect(() => {
    let alive = true;

    async function loadSmsUsage() {
      try {
        if (!tokenRef.current) return;
        const usage = await apiGet("/api/usage/check-limits?check=sms");
        const u = usage?.stats?.sms;
        if (!alive || !u) return;

        setSmsUsage({
          sent: Number(u.sent) || 0,
          limit: typeof u.limit === "number" ? u.limit : 0,
          percentage: Number(u.percentage) || 0,
        });
      } catch (e) {
        console.warn("Could not load SMS usage:", e.message);
      }
    }

    if (tokenRef.current) loadSmsUsage();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Load SMS plan tier from accounts table
  useEffect(() => {
    async function loadSmsPlan() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) return;
        const { data } = await supabase
          .from('accounts')
          .select('sms_plan_tier')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (data?.[0]?.sms_plan_tier) setSmsPlanTier(data[0].sms_plan_tier);
      } catch (e) {
        console.warn('Could not load SMS plan tier:', e.message);
      }
    }
    loadSmsPlan();
  }, []);

  const smsLimitDisplay = smsUsage.limit > 0 ? smsUsage.limit.toLocaleString() : "No limit yet";
  const smsPercent = smsUsage.limit > 0
    ? Math.min(100, Math.round((smsUsage.sent / smsUsage.limit) * 100))
    : Math.max(0, Math.min(100, smsUsage.percentage || 0));
  const smsUsageStage =
    smsPercent >= 100
      ? {
          tone: "critical",
          title: "Hard Stop (100%)",
          text: "SMS sending is blocked until you upgrade your SMS plan.",
        }
      : smsPercent >= 95
      ? {
          tone: "critical",
          title: "Critical Warning (95%+)",
          text: "You are close to hard stop at 100%. Upgrade now to avoid interruptions.",
        }
      : smsPercent >= 80
      ? {
          tone: "warning",
          title: "Usage Notice (80%+)",
          text: "SMS sending is still active, but your allowance is running low.",
        }
      : null;
  const senderIdValue = s(smsConfig?.account?.sender_id);
  const businessNameValue = s(smsConfig?.account?.business_name);
  const actualOriginValue = s(smsConfig?.priority?.actual_origin_used);
  const fallbackOriginValue = s(smsConfig?.env?.DEFAULT_SMS_ORIGIN || "gr8result");
  const isFallbackOnlyOrigin =
    !senderIdValue &&
    (!actualOriginValue ||
      actualOriginValue.toLowerCase() === fallbackOriginValue.toLowerCase() ||
      actualOriginValue.toLowerCase() === "gr8result");
  const showSenderIdWarning = Boolean(smsConfig) && !senderIdValue && !businessNameValue && isFallbackOnlyOrigin;

  function setStep(i, patch) {
    setSteps((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function applyTemplateToStep(i, templateId) {
    const t = templates.find((x) => x.id === templateId);
    setStep(i, { templateId, message: t?.text || "" });
  }

  function openEmojiForStep(i) {
    setEmojiTarget({ kind: "step", index: i });
    setEmojiOpen(true);
  }

  function openEmojiForSingle() {
    setEmojiTarget({ kind: "single", index: null });
    setEmojiOpen(true);
  }

  function handlePickEmoji(e) {
    if (emojiTarget.kind === "step" && typeof emojiTarget.index === "number") {
      const i = emojiTarget.index;
      setSteps((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], message: (next[i]?.message || "") + e };
        return next;
      });
    } else if (emojiTarget.kind === "single") {
      setSingleMessage((m) => (m || "") + e);
    }
    // DO NOT CLOSE
  }

  async function startCampaign() {
    setBannerError("");
    setSendingCampaign(true);

    try {
      requireToken();

      const type = s(campaignAudienceType || "lead").toLowerCase();

      let audience;
      if (type === "list") {
        const list_id = s(selectedListId);
        if (!list_id) throw new Error("Pick a list.");
        audience = { type: "list", list_id };
      } else {
        const lead_id = s(selectedLeadId);
        if (!lead_id) throw new Error("Pick a lead.");
        audience = { type: "lead", lead_id };
      }

      const payload = {
        audience,
        steps: steps
          .map((st) => ({
            delay: Number(st.delay || 0),
            unit: s(st.unit || "minutes"),
            message: s(st.message),
          }))
          .filter((x) => x.message)
          .slice(0, 3),
      };

      const r = await apiPost("/api/smsglobal/launch-sequence", payload);
      const policyPopup = r?.usage?.policy?.popupMessage;

      let msg = `Queued: ${r?.queued ?? 0} SMS`;
      if (r?.auto_flush?.error) {
        msg += ` — ⚠️  (flush: ${r.auto_flush.error})`;
      } else if (r?.auto_flush?.sent) {
        msg += ` — ✅ Sent: ${r.auto_flush.sent}`;
      }
      setBannerError(msg);
      if (policyPopup) alert(policyPopup);
    } catch (e) {
      const detail = e?.detail?.detail || e?.detail?.message || "";
      setBannerError(
        e?.message
          ? `Server error: ${e.message}${detail ? ` — ${detail}` : ""}`
          : "Server error"
      );
    } finally {
      setSendingCampaign(false);
    }
  }

  async function sendSingle() {
    setBannerError("");
    setSendingSingle(true);

    try {
      requireToken();

      const msg = s(singleMessage);
      if (!msg) throw new Error("Enter a message.");

      // ✅ correct route is /api/smsglobal/SMSSend
      if (singleAudienceType === "lead") {
        const lead_id = s(singleLeadId);
        if (!lead_id) throw new Error("Pick a lead.");
        const r = await apiPost("/api/smsglobal/send-single", { lead_id, message: msg });
        const policyPopup = r?.usage?.policy?.popupMessage;
        setBannerError(`Queued OK${r?.auto_flush?.sent ? ` — Sent: ${r.auto_flush.sent}` : ""}`);
        if (policyPopup) alert(policyPopup);
        setSingleMessage("");
        return;
      }

      if (singleAudienceType === "manual") {
        const to = normalizePhoneForSend(singleManualPhone);
        if (!to) throw new Error("Enter a phone number.");
        const r = await apiPost("/api/smsglobal/send-single", { to, message: msg });
        const policyPopup = r?.usage?.policy?.popupMessage;
        setBannerError(`Queued OK${r?.auto_flush?.sent ? ` — Sent: ${r.auto_flush.sent}` : ""}`);
        if (policyPopup) alert(policyPopup);
        setSingleMessage("");
        return;
      }

      throw new Error("Invalid single audience type.");
    } catch (e) {
      const detail = e?.detail?.detail || e?.detail?.raw || e?.detail?.message || "";
      setBannerError(
        e?.message
          ? `Server error: ${e.message}${detail ? ` — ${detail}` : ""}`
          : "Server error"
      );
    } finally {
      setSendingSingle(false);
    }
  }

  return (
    <>
      <Head>
        <title>SMS Marketing — GR8 RESULT</title>
      </Head>

      <div style={{ fontFamily: CLEAN_FONT, padding: 18 }}>
        {/* Banner */}
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto 14px auto",
            padding: "26px 28px",
            borderRadius: 12,
            background: "linear-gradient(90deg, rgba(12,148,149,0.95), rgba(9,113,126,0.95))",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <BannerIcon size={48} />
            <div>
                <div style={{ fontSize: 48, fontWeight: 500, lineHeight: 1.05, marginBottom: 12 }}>SMS Marketing</div>
                <div style={{ opacity: 0.9, fontSize: 18 }}>
                  Templates + single SMS + scheduled SMS campaigns (1–3 steps).
                </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => router.push("/modules/email/crm/sms-dashboard")}
              style={{
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(0,0,0,0.18)",
                color: "#fff",
                padding: "12px 48px",
                borderRadius: 999,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Current SMS Plan banner */}
        <div style={{ maxWidth: 1320, margin: "0 auto 10px auto", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Current SMS Plan</span>
            <div style={{ color: smsPlanTier ? "#86efac" : "rgba(255,255,255,0.4)", fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {smsPlanTier ? (SMS_PLAN_LABELS[smsPlanTier] || smsPlanTier) : "No plan selected"}
            </div>
          </div>
          <button onClick={() => router.push("/modules/billing/sms-plans")} style={{ background: "#facc15", color: "#111827", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {smsPlanTier ? "Manage / Upgrade Plan" : "Select a Plan"}
          </button>
        </div>

        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto 10px auto",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: 600 }}>Monthly SMS Usage</span>
            <span style={{ color: "rgba(255,255,255,0.82)", fontSize: 15 }}>
              {smsUsage.sent.toLocaleString()} / {smsLimitDisplay}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={smsPercent}
            style={{
              position: "relative",
              width: "100%",
              height: 28,
              borderRadius: 999,
              background: "#0f172a",
              border: "1px solid #334155",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                zIndex: 1,
                height: "100%",
                width: `${smsPercent}%`,
                background: "linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)",
                transition: "width 0.3s ease",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "80%",
                top: 0,
                bottom: 0,
                width: 2,
                background: "#f59e0b",
                zIndex: 2,
                opacity: 0.95,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "calc(80% - 18px)",
                top: -18,
                zIndex: 3,
                fontSize: 11,
                color: "#f59e0b",
                fontWeight: 700,
              }}
            >
              80%
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, color: "#94a3b8", fontSize: 12 }}>
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>

          {smsUsageStage && (
            <div
              style={{
                marginTop: 10,
                borderRadius: 10,
                padding: "10px 12px",
                border: smsUsageStage.tone === "critical" ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(245,158,11,0.5)",
                background: smsUsageStage.tone === "critical" ? "rgba(239,68,68,0.14)" : "rgba(245,158,11,0.12)",
                color: smsUsageStage.tone === "critical" ? "#fecaca" : "#fde68a",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                fontSize: 13,
              }}
            >
              <span>
                <strong>{smsUsageStage.title}</strong> {smsUsageStage.text}
              </span>
              <button
                type="button"
                onClick={() => router.push("/modules/billing/sms-plans")}
                style={{
                  background: "#facc15",
                  color: "#111827",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Upgrade SMS Plan
              </button>
            </div>
          )}
        </div>

        {/* Error bar */}
        {(bannerError || loading) && (
          <div
            style={{
              maxWidth: 1320,
              margin: "0 auto 10px auto",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(244,63,94,0.55)",
              background: "rgba(244,63,94,0.10)",
              color: "#ffd6dd",
              fontWeight: 500,
            }}
          >
            {loading ? "Loading…" : bannerError}
          </div>
        )}

        {/* SMS Config Warning */}
        {showSenderIdWarning && (
          <div
            style={{
              maxWidth: 1320,
              margin: "0 auto 10px auto",
              padding: "14px 16px",
              borderRadius: 10,
              border: "2px solid rgba(251,191,36,0.6)",
              background: "rgba(251,191,36,0.12)",
              color: "#fef3c7",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              ⚠️ SMS Sender ID Not Set
            </div>
            <div style={{ marginBottom: 10, fontSize: 15, opacity: 0.95 }}>
              Your SMS sender name is not activated yet because <strong>accounts.sender_id and business_name are empty</strong>.
            </div>
            <div style={{ marginBottom: 10, fontSize: 14, opacity: 0.9 }}>
              Phone verification on the account page does <strong>not</strong> fill this automatically. The missing piece is the separate SMS Activation access code / sender ID.
            </div>
            <div style={{ marginBottom: 10, fontSize: 14, opacity: 0.9 }}>
              <strong>Current config:</strong>
            </div>
            <div style={{ background: "rgba(0,0,0,0.25)", padding: 12, borderRadius: 8, fontSize: 13, fontFamily: "monospace", marginBottom: 12 }}>
              sender_id: <strong style={{color: "#f87171"}}>{smsConfig.account?.sender_id || "(EMPTY)"}</strong><br/>
              business_name: {smsConfig.account?.business_name || "(empty)"}<br/>
              fallback: {smsConfig.env?.DEFAULT_SMS_ORIGIN || "gr8result"}<br/>
              <br/>
              <strong>SMS will send from: {smsConfig.priority?.actual_origin_used}</strong>
            </div>
            <div style={{ fontSize: 14, marginBottom: 10 }}>
              <strong>To fix:</strong> Go to Account page → SMS Activation section → enter the access code / sender name you received by email → click "Activate SMS"
            </div>
            <button
              onClick={() => router.push("/account")}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                background: "#facc15",
                color: "#000",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 15,
              }}
            >
              Go to Account Page →
            </button>
          </div>
        )}

        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          {/* Scheduled campaign */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 12px 34px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ color: "#facc15", fontWeight: 600, fontSize: 24, marginBottom: 4 }}>
              SMS Campaign (scheduled)
            </div>
            <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 16, marginBottom: 12 }}>
              Queue up to 3 SMS messages. Delays are “since previous step”.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, marginBottom: 6 }}>
                  Send campaign to
                </div>
                <select
                  className="gr8Select"
                  value={campaignAudienceType}
                  onChange={(e) => setCampaignAudienceType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontWeight: 500,
                  }}
                >
                  <option value="lead">One lead</option>
                  <option value="list">A list</option>
                </select>
              </div>

              <div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, marginBottom: 6 }}>
                  {campaignAudienceType === "list" ? "Select list" : "Select lead"}
                </div>
                {campaignAudienceType === "list" ? (
                  <select
                    className="gr8Select"
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.12)",
                      fontWeight: 500,
                    }}
                  >
                    {listOptions.length ? (
                      listOptions.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))
                    ) : (
                      <option value="">(No lists loaded for this user)</option>
                    )}
                  </select>
                ) : (
                  <select
                    className="gr8Select"
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.12)",
                      fontWeight: 500,
                    }}
                  >
                    {leadOptions.length ? (
                      leadOptions.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))
                    ) : (
                      <option value="">(No leads loaded for this user)</option>
                    )}
                  </select>
                )}
              </div>
            </div>

            {/* Steps */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid rgba(59,130,246,0.35)",
                    background: "rgba(0,0,0,0.25)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ color: "#facc15", fontWeight: 600, marginBottom: 2 }}>Step {i + 1}</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, marginBottom: 10 }}>
                    {i === 0 ? "Delay before step 1. Set 0 to send immediately." : `Delay after step ${i}.`}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 92px 130px", gap: 8 }}>
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 16, marginBottom: 6 }}>Template</div>
                      <select
                        className="gr8Select"
                        value={steps[i]?.templateId || ""}
                        onChange={(e) => applyTemplateToStep(i, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: "rgba(0,0,0,0.55)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.12)",
                          fontWeight: 500,
                        }}
                      >
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 16, marginBottom: 6 }}>Delay</div>
                      <input
                        value={String(steps[i]?.delay ?? 0)}
                        onChange={(e) => setStep(i, { delay: Number(e.target.value || 0) })}
                        type="number"
                        min="0"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: "rgba(0,0,0,0.55)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.12)",
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 16, marginBottom: 6 }}>Unit</div>
                      <select
                        className="gr8Select"
                        value={steps[i]?.unit || "minutes"}
                        onChange={(e) => setStep(i, { unit: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: "rgba(0,0,0,0.55)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.12)",
                          fontWeight: 600,
                        }}
                      >
                        <option value="minutes">minutes</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 16 }}>Message</div>

                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => openEmojiForStep(i)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Show emojis
                        </button>

                        <EmojiPicker
                          open={emojiOpen && emojiTarget.kind === "step" && emojiTarget.index === i}
                          onPick={handlePickEmoji}
                          onClose={() => setEmojiOpen(false)}
                        />
                      </div>
                    </div>

                    <textarea
                      value={steps[i]?.message || ""}
                      onChange={(e) => setStep(i, { message: e.target.value })}
                      rows={3}
                      style={{
                        width: "100%",
                        marginTop: 6,
                        padding: "10px 10px",
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.55)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.12)",
                        fontSize: 16,
                        fontWeight: 600,
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={startCampaign}
                disabled={sendingCampaign}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "rgba(34,197,94,0.18)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  color: "#d7ffe6",
                  fontWeight: 600,
                  cursor: sendingCampaign ? "not-allowed" : "pointer",
                }}
              >
                {sendingCampaign ? "Queuing…" : "Start SMS campaign"}
              </button>

              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 16 }}>
                Leads loaded: <b>{Array.isArray(leads) ? leads.length : 0}</b>
                {" · "}
                Lists loaded: <b>{Array.isArray(lists) ? lists.length : 0}</b>
              </div>
            </div>
          </div>

          {/* Single SMS */}
          <div
            style={{
              marginTop: 14,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 12px 34px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ color: "#facc15", fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Single SMS</div>
            <div style={{ color: "rgb(123, 214, 48)", fontSize: 24, marginBottom: 12 }}>
              Use keypad + templates for quick one-off messages.
            </div>

            {/* Single audience row */}
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ color: "rgb(123, 214, 48)", fontSize: 16, marginBottom: 6 }}>Send to</div>
                <select
                  className="gr8Select"
                  value={singleAudienceType}
                  onChange={(e) => setSingleAudienceType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontWeight: 500,
                  }}
                >
                  <option value="lead">A lead (pick)</option>
                  <option value="manual">One number (manual)</option>
                </select>
              </div>

              <div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, marginBottom: 6 }}>
                  {singleAudienceType === "manual" ? "Phone number" : "Select lead"}
                </div>

                {singleAudienceType === "manual" ? (
                  <input
                    value={formatPhonePretty(singleManualPhone)}
                    onChange={(e) => setSingleManualPhone(e.target.value)}
                    placeholder="0417… or +61417…"
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.12)",
                      fontWeight: 600,
                    }}
                  />
                ) : (
                  <select
                    className="gr8Select"
                    value={singleLeadId}
                    onChange={(e) => setSingleLeadId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.12)",
                      fontWeight: 500,
                    }}
                  >
                    {leadOptions.length ? (
                      leadOptions.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))
                    ) : (
                      <option value="">(No leads loaded for this user)</option>
                    )}
                  </select>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14 }}>
              {/* Keypad */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(0,0,0,0.20)",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {["1","2","3","4","5","6","7","8","9","+","0","⌫"].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        if (singleAudienceType !== "manual") return;
                        if (k === "⌫") return setSingleManualPhone((p) => (p || "").slice(0, -1));
                        setSingleManualPhone((p) => (p || "") + k);
                      }}
                      style={{
                        padding: "16px 0", // keep original tile padding/height
                        borderRadius: 12,
                        background: "rgba(99,102,241,0.18)",
                        border: "1px solid rgba(99,102,241,0.35)",
                        color: "rgb(123, 214, 48)",
                        fontWeight: 500,
                        cursor: singleAudienceType === "manual" ? "pointer" : "not-allowed",
                        opacity: singleAudienceType === "manual" ? 1 : 0.85,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        // base fontSize reduced so scaled glyph fits cleanly
                        fontSize: 28,
                        lineHeight: "1",
                      }}
                    >
                      {/* scale only the digit glyph; keeps tile size unchanged */}
                      <span style={{ display: "inline-block", transform: "scale(1.9)", transformOrigin: "center", lineHeight: 1 }}>
                        {k}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSingleManualPhone("")}
                  disabled={singleAudienceType !== "manual"}
                  style={{
                    width: "100%",
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: singleAudienceType === "manual" ? "pointer" : "not-allowed",
                    opacity: singleAudienceType === "manual" ? 1 : 0.35,
                  }}
                >
                  Clear
                </button>
              </div>

              {/* Message + buttons */}
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <button
                    onClick={sendSingle}
                    disabled={sendingSingle}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "rgba(34,197,94,0.18)",
                      border: "1px solid rgba(34,197,94,0.35)",
                      color: "#d7ffe6",
                      fontWeight: 700,
                      cursor: sendingSingle ? "not-allowed" : "pointer",
                    }}
                  >
                    {sendingSingle ? "Sending…" : "Send SMS"}
                  </button>

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={openEmojiForSingle}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Show emojis
                    </button>

                    <EmojiPicker
                      open={emojiOpen && emojiTarget.kind === "single"}
                      onPick={handlePickEmoji}
                      onClose={() => setEmojiOpen(false)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 6, color: "rgb(255, 253, 253)", fontSize: 24 }}>SMS message</div>
                <textarea
                  value={singleMessage}
                  onChange={(e) => setSingleMessage(e.target.value)}
                  placeholder="Type message…"
                  rows={4}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontSize: 16,
                    fontWeight: 600,
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          .gr8Select option {
            background: #0b1220;
            color: #ffffff;
          }
          .gr8Select optgroup {
            background: #0b1220;
            color: #ffffff;
          }
        `}</style>
      </div>
    </>
  );
}