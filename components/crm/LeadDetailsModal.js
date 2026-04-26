// /components/crm/LeadDetailsModal.js
// FULL REPLACEMENT
//
// ✅ Keeps LEFT dialer (BrowserDialer) intact
// ✅ NO “audio player panel above notes” (recordings are rendered as compact timeline rows INSIDE the Notes box)
// ✅ DOES NOT write any junk text into notes (NO SID markers / NO auto-import text)
// ✅ Loads recordings from Supabase crm_calls via server API: /api/crm/lead-call-recordings (service role)
// ✅ Also tries Twilio list endpoint (optional): /api/twilio/list-call-recordings?phone=...
// ✅ Plays audio using:
//    - recordingUrl -> /api/twilio/recording-audio?url=...
//    - recordingSid (RE...) -> /api/twilio/recording?sid=...
// ✅ Dedupes + sorts newest first
// ✅ Fixes the hard-coded placeholder name (“Grant”) to generic text

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabase-client";
import LeadInfoCard from "./LeadInfoCard";
import BrowserDialer from "../telephony/BrowserDialer";
import SendToAutomationPanel from "./SendToAutomationPanel";

const LEAD_SOURCE_OPTIONS = [
  "Website Form",
  "CSV Import",
  "Manual Entry",
  "Referral",
  "Facebook Ads",
  "Google Ads",
  "SMS Campaign",
  "Email Campaign",
  "Automation",
  "Phone Inquiry",
  "Other",
];

const DEFAULT_QUOTE_TEMPLATES = [
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

const QUOTE_LAYOUT_OPTIONS = [
  {
    id: "modern",
    name: "Modern Gold",
    description: "Bold branded header with strong highlights.",
    accent: "#f59e0b",
    banner: "linear-gradient(135deg,#f59e0b,#facc15)",
    panel: "#fff7ed",
  },
  {
    id: "classic",
    name: "Classic Blue",
    description: "Corporate styling with a clean blue header.",
    accent: "#2563eb",
    banner: "linear-gradient(135deg,#1d4ed8,#60a5fa)",
    panel: "#eff6ff",
  },
  {
    id: "minimal",
    name: "Minimal Mono",
    description: "A minimal clean document style for formal quotes.",
    accent: "#334155",
    banner: "linear-gradient(135deg,#0f172a,#334155)",
    panel: "#f8fafc",
  },
];

export default function LeadDetailsModal({
  isOpen,
  lead,
  stages = [],
  userId,
  fontScale = 1.00,
  onClose,
  onNotesUpdated,
  crmMeta = {},
  teamOptions = [],
  onCrmMetaSave,
}) {
  const router = useRouter();

  if (!isOpen || !lead) return null;

  // -------------------- HELPERS --------------------
  const scaled = (v) => Math.round(v * fontScale);

  function s(v) {
    return String(v ?? "").trim();
  }

  function normalizePhoneE164AU(raw) {
    let v = s(raw);
    if (!v) return "";
    v = v.replace(/[^\d+]/g, "");
    if (!v) return "";
    if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
    if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);
    return v;
  }

  function formatCallTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatDurationSeconds(value) {
    if (value == null) return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    if (n < 60) return `${n}s`;
    const m = Math.floor(n / 60);
    const rem = n % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m}m ${rem}s`;
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

    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
      return value;
    }

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

  function leadMetaStorageKey(uid) {
    return `crm:pipeline:leadMeta:${uid || "guest"}`;
  }

  function quoteTemplatesKey(uid) {
    return `crm:quotes:templates:${uid || "guest"}`;
  }

  function quoteBrandingKey(uid) {
    return `crm:quotes:branding:${uid || "guest"}`;
  }

  function defaultQuoteExpiry() {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }

  function normaliseQuoteItems(items) {
    const source = Array.isArray(items) ? items : [];
    const cleaned = source
      .map((item) => {
        const description = String(item?.description ?? item?.title ?? "");
        return {
          description,
          qty: Math.max(1, Number(item?.qty || 1) || 1),
          price: Math.max(0, Number(item?.price || 0) || 0),
          imageUrl: resolvePublicAssetUrl(item?.imageUrl || item?.image || item?.photo || ""),
        };
      })
      .filter((item) => item.description.trim() || item.qty || item.price || item.imageUrl);

    return cleaned.length ? cleaned : [{ description: "", qty: 1, price: 0, imageUrl: "" }];
  }

  function calcQuoteTotals(items, taxRate = 10) {
    const subtotal = (items || []).reduce((sum, item) => sum + (Number(item?.qty || 0) * Number(item?.price || 0)), 0);
    const safeTax = Math.max(0, Number(taxRate || 0));
    const tax = subtotal * (safeTax / 100);
    return {
      subtotal,
      tax,
      total: subtotal + tax,
    };
  }

  function loadQuoteTemplates(uid) {
    if (typeof window === "undefined") return DEFAULT_QUOTE_TEMPLATES;
    try {
      const raw = window.localStorage.getItem(quoteTemplatesKey(uid));
      const parsed = raw ? JSON.parse(raw) : [];
      const custom = Array.isArray(parsed) ? parsed : [];
      const byId = new Map();
      [...DEFAULT_QUOTE_TEMPLATES, ...custom].forEach((template) => {
        if (!template?.id) return;
        byId.set(template.id, {
          ...template,
          items: normaliseQuoteItems(template.items),
          notes: s(template.notes),
          terms: s(template.terms),
          taxRate: Math.max(0, Number(template.taxRate || 0)),
        });
      });
      return Array.from(byId.values());
    } catch {
      return DEFAULT_QUOTE_TEMPLATES;
    }
  }

  function normaliseDealMeta(source = {}) {
    return {
      team: s(source.team),
      owner: joinList(parseList(source.owner)),
      priority: s(source.priority || "Medium"),
      dealValue: s(source.dealValue),
      probability: s(source.probability || "25"),
      closeDate: s(source.closeDate),
      source: s(source.source),
      product: s(source.product),
      status: s(source.status || "open"),
      quoteStatus: s(source.quoteStatus || "draft"),
      quoteNumber: s(source.quoteNumber),
      quoteTemplateId: s(source.quoteTemplateId),
      quoteTemplateName: s(source.quoteTemplateName),
      quoteLayout: s(source.quoteLayout || "modern"),
      quoteValidUntil: s(source.quoteValidUntil || defaultQuoteExpiry()),
      quoteTaxRate: Math.max(0, Number(source.quoteTaxRate ?? 10) || 0),
      quoteItems: normaliseQuoteItems(source.quoteItems),
      quoteNotes: s(source.quoteNotes || "Thank you for the opportunity to quote for this work."),
      quoteTerms: s(source.quoteTerms || "This quotation is valid for 14 days and subject to final approval."),
      quoteEmailSubject: s(source.quoteEmailSubject),
      quoteEmailMessage: s(source.quoteEmailMessage || "Please find your quotation attached as a PDF. Let me know if you would like any adjustments or if you are ready to proceed."),
      quoteEmailSignature: s(source.quoteEmailSignature),
      invoiceStatus: s(source.invoiceStatus || "not_sent"),
      paymentStatus: s(source.paymentStatus || "unpaid"),
      invoiceNumber: s(source.invoiceNumber),
      nextStep: s(source.nextStep),
      outcome: s(source.outcome),
      tags: s(source.tags),
    };
  }

  function parseList(value) {
    return String(value || "")
      .split(/,|\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function joinList(items) {
    return Array.from(new Set((items || []).map((item) => s(item)).filter(Boolean))).join(", ");
  }

  function toggleListItem(currentValue, item) {
    const currentItems = parseList(currentValue);
    if (currentItems.includes(item)) {
      return joinList(currentItems.filter((entry) => entry !== item));
    }
    return joinList([...currentItems, item]);
  }

  function getInitials(value) {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return "•";
    return parts.map((part) => part[0]?.toUpperCase() || "").join("");
  }

  function getRenderableAssetUrl(rawValue, options = {}) {
    const resolved = resolvePublicAssetUrl(rawValue);
    if (!resolved) return "";

    const maxDataLength = options.transportSafe ? 2000000 : 6000000;
    if (resolved.startsWith("data:") && resolved.length > maxDataLength) {
      return "";
    }

    return resolved;
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

  function buildDefaultQuoteEmailMessage(meta = {}) {
    const firstName = s(lead?.name).split(/\s+/)[0] || "there";
    const offerName = s(meta?.product || meta?.quoteTemplateName) || "the proposed work";
    return `Hi ${firstName},\n\nPlease find your quotation for ${offerName} attached as a PDF.\n\nIf you would like any changes or have any questions, simply reply to this email and I will update it for you.\n\nThank you,`;
  }

  function buildDefaultQuoteEmailSignature(branding = {}) {
    return [
      s(branding?.companyName),
      s(branding?.email),
      s(branding?.phone),
      s(branding?.website),
      s(branding?.address),
    ]
      .filter(Boolean)
      .join("\n");
  }

  function loadStoredDealMeta(uid, leadId) {
    if (typeof window === "undefined" || !leadId) return {};
    try {
      const raw = window.localStorage.getItem(leadMetaStorageKey(uid));
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed?.[leadId] || {};
    } catch {
      return {};
    }
  }

  // Clean ONLY legacy “Call recording ready...” junk. DOES NOT remove real user notes.
  function stripLegacyCallJunk(text) {
    const raw = String(text || "");
    const lines = raw.split(/\r?\n/);
    const out = [];

    let skipping = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const l = line.trim();

      if (/^Call recording ready/i.test(l)) {
        skipping = true;
        continue;
      }

      if (skipping) {
        if (!l) skipping = false;
        continue;
      }

      out.push(line);
    }

    return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd();
  }

  // Try to extract a Twilio Recording SID from a Twilio RecordingUrl
  // Typical: https://api.twilio.com/2010-04-01/Accounts/{AC}/Recordings/RE123....json
  function extractRecordingSidFromUrl(url) {
    const u = s(url);
    if (!u) return "";
    const m = u.match(/\/Recordings\/(RE[a-zA-Z0-9]+)(?:\.json)?/);
    return m?.[1] || "";
  }

  function prettyTemplateName(value) {
    return String(value || "")
      .replace(/\.html$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function personaliseTemplate(html) {
    const firstName = s(lead?.name).split(/\s+/)[0] || "there";
    return String(html || "")
      .replace(/\{\{\s*name\s*\}\}/gi, lead?.name || firstName)
      .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
      .replace(/\{\{\s*email\s*\}\}/gi, lead?.email || "")
      .replace(/\{\{\s*phone\s*\}\}/gi, lead?.phone || "");
  }

  // -------------------- STYLES / COLORS --------------------
  const stageColor = stages.find((st) => st.id === lead.stage)?.color || "#3b82f6";
  const panelTint = {
    background: `linear-gradient(135deg, rgba(15,23,42,0.98), ${stageColor}33)`,
  };

  // -------------------- STATE --------------------
  const [leadNotes, setLeadNotes] = useState(stripLegacyCallJunk(lead.notes || ""));
  const [leadTasks, setLeadTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [dealMeta, setDealMeta] = useState(() => normaliseDealMeta({ source: lead?.source, tags: lead?.tags, ...lead?.crmMeta, ...crmMeta }));

  const [newTaskType, setNewTaskType] = useState("phone_call");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");

  // voice-to-text (microphone)
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const recordingRef = useRef(false);
  const silenceTimeoutRef = useRef(null);

  // dialer toggle
  const [showDialer, setShowDialer] = useState(true);

  // recordings (merged)
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");
  const [mergedRecordings, setMergedRecordings] = useState([]);

  // calendar
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // automation panel
  const [showAutomation, setShowAutomation] = useState(false);

  // email composer
  const [savedEmailTemplates, setSavedEmailTemplates] = useState([]);
  const [savedEmailsLoading, setSavedEmailsLoading] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [quoteActionStatus, setQuoteActionStatus] = useState("");
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [quoteTemplates, setQuoteTemplates] = useState(DEFAULT_QUOTE_TEMPLATES);
  const [accountBranding, setAccountBranding] = useState({
    companyName: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    logoUrl: "",
  });
  const [accountBrandingLoaded, setAccountBrandingLoaded] = useState(false);

  const ownerOptions = useMemo(() => {
    const values = new Set();
    for (const team of teamOptions || []) {
      if (team?.manager) values.add(String(team.manager).trim());
      parseList(team?.members).forEach((member) => values.add(member));
    }
    parseList(dealMeta?.owner).forEach((owner) => values.add(owner));
    return Array.from(values).filter(Boolean);
  }, [teamOptions, dealMeta?.owner]);

  const assignedOwners = useMemo(() => parseList(dealMeta?.owner), [dealMeta?.owner]);
  const tagItems = useMemo(() => parseList(dealMeta?.tags), [dealMeta?.tags]);
  const quoteItems = useMemo(() => normaliseQuoteItems(dealMeta?.quoteItems), [dealMeta?.quoteItems]);
  const quoteTotals = useMemo(() => calcQuoteTotals(quoteItems, dealMeta?.quoteTaxRate), [quoteItems, dealMeta?.quoteTaxRate]);
  const activeQuoteTemplate = useMemo(
    () => quoteTemplates.find((template) => template.id === dealMeta?.quoteTemplateId) || null,
    [quoteTemplates, dealMeta?.quoteTemplateId]
  );
  const activeQuoteLayout = useMemo(
    () => QUOTE_LAYOUT_OPTIONS.find((layout) => layout.id === dealMeta?.quoteLayout) || QUOTE_LAYOUT_OPTIONS[0],
    [dealMeta?.quoteLayout]
  );

  // draggable + resizable
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 });
  const DEFAULT_WIDTH = 1450;
  const DEFAULT_HEIGHT = 820;
  const [modalSize, setModalSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const modalDragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });
  const modalResizeRef = useRef({
    startX: 0,
    startY: 0,
    startWidth: DEFAULT_WIDTH,
    startHeight: DEFAULT_HEIGHT,
  });

  // -------------------- EFFECTS --------------------
  useEffect(() => {
    if (!isOpen || !lead) return;

    const resolvedUserId = userId || "guest";

    // load notes (only strip legacy junk)
    setLeadNotes(stripLegacyCallJunk(lead.notes || ""));
    setQuoteTemplates(loadQuoteTemplates(resolvedUserId));
    setDealMeta(
      normaliseDealMeta({
        source: lead?.source,
        tags: lead?.tags,
        ...loadStoredDealMeta(resolvedUserId, lead.id),
        ...lead.crmMeta,
        ...crmMeta,
      })
    );

    setLeadTasks([]);
    setNewTaskText("");
    setNewTaskDate("");
    setNewTaskTime("");
    setIsCalendarOpen(false);
    setShowDialer(true);
    setShowAutomation(false);
    setSelectedEmailTemplate("");
    setEmailHtml("");
    setEmailStatus("");
    setQuoteActionStatus("");
    setAccountBrandingLoaded(false);
    setEmailSubject(`Quick follow-up for ${lead?.name || "your enquiry"}`);

    setRecError("");
    setMergedRecordings([]);

    setModalOffset({ x: 0, y: 0 });
    setModalSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

    loadTasksForLead(lead.id);
    loadSavedEmailsForUser();
    loadAccountBranding();

    // load recordings (db + twilio)
    loadAllRecordings();

    // recordings can appear after hangup
    setTimeout(() => loadAllRecordings(), 6000);
    setTimeout(() => loadAllRecordings(), 15000);
    setTimeout(() => loadAllRecordings(), 30000);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lead?.id, lead?.phone, userId]);

  useEffect(() => {
    function handleMouseMove(e) {
      if (isModalDragging) {
        const { startX, startY, originX, originY } = modalDragRef.current;
        setModalOffset({ x: originX + (e.clientX - startX), y: originY + (e.clientY - startY) });
      }
      if (isResizing) {
        const { startX, startY, startWidth, startHeight } = modalResizeRef.current;
        const newWidth = Math.max(700, startWidth + (e.clientX - startX));
        const newHeight = Math.max(420, startHeight + (e.clientY - startY));
        setModalSize({ width: newWidth, height: newHeight });
      }
    }

    function handleMouseUp() {
      if (isModalDragging) setIsModalDragging(false);
      if (isResizing) setIsResizing(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isModalDragging, isResizing]);

  useEffect(() => {
    function onDocClick(e) {
      if (!showAutomation) return;
      const el = e.target;
      if (!el) return;
      const box = document.getElementById("gr8-automation-popover");
      const btn = document.getElementById("gr8-automation-toggle");
      if (box && box.contains(el)) return;
      if (btn && btn.contains(el)) return;
      setShowAutomation(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showAutomation]);

  async function loadAccountBranding(uidOverride) {
    try {
      let resolvedUserId = s(uidOverride || userId);
      if (!resolvedUserId || resolvedUserId === "guest") {
        const { data: authData } = await supabase.auth.getUser();
        resolvedUserId = s(authData?.user?.id);
      }

      const storedBranding = (() => {
        if (typeof window === "undefined") return {};
        try {
          return JSON.parse(window.localStorage.getItem(quoteBrandingKey(resolvedUserId || "guest")) || "{}");
        } catch {
          return {};
        }
      })();

      if (!resolvedUserId) {
        const fallbackBranding = {
          companyName: s(storedBranding?.companyName) || "Your Company",
          email: s(storedBranding?.email),
          phone: s(storedBranding?.phone),
          website: s(storedBranding?.website),
          address: s(storedBranding?.address),
          logoUrl: resolvePublicAssetUrl(storedBranding?.logoUrl),
        };
        setAccountBranding(fallbackBranding);
        setAccountBrandingLoaded(true);
        return fallbackBranding;
      }

      const { data: account, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", resolvedUserId)
        .maybeSingle();

      if (error) throw error;

      const companyName =
        s(storedBranding?.companyName) ||
        s(account?.brand_name) ||
        s(account?.business_name) ||
        s(account?.company_name) ||
        s(account?.full_name) ||
        "Your Company";

      const email =
        s(storedBranding?.email) ||
        s(account?.business_email) ||
        s(account?.sendgrid_from_email) ||
        s(account?.from_email) ||
        s(account?.email);

      const phone = s(storedBranding?.phone) || s(account?.business_phone) || s(account?.phone) || s(account?.alt_phone);
      const website = s(storedBranding?.website) || s(account?.website);
      const address =
        s(storedBranding?.address) ||
        [
          s(account?.business_address) || s(account?.postal_address) || s(account?.residential_address),
          s(account?.business_city) || s(account?.postal_city) || s(account?.residential_city),
          s(account?.business_state) || s(account?.postal_state) || s(account?.residential_state),
          s(account?.business_postcode) || s(account?.postal_postcode) || s(account?.residential_postcode),
          s(account?.business_country) || s(account?.postal_country) || s(account?.residential_country),
        ].filter(Boolean).join(", ");

      const logoUrl =
        resolvePublicAssetUrl(storedBranding?.logoUrl) ||
        resolvePublicAssetUrl(account?.business_logo) ||
        resolvePublicAssetUrl(account?.business_logo_url) ||
        resolvePublicAssetUrl(account?.logo_url) ||
        resolvePublicAssetUrl(account?.business_avatar) ||
        resolvePublicAssetUrl(account?.business_avatar_url);

      const heroImageUrl =
        resolvePublicAssetUrl(storedBranding?.heroImageUrl) ||
        resolvePublicAssetUrl(account?.quote_hero_image_url);

      const nextBranding = { companyName, email, phone, website, address, logoUrl, heroImageUrl };
      setAccountBranding(nextBranding);
      setDealMeta((prev) => ({
        ...prev,
        quoteEmailSubject: prev.quoteEmailSubject || `Quotation ${prev.quoteNumber || makeQuoteNumber()} for ${prev.product || prev.quoteTemplateName || "your project"}`,
        quoteEmailMessage: prev.quoteEmailMessage || buildDefaultQuoteEmailMessage(prev),
        quoteEmailSignature: prev.quoteEmailSignature || buildDefaultQuoteEmailSignature(nextBranding),
      }));
      setAccountBrandingLoaded(true);
      return nextBranding;
    } catch (err) {
      console.warn("Load account branding exception:", err?.message || err);
      const fallbackBranding = accountBranding || {};
      setAccountBrandingLoaded(true);
      return fallbackBranding;
    }
  }

  async function loadSavedEmailsForUser() {
    if (!userId) return;
    setSavedEmailsLoading(true);
    try {
      const [docsRes, legacyRes] = await Promise.allSettled([
        fetch(`/api/email/builder-doc-list?userId=${encodeURIComponent(userId)}`),
        fetch(`/api/email/list-saved-emails?userId=${encodeURIComponent(userId)}`),
      ]);

      const mapped = [];

      if (docsRes.status === "fulfilled") {
        const docsJson = await docsRes.value.json().catch(() => null);
        if (docsRes.value.ok && docsJson?.ok) {
          for (const doc of docsJson.docs || []) {
            mapped.push({
              id: String(doc?.docId || ""),
              name: prettyTemplateName(doc?.name || doc?.docId || ""),
              path: `doc:${String(doc?.docId || "")}`,
              htmlUrl: String(doc?.htmlUrl || ""),
              type: "doc",
            });
          }
        }
      }

      if (legacyRes.status === "fulfilled") {
        const legacyJson = await legacyRes.value.json().catch(() => null);
        if (legacyRes.value.ok && legacyJson?.ok) {
          for (const file of legacyJson.files || []) {
            mapped.push({
              id: String(file?.path || file?.id || "").replace(/^.*\//, "").replace(/\.html$/i, ""),
              name: prettyTemplateName(file?.name || file?.filename || file?.path || ""),
              path: String(file?.path || file?.id || ""),
              type: "legacy",
            });
          }
        }
      }

      mapped.sort((a, b) => a.name.localeCompare(b.name));
      setSavedEmailTemplates(mapped);
    } catch (err) {
      console.error("Load saved emails exception:", err);
      setSavedEmailTemplates([]);
    } finally {
      setSavedEmailsLoading(false);
    }
  }

  async function handleChooseEmailTemplate(path) {
    setSelectedEmailTemplate(path);
    setEmailStatus("");

    if (!path) {
      setEmailHtml("");
      return;
    }

    try {
      const chosen = savedEmailTemplates.find((item) => item.path === path);
      let html = "";

      if (chosen?.type === "doc" && chosen?.htmlUrl) {
        const r = await fetch(`${chosen.htmlUrl}?v=${Date.now()}`);
        html = await r.text();
        if (!r.ok) throw new Error(html || "Unable to load selected email template.");
      } else {
        const r = await fetch(`/api/email/get-saved-email?path=${encodeURIComponent(path)}`);
        html = await r.text();
        if (!r.ok) throw new Error(html || "Unable to load selected email template.");
      }

      setEmailHtml(personaliseTemplate(html));

      if (chosen && (!emailSubject || emailSubject.startsWith("Quick follow-up for"))) {
        setEmailSubject(chosen.name);
      }
    } catch (err) {
      console.error("Load selected template error:", err);
      setEmailStatus(err?.message || "Unable to load selected email template.");
      setEmailHtml("");
    }
  }

  async function handleSendLeadEmail() {
    if (!lead?.email) {
      alert("This lead does not have an email address.");
      return;
    }
    if (!emailHtml) {
      alert("Please choose a saved email template first.");
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus("");

    try {
      const r = await fetch("/api/email/send-crm-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.email,
          subject: emailSubject || `Quick follow-up for ${lead?.name || "your enquiry"}`,
          html: emailHtml,
          leadId: lead.id,
          userId,
          templatePath: selectedEmailTemplate,
          leadName: lead?.name || "",
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to send email.");
      }

      setEmailStatus(`Email sent to ${lead.email}`);
      alert("Email sent.");
    } catch (err) {
      console.error("Send lead email error:", err);
      const message = err?.message || "Unable to send email.";
      setEmailStatus(message);
      alert(message);
    } finally {
      setIsSendingEmail(false);
    }
  }

  // -------------------- DB HELPERS --------------------
  async function loadTasksForLead(leadId) {
    if (!userId || !leadId) return;
    setTasksLoading(true);

    const { data, error } = await supabase
      .from("crm_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadTasksForLead error:", error);
      setLeadTasks([]);
    } else {
      setLeadTasks(data || []);
    }
    setTasksLoading(false);
  }

  // Load recordings from crm_calls via SERVER API (service role) to avoid RLS empty results in browser
  async function loadDbRecordings() {
    try {
      if (!lead?.id) return [];

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";
      if (!token) return [];

      const r = await fetch(`/api/crm/lead-call-recordings?lead_id=${encodeURIComponent(lead.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const j = await r.json();
      if (!j?.ok) {
        console.warn("lead-call-recordings not ok:", j);
        return [];
      }

      const rows = Array.isArray(j?.recordings) ? j.recordings : [];

      return (rows || [])
        .filter((row) => row && (s(row.recording_url) || s(row.recordingUrl) || s(row.recording_url_text) || s(row.recordingSid) || s(row.recording_sid) || s(row.sid)))
        .map((row) => {
          // IMPORTANT:
          // - crm_calls often has recording_url (Twilio recording URL) and call_sid (CA...) etc.
          // - We DO NOT treat CA... as a recording sid (recording sids are RE...)
          const recordingUrl = s(
            row.recordingUrl ||
              row.recording_url ||
              row.recording_url_text ||
              row.recordingUrlText ||
              row.recording ||
              row.url ||
              ""
          );

          const extractedRecordingSid = extractRecordingSidFromUrl(recordingUrl);
          const recordingSid = s(row.recordingSid || row.recording_sid || "").startsWith("RE")
            ? s(row.recordingSid || row.recording_sid)
            : extractedRecordingSid || "";

          const createdAt =
            row.createdAt ||
            row.created_at ||
            row.dateCreated ||
            row.date_created ||
            row.created ||
            row.timestamp ||
            null;

          const duration = row.duration ?? row.recordingDuration ?? row.recording_duration ?? row.recording_duration_seconds ?? null;

          const from = s(row.from || row.from_number || row.caller || row.src || row.caller_name || "");
          const to = s(row.to || row.to_number || row.called || row.dst || "");

          // stable key for dedupe
          const key =
            recordingSid ? `re:${recordingSid}` : recordingUrl ? `url:${recordingUrl}` : `db:${row.id || Math.random().toString(16).slice(2)}`;

          return {
            key,
            source: "db",
            recordingSid,
            recordingUrl,
            createdAt,
            duration,
            from,
            to,
          };
        });
    } catch (e) {
      console.error("loadDbRecordings error:", e);
      return [];
    }
  }

  // Load recordings from Twilio API route (optional)
  async function loadTwilioRecordings() {
    const rawPhone = s(lead?.phone);
    if (!rawPhone) return [];

    const phoneE164 = normalizePhoneE164AU(rawPhone);
    const phoneToQuery = phoneE164 || rawPhone;

    try {
      const r = await fetch(`/api/twilio/list-call-recordings?phone=${encodeURIComponent(phoneToQuery)}&limit=50`);
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Failed to load recordings from Twilio");

      const recs = Array.isArray(j?.recordings) ? j.recordings : [];

      return recs
        .filter((x) => x && (s(x.recordingSid || x.sid) || s(x.recordingUrl || x.recording_url || x.url)))
        .map((x) => {
          const recordingUrl = s(x.recordingUrl || x.recording_url || x.url || "");
          const extracted = extractRecordingSidFromUrl(recordingUrl);
          const recordingSid = s(x.recordingSid || x.sid).startsWith("RE") ? s(x.recordingSid || x.sid) : extracted || "";

          const createdAt =
            x.dateCreated ||
            x.date_created ||
            x.createdAt ||
            x.created_at ||
            x.startTime ||
            x.start_time ||
            x.timestamp ||
            null;

          const duration = x.duration ?? x.recordingDuration ?? x.recording_duration ?? null;

          const from = s(x.from || x.from_number || x.caller || "");
          const to = s(x.to || x.to_number || x.called || "");

          const key = recordingSid ? `re:${recordingSid}` : recordingUrl ? `url:${recordingUrl}` : `tw:${Math.random().toString(16).slice(2)}`;

          return {
            key,
            source: "twilio",
            recordingSid,
            recordingUrl,
            createdAt,
            duration,
            from,
            to,
          };
        });
    } catch (e) {
      console.error("loadTwilioRecordings error:", e);
      throw e;
    }
  }

  // Merge + dedupe + sort by date DESC
  async function loadAllRecordings() {
    setRecLoading(true);
    setRecError("");
    setMergedRecordings([]);

    try {
      const [dbList, twList] = await Promise.all([loadDbRecordings(), loadTwilioRecordings().catch(() => [])]);

      const map = new Map();

      function dedupeKey(item) {
        const re = s(item?.recordingSid);
        const url = s(item?.recordingUrl);
        if (re) return `re:${re}`;
        if (url) return `url:${url}`;
        return s(item?.key) || `x:${Math.random().toString(16).slice(2)}`;
      }

      for (const item of dbList) {
        if (!item) continue;
        map.set(dedupeKey(item), item);
      }

      for (const item of twList) {
        if (!item) continue;
        const k = dedupeKey(item);
        if (!map.has(k)) map.set(k, item);
        else {
          const existing = map.get(k);
          map.set(k, {
            ...existing,
            // prefer DB but fill gaps
            recordingUrl: existing?.recordingUrl || item?.recordingUrl || "",
            createdAt: existing?.createdAt || item?.createdAt || null,
            duration: existing?.duration ?? item?.duration ?? null,
            from: existing?.from || item?.from || "",
            to: existing?.to || item?.to || "",
          });
        }
      }

      const merged = Array.from(map.values());

      merged.sort((a, b) => {
        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      setMergedRecordings(merged);
    } catch (e) {
      setRecError(e?.message || "Unable to load recordings.");
      setMergedRecordings([]);
    } finally {
      setRecLoading(false);
    }
  }

  function makeQuoteNumber() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const leadCode = String(lead?.id || lead?.email || "lead").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase() || "LEAD";
    return `QT-${stamp}-${leadCode}`;
  }

  function updateQuoteItem(index, patch) {
    setDealMeta((prev) => {
      const currentItems = normaliseQuoteItems(prev.quoteItems);
      const nextItems = currentItems.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
      const totals = calcQuoteTotals(nextItems, prev.quoteTaxRate);
      return {
        ...prev,
        quoteItems: nextItems,
        dealValue: String(Math.round(totals.total || 0)),
      };
    });
  }

  function addQuoteItem() {
    setDealMeta((prev) => ({
      ...prev,
      quoteItems: [...normaliseQuoteItems(prev.quoteItems), { description: "", qty: 1, price: 0, imageUrl: "" }],
    }));
  }

  function removeQuoteItem(index) {
    setDealMeta((prev) => {
      const currentItems = normaliseQuoteItems(prev.quoteItems);
      const nextItems = currentItems.filter((_, idx) => idx !== index);
      const safeItems = nextItems.length ? nextItems : [{ description: "", qty: 1, price: 0, imageUrl: "" }];
      const totals = calcQuoteTotals(safeItems, prev.quoteTaxRate);
      return {
        ...prev,
        quoteItems: safeItems,
        dealValue: String(Math.round(totals.total || 0)),
      };
    });
  }

  function applyQuoteTemplate(templateId) {
    const template = quoteTemplates.find((entry) => entry.id === templateId);
    if (!template) return;

    const totals = calcQuoteTotals(template.items, template.taxRate);
    setDealMeta((prev) => ({
      ...prev,
      quoteTemplateId: template.id,
      quoteTemplateName: template.name,
      quoteStatus: prev.quoteStatus || "draft",
      quoteValidUntil: prev.quoteValidUntil || defaultQuoteExpiry(),
      quoteTaxRate: Math.max(0, Number(template.taxRate || 0)),
      quoteItems: normaliseQuoteItems(template.items),
      quoteNotes: template.notes || prev.quoteNotes,
      quoteTerms: template.terms || prev.quoteTerms,
      product: prev.product || template.name,
      dealValue: String(Math.round(totals.total || 0)),
      quoteNumber: prev.quoteNumber || makeQuoteNumber(),
    }));
  }

  function handleSaveQuote(statusOverride) {
    const nextStatus = statusOverride || dealMeta.quoteStatus || "draft";
    const totals = calcQuoteTotals(quoteItems, dealMeta.quoteTaxRate);
    const isAccepted = nextStatus === "accepted";
    const isDeclined = nextStatus === "declined";

    handleSaveDealMeta({
      ...dealMeta,
      quoteItems,
      quoteStatus: nextStatus,
      quoteNumber: dealMeta.quoteNumber || makeQuoteNumber(),
      dealValue: String(Math.round(totals.total || 0)),
      status: isAccepted ? "won" : isDeclined ? "lost" : dealMeta.status,
    });
  }

  async function handleQuoteItemImageUpload(index, event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
      const nextUrl = await readImageAsOptimizedDataUrl(file, { maxWidth: 1400, maxHeight: 1200, quality: 0.82 });
      updateQuoteItem(index, { imageUrl: nextUrl });
      setQuoteActionStatus("Product image added to the brochure preview.");
    } catch {
      setQuoteActionStatus("Unable to read that product image.");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildQuoteHtml(metaOverride = {}, brandingOverride = accountBranding, options = {}) {
    const merged = normaliseDealMeta({ ...dealMeta, ...metaOverride, quoteItems: metaOverride?.quoteItems || quoteItems });
    const transportSafe = Boolean(options?.transportSafe);
    const items = normaliseQuoteItems(merged.quoteItems);
    const totals = calcQuoteTotals(items, merged.quoteTaxRate);
    const quoteNumber = merged.quoteNumber || makeQuoteNumber();
    const validUntil = merged.quoteValidUntil || defaultQuoteExpiry();
    const preparedOn = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
    const clientName = s(lead?.name) || "Valued Client";
    const clientEmail = s(lead?.email);
    const clientPhone = s(lead?.phone);
    const productName = s(merged.product) || s(merged.quoteTemplateName) || "Service Proposal";
    const brandingSource = brandingOverride || accountBranding || {};
    const companyName = s(brandingSource?.companyName) || "Your Company";
    const companyEmail = s(brandingSource?.email);
    const companyPhone = s(brandingSource?.phone);
    const companyWebsite = s(brandingSource?.website);
    const companyAddress = s(brandingSource?.address);
    const companyLogo = getRenderableAssetUrl(brandingSource?.logoUrl, { transportSafe });
    const heroImageUrl = getRenderableAssetUrl(brandingSource?.heroImageUrl, { transportSafe });
    const companyDetails = [companyEmail, companyPhone, companyWebsite, companyAddress].filter(Boolean);
    const selectedLayout = QUOTE_LAYOUT_OPTIONS.find((layout) => layout.id === merged.quoteLayout) || QUOTE_LAYOUT_OPTIONS[0];
    const itemRows = items.map((item) => {
      const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description || "Service item")}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:center;">${Number(item.qty || 0)}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatMoney(item.price))}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatMoney(lineTotal))}</td>
        </tr>`;
    }).join("");

    const brochureImages = items
      .map((item) => ({ ...item, safeImageUrl: getRenderableAssetUrl(item.imageUrl, { transportSafe }) }))
      .filter((item) => s(item.safeImageUrl))
      .slice(0, 3);

    const galleryMarkup = brochureImages.length
      ? `<div class="brochure-gallery">${brochureImages
          .map(
            (item) => `
              <div class="gallery-card">
                <img src="${escapeHtml(item.safeImageUrl)}" alt="${escapeHtml(item.description || "Product image")}" />
                <div class="gallery-caption">${escapeHtml(item.description || "Offer preview")}</div>
              </div>`
          )
          .join("")}</div>`
      : "";

    const productCards = items.map((item, index) => {
      const artwork = ["🌟", "🚀", "📈", "🎯", "🧩", "💼"][index % 6];
      return `
        <div class="feature-card">
          ${getRenderableAssetUrl(item.imageUrl, { transportSafe }) ? `<div class="feature-photo"><img src="${escapeHtml(getRenderableAssetUrl(item.imageUrl, { transportSafe }))}" alt="${escapeHtml(item.description || "Product image")}" /></div>` : `<div class="feature-art">${artwork}</div>`}
          <div class="card-kicker">Deliverable ${index + 1}</div>
          <div class="card-title">${escapeHtml(item.description || "Service item")}</div>
          <div class="card-copy">Quantity: ${Number(item.qty || 0)} • Unit price: ${escapeHtml(formatMoney(item.price))}</div>
        </div>
      `;
    }).join("");

    return {
      quoteNumber,
      subject: `Quotation ${quoteNumber} for ${productName}`,
      html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Quotation ${escapeHtml(quoteNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: linear-gradient(180deg,#eef2f7,#e2e8f0); font-family: Arial, sans-serif; color: #0f172a; }
      .sheet { max-width: 1040px; margin: 0 auto; padding: 28px; }
      .page { background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 50px rgba(15,23,42,0.12); margin-bottom: 26px; border: 1px solid rgba(226,232,240,0.95); }
      .hero { background: ${heroImageUrl ? `linear-gradient(rgba(15,23,42,0.34), rgba(15,23,42,0.34)), url('${escapeHtml(heroImageUrl)}') center/cover no-repeat` : selectedLayout.banner}; color: ${selectedLayout.id === "minimal" || heroImageUrl ? "#f8fafc" : "#111827"}; padding: 42px 38px; min-height: 270px; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
      .hero::after { content: ""; position: absolute; right: -80px; bottom: -80px; width: 220px; height: 220px; border-radius: 999px; background: rgba(255,255,255,0.14); }
      .hero-top, .hero-bottom, .two-col, .meta-grid { display: flex; gap: 18px; justify-content: space-between; flex-wrap: wrap; position: relative; z-index: 1; }
      .logo-wrap { display: flex; align-items: center; gap: 16px; }
      .logo-box { width: 86px; height: 86px; border-radius: 18px; background: rgba(255,255,255,0.18); display: grid; place-items: center; font-size: 28px; font-weight: 800; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18); }
      .logo-box img { width: 100%; height: 100%; object-fit: contain; background: #fff; padding: 8px; }
      .hero-title { font-size: 38px; font-weight: 900; line-height: 1.05; }
      .hero-sub { margin-top: 6px; font-size: 15px; opacity: 0.95; }
      .hero-quote { text-align: right; min-width: 220px; }
      .hero-quote .quote-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
      .hero-quote .quote-value { font-size: 28px; font-weight: 900; margin-top: 6px; }
      .section { padding: 30px 34px; }
      .section-title { font-size: 26px; font-weight: 900; margin: 0 0 8px; letter-spacing: -0.02em; }
      .section-copy { color: #475569; line-height: 1.7; margin: 0; font-size: 15px; }
      .meta-card, .info-card, .totals-card, .feature-card { background: linear-gradient(180deg,#fff,${selectedLayout.panel}); border: 1px solid ${selectedLayout.accent}33; border-radius: 18px; padding: 16px 18px; }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 20px; }
      .meta-kicker, .card-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; }
      .meta-value, .card-title { margin-top: 6px; font-size: 19px; font-weight: 900; }
      .card-copy { margin-top: 8px; color: #475569; line-height: 1.65; }
      .two-col { align-items: stretch; }
      .two-col > div { flex: 1 1 320px; }
      .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; margin-top: 18px; }
      .brochure-gallery { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; margin-top: 18px; }
      .gallery-card { position: relative; min-height: 220px; border-radius: 18px; overflow: hidden; background: #e2e8f0; box-shadow: 0 10px 20px rgba(15,23,42,0.08); }
      .gallery-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .gallery-caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 12px 14px; background: linear-gradient(180deg, transparent, rgba(15,23,42,0.75)); color: #fff; font-weight: 700; }
      .feature-card { position: relative; overflow: hidden; min-height: 150px; }
      .feature-art { font-size: 30px; width: 54px; height: 54px; border-radius: 14px; background: ${selectedLayout.accent}18; display: grid; place-items: center; margin-bottom: 12px; }
      .feature-photo { margin: -4px -6px 12px; height: 160px; border-radius: 14px; overflow: hidden; background: #e2e8f0; }
      .feature-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; overflow: hidden; border-radius: 14px; }
      thead tr { background: ${selectedLayout.panel}; }
      th { padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
      .totals-wrap { display: flex; justify-content: flex-end; margin-top: 18px; }
      .totals-card { min-width: 320px; box-shadow: 0 8px 18px rgba(15,23,42,0.05); }
      .total-row { display: flex; justify-content: space-between; padding: 7px 0; }
      .grand-total { border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 12px; font-size: 20px; font-weight: 900; }
      .footer-note { margin-top: 18px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #475569; font-size: 13px; line-height: 1.8; }
      .page-break { page-break-before: always; }
      @media print {
        body { background: #fff; }
        .sheet { max-width: none; padding: 0; }
        .page { box-shadow: none; margin: 0; border: none; border-radius: 0; min-height: 100vh; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <section class="page">
        <div class="hero">
          <div class="hero-top">
            <div class="logo-wrap">
              <div class="logo-box">${companyLogo ? `<img src="${escapeHtml(companyLogo)}" alt="${escapeHtml(companyName)} logo" />` : escapeHtml(getInitials(companyName))}</div>
              <div>
                <div class="hero-title">${escapeHtml(companyName)}</div>
                <div class="hero-sub">Professional quotation proposal</div>
              </div>
            </div>
            <div class="hero-quote">
              <div class="quote-label">Quotation</div>
              <div class="quote-value">${escapeHtml(quoteNumber)}</div>
            </div>
          </div>
          <div class="hero-bottom">
            <div>
              <div class="hero-sub">Prepared for</div>
              <div style="font-size:26px;font-weight:800;margin-top:4px;">${escapeHtml(clientName)}</div>
              <div style="margin-top:8px;font-size:14px;opacity:0.92;">${escapeHtml(productName)}</div>
            </div>
            <div style="text-align:right;min-width:220px;">
              <div class="hero-sub">Prepared on ${escapeHtml(preparedOn)}</div>
              <div class="hero-sub">Valid until ${escapeHtml(validUntil)}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="page page-break">
        <div class="section">
          <h2 class="section-title">Company information</h2>
          <p class="section-copy">This proposal has been prepared by ${escapeHtml(companyName)} and includes the key business and contact details for the opportunity.</p>
          <div class="meta-grid">
            <div class="meta-card"><div class="meta-kicker">Company</div><div class="meta-value">${escapeHtml(companyName)}</div></div>
            <div class="meta-card"><div class="meta-kicker">Contact</div><div class="meta-value">${escapeHtml(companyEmail || companyPhone || "Available on request")}</div></div>
            <div class="meta-card"><div class="meta-kicker">Phone</div><div class="meta-value">${escapeHtml(companyPhone || "Not provided")}</div></div>
            <div class="meta-card"><div class="meta-kicker">Website</div><div class="meta-value">${escapeHtml(companyWebsite || "Not provided")}</div></div>
            <div class="meta-card" style="grid-column:1 / -1;"><div class="meta-kicker">Address</div><div class="meta-value">${escapeHtml(companyAddress || "Not provided")}</div></div>
          </div>
        </div>
      </section>

      <section class="page page-break">
        <div class="section">
          <h2 class="section-title">Product information</h2>
          <p class="section-copy">The following services and deliverables are included in this proposal for ${escapeHtml(clientName)}.</p>
          <div class="two-col" style="margin-top:18px;">
            <div>
              <div class="info-card">
                <div class="card-kicker">Proposal summary</div>
                <div class="card-title">${escapeHtml(productName)}</div>
                <div class="card-copy">${escapeHtml(merged.quoteNotes || "This quotation outlines the proposed scope of work, pricing, and delivery details.")}</div>
              </div>
            </div>
            <div>
              <div class="info-card">
                <div class="card-kicker">Client details</div>
                <div class="card-title">${escapeHtml(clientName)}</div>
                <div class="card-copy">${escapeHtml(clientEmail || "No email supplied")}${clientPhone ? ` • ${escapeHtml(clientPhone)}` : ""}</div>
              </div>
            </div>
          </div>
          ${galleryMarkup}
          <div class="info-grid">${productCards}</div>
        </div>
      </section>

      <section class="page page-break">
        <div class="section">
          <h2 class="section-title">Quote sheet</h2>
          <p class="section-copy">Final pricing and totals for this quotation are outlined below.</p>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Price</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div class="totals-wrap">
            <div class="totals-card">
              <div class="total-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(totals.subtotal))}</strong></div>
              <div class="total-row"><span>Tax (${Number(merged.quoteTaxRate || 0)}%)</span><strong>${escapeHtml(formatMoney(totals.tax))}</strong></div>
              <div class="total-row grand-total"><span>Total</span><strong>${escapeHtml(formatMoney(totals.total))}</strong></div>
            </div>
          </div>

          ${merged.quoteTerms ? `<div class="info-card" style="margin-top:18px;"><div class="card-kicker">Terms</div><div class="card-copy">${escapeHtml(merged.quoteTerms)}</div></div>` : ""}

          <div class="footer-note">
            <strong>Prepared by ${escapeHtml(companyName)}</strong><br />
            ${companyDetails.length ? companyDetails.map((entry) => escapeHtml(entry)).join(" • ") : "Reply to this quotation to discuss the next steps."}
          </div>
        </div>
      </section>
    </div>
  </body>
</html>`,
    };
  }

  async function handleExportQuotePdf() {
    const nextMeta = {
      ...dealMeta,
      quoteItems,
      quoteNumber: dealMeta.quoteNumber || makeQuoteNumber(),
      dealValue: String(Math.round(quoteTotals.total || 0)),
    };
    setDealMeta((prev) => ({ ...prev, ...nextMeta }));

    const liveBranding = await loadAccountBranding(userId);
    const quoteDoc = buildQuoteHtml(nextMeta, liveBranding);
    const popup = window.open("", "_blank", "width=980,height=900");
    if (!popup) {
      alert("Please allow pop-ups so the print view can open.");
      return;
    }

    popup.document.open();
    popup.document.write(quoteDoc.html);
    popup.document.close();
    popup.focus();
    setQuoteActionStatus("Quote preview opened. Use Print and Save as PDF.");
    setTimeout(() => popup.print(), 250);
  }

  async function handleSendQuoteEmail() {
    if (!lead?.email) {
      alert("This lead does not have an email address.");
      return;
    }

    const hasMeaningfulItems = quoteItems.some((item) => s(item.description) || Number(item.price || 0) > 0);
    if (!hasMeaningfulItems) {
      alert("Add at least one quote item before sending the quotation.");
      return;
    }

    const nextMeta = {
      ...dealMeta,
      quoteItems,
      quoteStatus: "sent",
      quoteNumber: dealMeta.quoteNumber || makeQuoteNumber(),
      quoteEmailSubject: dealMeta.quoteEmailSubject || `Quotation ${dealMeta.quoteNumber || makeQuoteNumber()} for ${dealMeta.product || dealMeta.quoteTemplateName || "your project"}`,
      quoteEmailMessage: dealMeta.quoteEmailMessage || buildDefaultQuoteEmailMessage(dealMeta),
      quoteEmailSignature: dealMeta.quoteEmailSignature,
      dealValue: String(Math.round(quoteTotals.total || 0)),
    };

    const liveBranding = await loadAccountBranding(userId);
    const quoteDoc = buildQuoteHtml(nextMeta, liveBranding, { transportSafe: true });
    setIsSendingQuote(true);
    setQuoteActionStatus("");

    try {
      const payload = {
        to: lead.email,
        subject: nextMeta.quoteEmailSubject || quoteDoc.subject,
        html: quoteDoc.html,
        leadId: lead.id,
        userId,
        leadName: lead?.name || "",
        quoteNumber: quoteDoc.quoteNumber,
        message: nextMeta.quoteEmailMessage || buildDefaultQuoteEmailMessage(nextMeta),
        signature: nextMeta.quoteEmailSignature || buildDefaultQuoteEmailSignature(liveBranding),
        companyName: liveBranding?.companyName || "",
        companyEmail: liveBranding?.email || "",
        companyPhone: liveBranding?.phone || "",
        companyWebsite: liveBranding?.website || "",
        companyLogoUrl: liveBranding?.logoUrl || "",
      };

      const r = await fetch("/api/email/send-crm-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to send quotation.");
      }

      await handleSaveDealMeta(nextMeta, { silent: true });
      setQuoteActionStatus(`Quotation PDF sent to ${lead.email}`);
      alert("Quotation sent as a PDF attachment.");
    } catch (err) {
      console.error("Send quotation error:", err);
      const rawMessage = err?.message || "Unable to send quotation.";
      const message = String(rawMessage).toLowerCase().includes("fetch")
        ? "The quote email was too large or the connection was interrupted. Please try again now."
        : rawMessage;
      setQuoteActionStatus(message);
      alert(message);
    } finally {
      setIsSendingQuote(false);
    }
  }

  // -------------------- NOTES SAVE --------------------
  async function handleSaveDealMeta(metaOverride, options = {}) {
    if (!lead?.id) return;

    const { silent = false } = options;
    const cleanMeta = normaliseDealMeta(metaOverride || dealMeta);
    setDealMeta(cleanMeta);

    if (typeof window !== "undefined") {
      try {
        const key = leadMetaStorageKey(userId);
        const existing = JSON.parse(window.localStorage.getItem(key) || "{}");
        existing[lead.id] = cleanMeta;
        window.localStorage.setItem(key, JSON.stringify(existing));
      } catch (err) {
        console.warn("Unable to persist CRM deal meta:", err);
      }
    }

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          source: cleanMeta.source || null,
          tags: cleanMeta.tags || null,
          updated_at: new Date(),
        })
        .eq("id", lead.id);

      if (error) {
        console.error("Save deal metadata error:", error);
        alert("Deal details saved locally, but lead tags/source could not be synced.");
      } else if (!silent) {
        alert("Deal details saved.");
      }
    } catch (err) {
      console.error("Save deal metadata error:", err);
      alert("Deal details saved locally, but lead tags/source could not be synced.");
    }

    if (onCrmMetaSave) {
      await Promise.resolve(onCrmMetaSave(lead.id, cleanMeta));
    }
  }

  async function handleSaveLeadNotes() {
    if (!lead) return;

    const clean = stripLegacyCallJunk(leadNotes);

    try {
      const { error } = await supabase.from("leads").update({ notes: clean, updated_at: new Date() }).eq("id", lead.id);

      if (error) {
        console.error("Save notes error:", error);
        alert("There was an error saving notes.");
        return;
      }

      if (onNotesUpdated) onNotesUpdated(lead.id, clean);

      alert("Notes saved.");
      handleCloseInternal();
    } catch (err) {
      console.error("Save notes error:", err);
      alert("There was an error saving notes.");
    }
  }

  // -------------------- VOICE TO TEXT (MIC) --------------------
  function addTimestampHeader() {
    const now = new Date();
    const stamp = now.toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setLeadNotes((prev) => {
      const header = `[${stamp}]`;
      if (!prev || !prev.trim()) return `${header}\n`;
      return `${prev.trim()}\n\n${header}\n`;
    });
  }

  function resetSilenceTimer() {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (recordingRef.current) {
      silenceTimeoutRef.current = setTimeout(() => stopRecording(), 20000);
    }
  }

  function clearSilenceTimer() {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }

  function initRecognition() {
    if (typeof window === "undefined") return null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice-to-text is not supported in this browser.");
      return null;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-AU";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript + " ";
        }
        finalText = finalText.trim();
        if (!finalText) return;

        resetSilenceTimer();

        let text = finalText.replace(/\r?\n/g, " ");
        text = text.replace(/new paragraph/gi, "\n\n");
        text = text.replace(/new line/gi, "\n");
        text = text.replace(/full stop/gi, ".");
        text = text.replace(/\bcomma\b/gi, ",");
        text = text.replace(/\bquestion mark\b/gi, "?");
        text = text.replace(/\bexclamation mark\b/gi, "!");
        text = text.replace(/\bcolon\b/gi, ":");

        setLeadNotes((prevRaw) => {
          const prev = prevRaw || "";
          if (!prev) return text;

          const lastChar = prev.slice(-1);
          const firstChar = text[0];

          const needsSpace = ![" ", "\n"].includes(lastChar) && !["\n", ".", ",", "!", "?", ":"].includes(firstChar);

          return prev + (needsSpace ? " " : "") + text;
        });
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event);
      };

      recognition.onend = () => {
        clearSilenceTimer();
        if (recordingRef.current) {
          try {
            recognition.start();
            resetSilenceTimer();
          } catch (e) {
            console.error("Speech restart error:", e);
            recordingRef.current = false;
            setIsRecording(false);
          }
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return recognitionRef.current;
  }

  function startRecording() {
    const recognition = initRecognition();
    if (!recognition) return;

    if (recordingRef.current) return;
    recordingRef.current = true;
    setIsRecording(true);

    addTimestampHeader();

    try {
      recognition.start();
      resetSilenceTimer();
    } catch (e) {
      console.error("Speech start error:", e);
      recordingRef.current = false;
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const recognition = recognitionRef.current;
    recordingRef.current = false;
    setIsRecording(false);
    clearSilenceTimer();

    if (!recognition) return;
    try {
      recognition.stop();
    } catch (e) {
      console.error("Speech stop error:", e);
    }
  }

  // -------------------- TASK HELPERS --------------------
  function getTaskTypeLabel(type) {
    switch (type) {
      case "phone_call":
        return "Phone call";
      case "text_message":
        return "Text message";
      case "zoom_call":
        return "Zoom call";
      case "whatsapp":
        return "WhatsApp";
      case "in_person":
        return "Meeting in person";
      default:
        return "Other";
    }
  }

  async function handleAddUpcomingTask() {
    if (!userId || !lead) {
      alert("No lead or user loaded.");
      return;
    }

    const text = newTaskText.trim();
    if (!text) {
      alert("Please add what the task is about.");
      return;
    }

    if (!newTaskDate) {
      alert("Please choose a date from the calendar.");
      return;
    }

    const timeString = newTaskTime || "09:00";
    const whenText = new Date(`${newTaskDate}T${timeString}:00`).toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const name = lead.name || "This contact";
    const typeLabel = getTaskTypeLabel(newTaskType);
    const title = `${name} – ${typeLabel} about: ${text} – ${whenText}`;

    const payload = {
      user_id: userId,
      contact_id: lead.id,
      title,
      notes: null,
      completed: false,
      due_date: newTaskDate,
    };

    const { data, error } = await supabase.from("crm_tasks").insert(payload).select().single();

    if (error) {
      console.error("Add upcoming task error:", error);
      alert("There was an error saving the task / reminder.");
      return;
    }

    setLeadTasks((prev) => [data, ...prev]);
    setNewTaskText("");
    setNewTaskDate("");
    setNewTaskTime("");
    setIsCalendarOpen(false);

    alert("Upcoming task added.");
  }

  // -------------------- CALENDAR --------------------
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const firstOfMonth = new Date(calendarYear, calendarMonthIndex, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();

  const calendarCells = [];
  for (let i = 0; i < startWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  function toISODate(day) {
    const dt = new Date(calendarYear, calendarMonthIndex, day);
    return dt.toISOString().slice(0, 10);
  }

  function goMonth(offset) {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const calendarLabel = calendarMonth.toLocaleString("en-AU", { month: "long", year: "numeric" });

  // -------------------- DRAG / RESIZE --------------------
  function handleModalHeaderMouseDown(e) {
    e.preventDefault();
    modalDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: modalOffset.x,
      originY: modalOffset.y,
    };
    setIsModalDragging(true);
  }

  function handleResizeMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    modalResizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: modalSize.width,
      startHeight: modalSize.height,
    };
    setIsResizing(true);
  }

  // -------------------- ACTIONS --------------------
  function handleCloseInternal() {
    stopRecording();
    setIsCalendarOpen(false);
    setLeadTasks([]);
    setShowAutomation(false);
    if (onClose) onClose();
  }

  function goToSmsPage() {
    const base = "/modules/email/crm/sms-marketing";
    const qs = lead?.id ? `?lead_id=${encodeURIComponent(lead.id)}` : "";
    router.push(base + qs);
  }

  // Dialer number
  const leadPhone = s(lead.phone);
  const dialToNumber = useMemo(() => {
    const e164 = normalizePhoneE164AU(leadPhone);
    return e164 || leadPhone;
  }, [leadPhone]);

  const leadEmail = s(lead.email);

  // Audio URL resolver:
  // - recordingSid (RE...) -> /api/twilio/recording?sid=...
  // - recordingUrl -> /api/twilio/recording-audio?url=...
  function getAudioSrc(item) {
    const reSid = s(item?.recordingSid);
    const url = s(item?.recordingUrl);

    if (reSid && reSid.startsWith("RE")) {
      return `/api/twilio/recording?sid=${encodeURIComponent(reSid)}`;
    }
    if (url) {
      return `/api/twilio/recording-audio?url=${encodeURIComponent(url)}`;
    }
    return "";
  }

  function handleInsertRecordingTimestamp(rec) {
    const stamp = rec?.createdAt ? formatCallTime(rec.createdAt) : "";
    const dur = rec?.duration != null ? formatDurationSeconds(rec.duration) : "";
    const header = stamp ? `[${stamp}]` : "[Call Recording]";
    const suffix = dur ? ` (Duration ${dur})` : "";
    const line = `${header} 🎧 Call recording${suffix}`;

    setLeadNotes((prev) => {
      const p = String(prev || "").trim();
      if (!p) return `${line}\n`;
      return `${p}\n\n${line}\n`;
    });
  }

  return (
    <div style={styles.modalOverlay}>
      <div
        style={{
          ...styles.leadModal,
          border: `1px solid ${stageColor}`,
          marginTop: modalOffset.y,
          marginLeft: modalOffset.x,
          width: modalSize.width,
          height: modalSize.height,
          maxWidth: "95vw",
          maxHeight: "90vh",
          fontSize: 16,
        }}
      >
        <div style={{ ...styles.leadModalHeader, background: stageColor }} onMouseDown={handleModalHeaderMouseDown}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Lead Details – {lead.name || "Unnamed"}</h2>
            <div style={{ fontSize: 16, opacity: 0.92 }}>
              {leadEmail ? `✉ ${leadEmail}` : ""} {leadEmail && leadPhone ? "  •  " : ""} {leadPhone ? `📞 ${leadPhone}` : ""}
            </div>
          </div>
          <span style={{ fontSize: 16, opacity: 0.9 }}>drag this bar to move</span>
        </div>

        <div style={styles.leadModalColumns}>
          {/* LEFT */}
          <div style={styles.leadModalLeft}>
            <div style={{ ...styles.detailsBox, ...panelTint }}>
              <LeadInfoCard lead={lead} stageColor={stageColor} fontScale={fontScale * 0.8} />
            </div>

            <div style={{ ...styles.callsSection, ...panelTint }}>
              <div style={styles.callsHeaderRow}>
                <span style={styles.callsTitle}>📞 Calls &amp; Voicemails</span>
              </div>

              <div style={styles.callsPhoneRow}>
                <span style={styles.callsPhoneText}>{leadPhone || "No phone on file"}</span>
                {!!leadPhone && (
                  <button type="button" onClick={() => setShowDialer((p) => !p)} style={styles.smallToggleBtn} title="Show/Hide dialer">
                    {showDialer ? "Hide dialer" : "Show dialer"}
                  </button>
                )}
              </div>

              {showDialer && leadPhone && <BrowserDialer toNumber={dialToNumber} displayName={lead.name || ""} userId={userId} />}

              <div style={styles.smsNavRow}>
                <button type="button" onClick={goToSmsPage} style={styles.smsNavBtn}>
                  Send SMS →
                </button>
                <span style={styles.smsNavHelp}>Opens SMS Marketing page (no clutter here)</span>
              </div>
            </div>

            <div style={{ ...styles.tasksSection, ...panelTint }}>
              <div style={styles.tasksHeaderRow}>
                <span style={{ ...styles.tasksTitle, fontWeight: 600, fontSize: 26, color: "#ccc011"}}>📌 Tasks &amp; reminders</span>
                {tasksLoading && <span style={{ ...styles.tasksLoading, fontSize: 16 }}>Loading…</span>}
              </div>

              <div style={styles.taskList}>
                {leadTasks.length === 0 && !tasksLoading && <p style={{ ...styles.taskEmptyText, fontSize: 16 }}>No tasks yet.</p>}

                {leadTasks.map((task) => (
                  <div key={task.id} style={styles.taskItem}>
                    <div style={styles.taskItemMain}>
                      <span style={{ ...styles.taskStatusDot, backgroundColor: task.completed ? "#22c55e" : "#f97316" }} />
                      <span style={{ ...styles.taskItemTitle, fontSize: 16 }}>{task.title}</span>
                    </div>
                    <div style={styles.taskItemMeta}>
                      {task.due_date && (
                        <span style={{ ...styles.taskMetaChip, fontSize: 16 }}>
                          Due: {new Date(task.due_date).toLocaleDateString("en-AU")}
                        </span>
                      )}
                      {task.completed && <span style={{ ...styles.taskMetaChip, fontSize: 16 }}>Completed</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={styles.leadModalRight}>
            <div
              style={{
                ...styles.notesBox,
                ...panelTint,
                paddingBottom: 14,
                flex: "0 0 auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 26, color: "#ccb314" }}>💼 Deal management</span>
                <span style={{ fontSize: 16, opacity: 0.8 }}>
                  Sales allocation, anticipated revenue, and next steps
                </span>
              </div>

              <div style={styles.dealSummaryRow}>
                <div style={styles.dealInfoChip}>
                  <span style={styles.dealInfoChipLabel}>Allocated to</span>
                  <div style={styles.dealInfoPillWrap}>
                    {assignedOwners.length ? (
                      assignedOwners.map((owner) => (
                        <span key={owner} style={styles.dealInfoPill} title={owner}>
                          <span style={styles.dealInfoAvatar} role="img" aria-label="Assigned member">
                            👤
                          </span>
                          {owner}
                        </span>
                      ))
                    ) : (
                      <strong style={styles.dealInfoValue}>Unassigned</strong>
                    )}
                  </div>
                </div>
                <div style={styles.dealInfoChip}>
                  <span style={styles.dealInfoChipLabel}>Expected Revenue</span>
                  <strong style={styles.dealInfoValue}>{formatMoney(dealMeta.dealValue)}</strong>
                </div>
                <div style={styles.dealInfoChip}>
                  <span style={styles.dealInfoChipLabel}>Product</span>
                  <strong style={styles.dealInfoValue}>{dealMeta.product || "Not set"}</strong>
                </div>
                <div style={styles.dealInfoChip}>
                  <span style={styles.dealInfoChipLabel}>Tags</span>
                  <div style={styles.dealInfoPillWrap}>
                    {tagItems.length ? (
                      tagItems.map((tag) => (
                        <span key={tag} style={{ ...styles.dealInfoPill, color: "#fdba74" }}>
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <strong style={styles.dealInfoValue}>None</strong>
                    )}
                  </div>
                </div>
                <div style={styles.dealInfoChip}>
                  <span style={styles.dealInfoChipLabel}>Quote</span>
                  <strong style={styles.dealInfoValue}>{dealMeta.quoteStatus || "draft"}</strong>
                </div>
                <div style={styles.dealInfoChip}>
                  <span style={styles.dealInfoChipLabel}>Template</span>
                  <strong style={styles.dealInfoValue}>{activeQuoteTemplate?.name || dealMeta.quoteTemplateName || "Custom"}</strong>
                </div>
                <div style={styles.dealInfoChip}>
                  <span style={styles.dealInfoChipLabel}>Valid Until</span>
                  <strong style={styles.dealInfoValue}>{dealMeta.quoteValidUntil || "Not set"}</strong>
                </div>
              </div>

              {!!ownerOptions.length && (
                <div style={styles.ownerQuickRow}>
                  <span style={styles.ownerQuickLabel}>Assign one or more team members:</span>
                  {ownerOptions.map((owner) => {
                    const isSelected = assignedOwners.includes(owner);
                    return (
                      <button
                        key={owner}
                        type="button"
                        onClick={() => setDealMeta((prev) => ({ ...prev, owner: toggleListItem(prev.owner, owner) }))}
                        style={{
                          ...styles.ownerQuickBtn,
                          borderColor: isSelected ? stageColor : "rgba(148,163,184,0.25)",
                          background: isSelected ? "rgba(34,197,94,0.18)" : "rgba(2,6,23,0.5)",
                        }}
                      >
                        <span style={styles.ownerQuickAvatar} role="img" aria-label="Owner">
                          👤
                        </span>
                        {owner}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <select
                  value={dealMeta.team}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, team: e.target.value }))}
                  style={{ ...styles.taskTypeSelect, fontSize: 16 }}
                >
                  <option value="">No team assigned</option>
                  {teamOptions.map((team) => (
                    <option key={team.id} value={team.name}>
                      {team.name}
                    </option>
                  ))}
                </select>

                <div>
                  <input
                    type="text"
                    value={dealMeta.owner}
                    onChange={(e) => setDealMeta((prev) => ({ ...prev, owner: e.target.value }))}
                    style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                    placeholder="Allocated to (comma-separated)"
                    list="crm-owner-options"
                    aria-label="Allocated to"
                  />
                  <datalist id="crm-owner-options">
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner} />
                    ))}
                  </datalist>
                </div>

                <select
                  value={dealMeta.priority}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, priority: e.target.value }))}
                  style={{ ...styles.taskTypeSelect, fontSize: 16 }}
                >
                  <option value="Low">Low priority</option>
                  <option value="Medium">Medium priority</option>
                  <option value="High">High priority</option>
                </select>

                <select
                  value={dealMeta.status}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, status: e.target.value }))}
                  style={{ ...styles.taskTypeSelect, fontSize: 16 }}
                >
                  <option value="open">Open</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>

                <input
                  type="number"
                  min="0"
                  value={dealMeta.dealValue}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, dealValue: e.target.value }))}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                  placeholder="Expected revenue (AUD)"
                  aria-label="Expected revenue"
                />

                <input
                  type="number"
                  min="0"
                  max="100"
                  value={dealMeta.probability}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, probability: e.target.value }))}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                  placeholder="Probability %"
                />

                <input
                  type="date"
                  value={dealMeta.closeDate}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, closeDate: e.target.value }))}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                />

                <select
                  value={dealMeta.source}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, source: e.target.value }))}
                  style={{ ...styles.taskTypeSelect, fontSize: 16 }}
                  aria-label="Lead source"
                >
                  <option value="">Select lead source</option>
                  {LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {!!dealMeta.source && !LEAD_SOURCE_OPTIONS.includes(dealMeta.source) && (
                    <option value={dealMeta.source}>{dealMeta.source}</option>
                  )}
                </select>

                <input
                  type="text"
                  value={dealMeta.product}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, product: e.target.value }))}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                  placeholder="Product or offer"
                  aria-label="Product"
                />

                <select
                  value={dealMeta.quoteStatus}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteStatus: e.target.value }))}
                  style={{ ...styles.taskTypeSelect, fontSize: 16 }}
                >
                  <option value="draft">Quote Draft</option>
                  <option value="sent">Quote Sent</option>
                  <option value="accepted">Quote Accepted</option>
                  <option value="declined">Quote Declined</option>
                </select>

                <input
                  type="text"
                  value={dealMeta.quoteNumber}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteNumber: e.target.value }))}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                  placeholder="Quote number"
                  aria-label="Quote number"
                />
              </div>

              <input
                type="text"
                value={dealMeta.nextStep}
                onChange={(e) => setDealMeta((prev) => ({ ...prev, nextStep: e.target.value }))}
                style={{ ...styles.addTaskTextInput, fontSize: 16, marginTop: 8 }}
                placeholder="Next step / follow-up"
              />

              <input
                type="text"
                value={dealMeta.outcome}
                onChange={(e) => setDealMeta((prev) => ({ ...prev, outcome: e.target.value }))}
                style={{ ...styles.addTaskTextInput, fontSize: 16, marginTop: 8 }}
                placeholder="Win/loss reason or qualification note"
              />

              <input
                type="text"
                value={dealMeta.tags}
                onChange={(e) => setDealMeta((prev) => ({ ...prev, tags: e.target.value }))}
                style={{ ...styles.addTaskTextInput, fontSize: 16, marginTop: 8 }}
                placeholder="Tags (comma-separated)"
                aria-label="Tags"
              />

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => handleSaveDealMeta()} style={{ ...styles.addTaskBtn, fontSize: 16 }}>
                  Save Deal Details
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDealMeta({ ...dealMeta, status: "won" })}
                  style={{ ...styles.pillBtn, background: "#166534", fontSize: 16 }}
                >
                  Mark Won
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDealMeta({ ...dealMeta, status: "lost" })}
                  style={{ ...styles.pillBtn, background: "#991b1b", fontSize: 16 }}
                >
                  Mark Lost
                </button>
              </div>
            </div>

            <div style={{ ...styles.emailSection, ...panelTint }}>
              <div style={styles.emailHeader}>
                <span style={{ fontWeight: 600, fontSize: 26, color: "#ccb314" }}>🧾 Quotation Builder</span>
                <Link href="/modules/email/crm/quotes" style={styles.emailTemplateLink}>
                  Quote templates
                </Link>
              </div>

              <div style={styles.emailStatus}>
                Select a template, adjust the line items, and save the quote against this lead.
              </div>

              <div style={styles.emailStatus}>
                {accountBrandingLoaded ? `Branded as ${accountBranding.companyName || "your company"}${accountBranding.logoUrl ? " with logo included" : ""}. This export now uses a full proposal layout with cover, company info, product info and the final quote sheet.` : "Loading company branding for this quote…"}
              </div>

              <div
                style={{
                  border: `1px solid ${activeQuoteLayout?.accent || "#f59e0b"}55`,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    background: activeQuoteLayout?.banner || "linear-gradient(135deg,#f59e0b,#facc15)",
                    color: activeQuoteLayout?.id === "minimal" ? "#f8fafc" : "#111827",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {accountBranding.logoUrl ? (
                      <img src={accountBranding.logoUrl} alt="Company logo" style={{ width: 52, height: 52, objectFit: "contain", borderRadius: 10, background: "#fff", padding: 4 }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: 10, background: "rgba(255,255,255,0.22)", display: "grid", placeItems: "center", fontWeight: 900 }}>
                        {getInitials(accountBranding.companyName || "YC")}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{accountBranding.companyName || "Your Company"}</div>
                      <div style={{ fontSize: 16, opacity: 0.9 }}>{activeQuoteLayout?.name || "Modern Gold"} quotation style</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, lineHeight: 1.5, textAlign: "right" }}>
                    {accountBranding.email ? <div>{accountBranding.email}</div> : null}
                    {accountBranding.phone ? <div>{accountBranding.phone}</div> : null}
                    {accountBranding.website ? <div>{accountBranding.website}</div> : null}
                    {accountBranding.address ? <div>{accountBranding.address}</div> : null}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <select
                  value={dealMeta.quoteTemplateId || ""}
                  onChange={(e) => applyQuoteTemplate(e.target.value)}
                  style={{ ...styles.taskTypeSelect, fontSize: 16 }}
                >
                  <option value="">Choose quote template</option>
                  {quoteTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>

                <select
                  value={dealMeta.quoteLayout || "modern"}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteLayout: e.target.value }))}
                  style={{ ...styles.taskTypeSelect, fontSize: 16 }}
                >
                  {QUOTE_LAYOUT_OPTIONS.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.name}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={dealMeta.quoteValidUntil || ""}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteValidUntil: e.target.value }))}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                  aria-label="Quote valid until"
                />
              </div>

              <div style={styles.quoteItemsWrap}>
                {quoteItems.map((item, index) => (
                  <div key={`quote-item-${index}`} style={styles.quoteItemCard}>
                    <div style={styles.quoteItemRow}>
                      <textarea
                        value={item.description}
                        onChange={(e) => updateQuoteItem(index, { description: e.target.value })}
                        style={{ ...styles.addTaskTextInput, ...styles.quoteItemTextArea, fontSize: 16 }}
                        placeholder="Line item description"
                        rows={2}
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateQuoteItem(index, { qty: Math.max(1, Number(e.target.value) || 1) })}
                        style={{ ...styles.addTaskTextInput, ...styles.quoteItemMiniInput, fontSize: 16 }}
                        aria-label="Quantity"
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) => updateQuoteItem(index, { price: Math.max(0, Number(e.target.value) || 0) })}
                        style={{ ...styles.addTaskTextInput, ...styles.quoteItemMiniInput, fontSize: 16 }}
                        aria-label="Price"
                      />
                      <button
                        type="button"
                        onClick={() => removeQuoteItem(index)}
                        style={{ ...styles.pillBtn, background: "#7f1d1d", padding: "6px 10px" }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={styles.quoteImageRow}>
                      <input
                        type="text"
                        value={item.imageUrl || ""}
                        onChange={(e) => updateQuoteItem(index, { imageUrl: e.target.value })}
                        style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                        placeholder="Product image URL for brochure"
                      />
                      <label style={styles.quoteUploadBtn}>
                        Upload image
                        <input type="file" accept="image/*" onChange={(e) => handleQuoteItemImageUpload(index, e)} style={{ display: "none" }} />
                      </label>
                    </div>

                    {item.imageUrl ? <img src={item.imageUrl} alt="Quote item preview" style={styles.quoteItemPreviewImage} /> : null}
                  </div>
                ))}

                <button type="button" onClick={addQuoteItem} style={{ ...styles.addTaskBtn, alignSelf: "flex-start", fontSize: 16 }}>
                  + Add line item
                </button>
              </div>

              <div style={styles.quoteSummaryRow}>
                <div style={styles.quoteSummaryCard}>
                  <span style={styles.dealInfoChipLabel}>Subtotal</span>
                  <strong style={styles.dealInfoValue}>{formatMoney(quoteTotals.subtotal)}</strong>
                </div>
                <div style={styles.quoteSummaryCard}>
                  <span style={styles.dealInfoChipLabel}>Tax</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={dealMeta.quoteTaxRate ?? 10}
                      onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteTaxRate: Math.max(0, Number(e.target.value) || 0) }))}
                      style={{ ...styles.addTaskTextInput, width: 82, fontSize: 16 }}
                    />
                    <strong style={styles.dealInfoValue}>{formatMoney(quoteTotals.tax)}</strong>
                  </div>
                </div>
                <div style={styles.quoteSummaryCard}>
                  <span style={styles.dealInfoChipLabel}>Total</span>
                  <strong style={styles.dealInfoValue}>{formatMoney(quoteTotals.total)}</strong>
                </div>
              </div>

              <textarea
                value={dealMeta.quoteNotes || ""}
                onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteNotes: e.target.value }))}
                style={styles.quoteTextarea}
                placeholder="Quote notes for the client"
              />

              <textarea
                value={dealMeta.quoteTerms || ""}
                onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteTerms: e.target.value }))}
                style={styles.quoteTextarea}
                placeholder="Terms and conditions"
              />

              <div style={styles.quoteEmailPanel}>
                <div style={styles.emailHeader}>
                  <span style={{ fontWeight: 600, fontSize: 26, color: "#ccc011" }}>Quote email message</span>
                  <span style={styles.emailMeta}>Sent as a proper email with the quote attached as PDF</span>
                </div>
                <input
                  type="text"
                  value={dealMeta.quoteEmailSubject || ""}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteEmailSubject: e.target.value }))}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                  placeholder="Email subject for this quote"
                />
                <textarea
                  value={dealMeta.quoteEmailMessage || ""}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteEmailMessage: e.target.value }))}
                  style={styles.quoteTextarea}
                  placeholder="Add your personal note before sending"
                />
                <textarea
                  value={dealMeta.quoteEmailSignature || ""}
                  onChange={(e) => setDealMeta((prev) => ({ ...prev, quoteEmailSignature: e.target.value }))}
                  style={styles.quoteTextarea}
                  placeholder="Email signature"
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <button type="button" onClick={() => handleSaveQuote("draft")} style={{ ...styles.addTaskBtn, fontSize: 16 }}>
                  Save Quote
                </button>
                <button
                  type="button"
                  onClick={handleSendQuoteEmail}
                  disabled={isSendingQuote || !lead?.email}
                  style={{ ...styles.pillBtn, background: "#1d4ed8", fontSize: 16, opacity: isSendingQuote || !lead?.email ? 0.75 : 1 }}
                >
                  {isSendingQuote ? "Sending…" : "Send PDF Quote"}
                </button>
                <button type="button" onClick={handleExportQuotePdf} style={{ ...styles.pillBtn, background: "#7c3aed", fontSize: 16 }}>
                  Export PDF
                </button>
                <button type="button" onClick={() => handleSaveQuote("accepted")} style={{ ...styles.pillBtn, background: "#166534", fontSize: 16 }}>
                  Accepted
                </button>
                <button type="button" onClick={() => handleSaveQuote("declined")} style={{ ...styles.pillBtn, background: "#991b1b", fontSize: 16 }}>
                  Declined
                </button>
              </div>

              <div style={styles.emailStatus}>
                {quoteActionStatus || (lead?.email ? "The client will receive a clean email with your note, signature and the quote attached as a PDF." : "Add an email address to this lead to send the quote.")}
              </div>
            </div>

            <div style={{ ...styles.emailSection, ...panelTint }}>
              <div style={styles.emailHeader}>
                <span style={{ fontWeight: 600, fontSize: 26, color: "#ccc011" }}>✉️ Send email</span>
                <span style={styles.emailMeta}>{lead.email || "No email on file"}</span>
              </div>

              <div style={styles.emailControlsGrid}>
                <select
                  value={selectedEmailTemplate}
                  onChange={(e) => handleChooseEmailTemplate(e.target.value)}
                  style={{ ...styles.taskTypeSelect, fontSize: 16 }}
                >
                  <option value="">-- Select from My Saved Emails --</option>
                  {savedEmailTemplates.map((template) => (
                    <option key={template.path} value={template.path}>
                      {template.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                  placeholder="Email subject"
                />
              </div>

              <div style={styles.emailStatus}>
                {emailStatus || (savedEmailsLoading ? "Loading saved emails…" : savedEmailTemplates.length ? "Choose a saved email template and send it to this lead." : "No saved emails found yet." )}
              </div>

              <div style={styles.emailPreviewWrap}>
                {emailHtml ? (
                  <iframe title="Email preview" srcDoc={emailHtml} style={styles.emailPreviewFrame} />
                ) : (
                  <div style={styles.emailPreviewEmpty}>Select one of your saved emails to preview it here.</div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleSendLeadEmail}
                  disabled={!lead?.email || !selectedEmailTemplate || isSendingEmail}
                  style={{ ...styles.addTaskBtn, fontSize: 16, opacity: !lead?.email || isSendingEmail ? 0.75 : 1 }}
                >
                  {isSendingEmail ? "Sending…" : "Send Email"}
                </button>
                <Link href="/modules/email/templates/select" style={styles.emailTemplateLink}>
                  Manage Saved Emails
                </Link>
              </div>
            </div>

            <div style={{ ...styles.notesBox, ...panelTint, minHeight: 380 }}>
              <div style={styles.notesHeader}>
                <span style={{ fontWeight: 600, fontSize: 26, color: "#ccc011" }}>Notes</span>
                <div style={styles.notesHeaderActions}>
                  <button
                    type="button"
                    onClick={addTimestampHeader}
                    style={{
                      ...styles.pillBtn,
                      background: "#0f172a",
                      fontSize: 16,
                      border: "1px solid rgba(255,255,255,0.35)",
                    }}
                  >
                    + New note
                  </button>

                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    style={{
                      ...styles.pillBtn,
                      background: isRecording ? "#b91c1c" : stageColor,
                      fontSize: 16,
                    }}
                  >
                    {isRecording ? "⏹ Stop Recording" : "🎙 Voice to Text"}
                  </button>
                </div>
              </div>

              {/* RECORDINGS TIMELINE (COMPACT, INSIDE NOTES BOX) */}
              <div style={styles.notesRecList}>
                {recError ? <div style={styles.notesRecError}>{recError}</div> : null}

                {!recError && mergedRecordings.length === 0 && !recLoading ? (
                  <div style={styles.notesRecEmpty}>No recordings found for this lead.</div>
                ) : null}

                {mergedRecordings.slice(0, 10).map((r) => {
                  const src = getAudioSrc(r);
                  const stamp = r.createdAt ? formatCallTime(r.createdAt) : "";
                  const dur = r.duration != null ? formatDurationSeconds(r.duration) : "";

                  return (
                    <div key={r.key} style={styles.notesRecItem}>
                      <div style={styles.notesRecTopRow}>
                        <span style={styles.notesRecMeta}>{stamp}</span>
                        <span style={styles.notesRecMeta}>{dur}</span>
                      </div>

                      <div style={styles.notesRecMidRow}>
                        <span style={styles.notesRecMetaSoft}>
                          {r.to ? `To: ${r.to}` : ""}
                          {r.to && r.from ? "  •  " : ""}
                          {r.from ? `From: ${r.from}` : ""}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleInsertRecordingTimestamp(r)}
                          style={styles.notesRecInsertBtn}
                          title="Insert a simple line into notes at the bottom (no SID, no junk)"
                        >
                          + add note line
                        </button>
                      </div>

                      {src ? (
                        <audio controls preload="metadata" style={styles.notesRecAudio} src={src} />
                      ) : (
                        <div style={styles.notesRecError}>Recording has no playable source (missing recording_url / recording sid).</div>
                      )}

                      <div style={styles.notesRecSourceRow}>
                        <span style={styles.notesRecSourceChip}>{r.source === "db" ? "Supabase" : "Twilio"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* NOTES TEXTAREA (ONLY USER NOTES) */}
              <textarea
                rows={10}
                style={{ ...styles.notesTextarea, fontSize: 16 }}
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                placeholder="Type or use voice-to-text to record call notes..."
              />
            </div>

            <div style={{ ...styles.addTaskSection, ...panelTint }}>
              <h3 style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 26, color: "#ccc011"}}>📌 Add upcoming task</h3>

              <div style={styles.addTaskRowTop}>
                <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} style={{ ...styles.taskTypeSelect, fontSize: 16 }}>
                  <option value="phone_call">Phone call</option>
                  <option value="text_message">Text message</option>
                  <option value="zoom_call">Zoom call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="in_person">Meeting in person</option>
                  <option value="other">Other</option>
                </select>

                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  style={{ ...styles.addTaskTextInput, fontSize: 16 }}
                  placeholder="e.g. Call lead about follow-up"
                />
              </div>

              <div style={styles.addTaskRowBottom}>
                <div style={styles.calendarPicker}>
                  <button type="button" onClick={() => setIsCalendarOpen((prev) => !prev)} style={{ ...styles.calendarTrigger, fontSize: 16 }}>
                    {newTaskDate ? new Date(newTaskDate).toLocaleDateString("en-AU") : "Select date"}
                  </button>

                  {isCalendarOpen && (
                    <div style={styles.calendarPopover}>
                      <div style={styles.calendarHeader}>
                        <button type="button" onClick={() => goMonth(-1)} style={styles.calendarNavBtn}>
                          ◀
                        </button>
                        <span style={styles.calendarHeaderLabel}>{calendarLabel}</span>
                        <button type="button" onClick={() => goMonth(1)} style={styles.calendarNavBtn}>
                          ▶
                        </button>
                      </div>

                      <div style={styles.calendarWeekdays}>
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                          <span key={d} style={styles.calendarWeekday}>
                            {d}
                          </span>
                        ))}
                      </div>

                      <div style={styles.calendarGrid}>
                        {calendarCells.map((day, idx) => {
                          if (!day) return <span key={idx} style={styles.calendarEmptyCell} />;

                          const iso = toISODate(day);
                          const isToday = iso === todayStr;
                          const isSelected = iso === newTaskDate;

                          return (
                            <button
                              type="button"
                              key={idx}
                              onClick={() => {
                                setNewTaskDate(iso);
                                setIsCalendarOpen(false);
                              }}
                              style={{
                                ...styles.calendarDayBtn,
                                ...(isSelected ? styles.calendarDaySelected : {}),
                                ...(isToday ? styles.calendarDayToday : {}),
                              }}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} style={{ ...styles.addTaskTimeInput, fontSize: 16 }} />

                <button type="button" onClick={handleAddUpcomingTask} style={{ ...styles.addTaskBtn, fontSize: 16 }}>
                  + Save task
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footerBar}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => alert("Add to CRM is already active for this lead.")}
              style={{
                ...styles.footerBtn,
                background: "rgba(34,197,94,0.15)",
                border: "1px solid rgba(34,197,94,0.45)",
              }}
              disabled={!lead?.id}
              title="Add to CRM"
            >
              Add to CRM
            </button>

            <button
              id="gr8-automation-toggle"
              type="button"
              onClick={() => setShowAutomation((p) => !p)}
              style={{
                ...styles.footerBtn,
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.45)",
              }}
              disabled={!lead?.id}
              title="Send this lead into an Automation Flow"
            >
              Send to Automation
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleCloseInternal} style={{ ...styles.backBtn2, fontSize: 16 }} disabled={isRecording}>
              Close
            </button>
            <button onClick={handleSaveDealMeta} style={{ ...styles.footerBtn, fontSize: 16 }}>
              Save Deal
            </button>
            <button onClick={handleSaveLeadNotes} style={{ ...styles.saveBtn, fontSize: 16 }}>
              Save Notes
            </button>
          </div>
        </div>

        {showAutomation && (
          <div id="gr8-automation-popover" style={styles.automationPopover}>
            <div style={styles.automationPopoverHeader}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#e5e7eb" }}>Send to Automation</div>
              <button type="button" onClick={() => setShowAutomation(false)} style={styles.automationPopoverX} title="Close">
                ×
              </button>
            </div>
            <div style={styles.automationPopoverBody}>
              <SendToAutomationPanel leadId={lead?.id} onSent={() => setShowAutomation(false)} />
            </div>
          </div>
        )}

        <div style={styles.resizeHandle} onMouseDown={handleResizeMouseDown} title="Drag to resize" />
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  leadModal: {
    background: "#020617",
    borderRadius: "14px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.7)",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },

  leadModalHeader: {
    padding: "10px 16px",
    borderTopLeftRadius: "14px",
    borderTopRightRadius: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "grab",
  },

  leadModalColumns: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: "22px",
    padding: "18px 20px 12px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },

  leadModalLeft: {
    borderRight: "1px solid #1f2937",
    paddingRight: "12px",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    gap: 10,
    overflowY: "auto",
  },

  leadModalRight: {
    paddingLeft: "4px",
    paddingRight: "6px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height: "100%",
    minHeight: 0,
    overflowY: "auto",
  },

  detailsBox: {
    padding: 0,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.4)",
    background: "rgba(15,23,42,0.95)",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
  },

  callsSection: {
    padding: "10px 10px 10px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px dashed #1f2937",
  },

  callsHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  callsTitle: { fontWeight: 600, fontSize: 26, color: "#ccc011" },

  callsPhoneRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  callsPhoneText: { fontsize : 16, opacity: 0.85 },

  smallToggleBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 600,
    fontsize : 16,
    whiteSpace: "nowrap",
  },

  smsNavRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid rgba(148,163,184,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  smsNavBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(34,197,94,0.14)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 600,
    fontsize : 16,
    whiteSpace: "nowrap",
  },

  smsNavHelp: { fontsize : 16, color: "#94a3b8" },

  notesBox: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(148,163,184,0.4)",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
  },

  emailSection: {
    padding: "10px 12px 12px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(148,163,184,0.4)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flex: "0 0 auto",
  },

  emailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  emailMeta: {
    color: "#93c5fd",
    fontSize: 16,
    fontWeight: 600,
  },

  emailControlsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  emailStatus: {
    color: "#cbd5e1",
    fontSize: 16,
    minHeight: 18,
  },

  emailPreviewWrap: {
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.55)",
    minHeight: 180,
  },

  emailPreviewFrame: {
    width: "100%",
    height: 220,
    border: "none",
    background: "#fff",
  },

  emailPreviewEmpty: {
    minHeight: 180,
    display: "grid",
    placeItems: "center",
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    padding: 16,
  },

  emailTemplateLink: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 16,
  },

  quoteItemsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 2,
  },

  quoteItemCard: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.35)",
  },

  quoteItemRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.6fr) 90px 120px auto",
    gap: 8,
    alignItems: "center",
  },

  quoteItemTextInput: {
    width: "100%",
  },

  quoteItemTextArea: {
    width: "100%",
    minHeight: 64,
    resize: "vertical",
    paddingTop: 10,
    lineHeight: 1.45,
  },

  quoteItemMiniInput: {
    width: "100%",
  },

  quoteImageRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    alignItems: "center",
  },

  quoteUploadBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 12px",
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  quoteItemPreviewImage: {
    width: "100%",
    maxHeight: 180,
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "#0f172a",
  },

  quoteEmailPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(37,99,235,0.28)",
    background: "rgba(30,41,59,0.32)",
  },

  quoteSummaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    marginTop: 4,
  },

  quoteSummaryCard: {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.5)",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  quoteTextarea: {
    width: "100%",
    minHeight: 78,
    borderRadius: 10,
    border: "1px solid #4b5563",
    padding: "10px 12px",
    background: "#020617",
    color: "#fff",
    resize: "vertical",
    fontSize: 16,
    lineHeight: 1.5,
    boxSizing: "border-box",
  },

  pillBtn: {
    border: "none",
    borderRadius: 999,
    padding: "6px 14px",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },

  notesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },

  notesHeaderActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  notesRecList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 10,
  },

  notesRecError: {
    fontsize : 16,
    fontWeight: 600,
    color: "#fecaca",
    opacity: 0.95,
  },

  notesRecEmpty: {
    fontsize : 16,
    fontWeight: 800,
    color: "#94a3b8",
    opacity: 0.95,
    padding: "6px 2px",
  },

  notesRecItem: {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(2,6,23,0.45)",
    padding: "8px 10px",
  },

  notesRecTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },

  notesRecMidRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },

  notesRecMeta: {
    fontsize : 16,
    fontWeight: 800,
    color: "#e5e7eb",
    opacity: 0.88,
    minHeight: 16,
  },

  notesRecMetaSoft: {
    fontsize : 16,
    fontWeight: 600,
    color: "#e5e7eb",
    opacity: 0.72,
    minHeight: 16,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "70%",
  },

  notesRecInsertBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 600,
    fontsize : 16,
    whiteSpace: "nowrap",
  },

  notesRecAudio: {
    width: "100%",
    height: 28,
  },

  notesRecSourceRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },

  notesRecSourceChip: {
    fontsize : 16,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.18)",
    color: "#e5e7eb",
  },

  notesTextarea: {
    width: "100%",
    borderRadius: "10px",
    border: "1px solid #4b5563",
    padding: "10px 12px",
    background: "#020617",
    color: "#fff",
    lineHeight: 1.5,
    flex: 1,
    minHeight: 0,
    height: "100%",
    resize: "none",
    fontFamily: 'Arial, "Helvetica Neue", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  addTaskSection: {
    marginTop: "auto",
    padding: "10px 12px 12px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(148,163,184,0.4)",
  },

  addTaskRowTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)",
    gap: 8,
    marginBottom: 8,
  },

  addTaskRowBottom: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr) auto",
    gap: 8,
    marginBottom: 4,
  },

  taskTypeSelect: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#fff",
  },

  addTaskTextInput: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#fff",
  },

  addTaskTimeInput: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#fff",
  },

  addTaskBtn: {
    borderRadius: 8,
    border: "none",
    padding: "6px 10px",
    background: "#22c55e",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  calendarPicker: { position: "relative" },

  calendarTrigger: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
  },

  calendarPopover: {
    position: "absolute",
    bottom: "110%",
    left: 0,
    zIndex: 9999,
    background: "#020617",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.6)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.7)",
    padding: 8,
    width: 230,
  },

  calendarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  calendarHeaderLabel: { fontsize : 16, fontWeight: 600 },

  calendarNavBtn: {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    padding: "2px 6px",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    fontsize : 16,
  },

  calendarWeekdays: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 2,
    marginBottom: 2,
  },

  calendarWeekday: { fontsize : 16, textAlign: "center", opacity: 0.7 },

  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 2,
  },

  calendarEmptyCell: { height: 26 },

  calendarDayBtn: {
    height: 26,
    borderRadius: 6,
    border: "1px solid transparent",
    background: "rgba(15,23,42,0.95)",
    color: "#e5e7eb",
    fontsize : 16,
    cursor: "pointer",
  },

  calendarDaySelected: {
    background: "#22c55e",
    borderColor: "#22c55e",
    color: "#fff",
    fontWeight: 900,
  },

  calendarDayToday: {
    boxShadow: "0 0 0 1px #0ea5e9 inset",
  },

  tasksSection: {
    padding: "10px 10px 8px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px dashed #1f2937",
  },

  tasksHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  tasksTitle: { fontsize : 16, fontWeight: 600, opacity: 0.9 },
  tasksLoading: { fontsize : 16, opacity: 0.7 },

  taskList: {
    marginTop: 4,
    maxHeight: 240,
    overflowY: "auto",
    paddingRight: 4,
  },

  taskEmptyText: { fontsize : 16, opacity: 0.7, margin: 0 },

  taskItem: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #1f2937",
    background: "#020617",
    marginBottom: 6,
  },

  taskItemMain: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },

  taskStatusDot: { width: 8, height: 8, borderRadius: "999px" },
  taskItemTitle: { fontsize : 16 },
  taskItemMeta: { display: "flex", flexWrap: "wrap", gap: 6 },

  taskMetaChip: {
    fontsize : 16,
    padding: "2px 6px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.2)",
  },

  footerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px 12px",
    borderTop: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.96)",
    position: "sticky",
    bottom: 0,
    zIndex: 5,
    flexWrap: "wrap",
  },

  footerBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 16,
    whiteSpace: "nowrap",
    minHeight: 40,
    border: "1px solid rgba(148,163,184,0.25)",
  },

  dealSummaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 8,
    marginBottom: 10,
    alignItems: "start",
  },

  dealInfoChip: {
    display: "grid",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 10,
    background: "rgba(2,6,23,0.45)",
    border: "1px solid rgba(148,163,184,0.18)",
    color: "#e5e7eb",
    fontSize: 16,
    minWidth: 0,
    overflow: "hidden",
  },

  dealInfoChipLabel: {
    fontSize: 16,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  dealInfoValue: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.35,
    wordBreak: "break-word",
  },

  dealInfoPillWrap: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    minWidth: 0,
  },

  dealInfoPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.15)",
    color: "#e2e8f0",
    fontSize: 16,
    maxWidth: "100%",
    wordBreak: "break-word",
  },

  dealInfoAvatar: {
    width: 18,
    height: 18,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,0.25)",
    color: "#bfdbfe",
    fontSize: 10,
    flexShrink: 0,
  },

  ownerQuickRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 10,
    alignItems: "center",
  },

  ownerQuickLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 600,
    marginRight: 4,
  },

  ownerQuickBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.5)",
    color: "#e5e7eb",
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    maxWidth: "100%",
  },

  ownerQuickAvatar: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,0.25)",
    color: "#bfdbfe",
    fontSize: 16,
    fontWeight: 600,
    flexShrink: 0,
  },

  backBtn2: {
    background: "rgba(255,255,255,0.18)",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.16)",
    fontSize: 16,
    fontWeight: 600,
  },

  saveBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontsize : 16,
  },

  automationPopover: {
    position: "absolute",
    left: 16,
    bottom: 64,
    width: 420,
    maxWidth: "calc(100% - 32px)",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.96)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.7)",
    zIndex: 9999,
    overflow: "hidden",
  },

  automationPopoverHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
  },

  automationPopoverX: {
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    fontsize : 16,
    cursor: "pointer",
    lineHeight: 1,
  },

  automationPopoverBody: {
    padding: 10,
  },

  resizeHandle: {
    position: "absolute",
    width: "16px",
    height: "16px",
    right: "8px",
    bottom: "8px",
    borderRadius: "4px",
    border: "1px solid #4b5563",
    background: "rgba(15,23,42,0.9)",
    cursor: "se-resize",
  },
};
