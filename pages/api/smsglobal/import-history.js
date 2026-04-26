// /pages/api/smsglobal/import-history.js
// Import SMS history from SMSGlobal into sms_sent_history

import { createClient } from "@supabase/supabase-js";
import { buildSmsGlobalMacHeader } from "../../../lib/smsglobal/macAuth";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function s(v) {
  return String(v ?? "").trim();
}

function getBearer(req) {
  const a = s(req.headers.authorization);
  if (!a.toLowerCase().startsWith("bearer ")) return "";
  return a.slice(7).trim();
}

function toIsoMaybe(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pickProviderId(m) {
  return s(m?.id) || s(m?.messageId) || s(m?.message_id) || s(m?.provider_message_id);
}

function pickToPhone(m) {
  return s(m?.destination) || s(m?.to) || s(m?.number) || s(m?.recipient) || s(m?.msisdn);
}

function pickBody(m) {
  return s(m?.message) || s(m?.body) || s(m?.text) || s(m?.sms);
}

function pickOrigin(m) {
  return s(m?.origin) || s(m?.from);
}

function pickStatus(m) {
  const st = s(m?.status || m?.state || "sent").toLowerCase();
  return st || "sent";
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchSmsGlobalMessages({ apiKey, apiSecret, limit = 100, maxPages = 50 }) {
  const baseUrl = "https://api.smsglobal.com/v2/sms/";
  let offset = 0;
  let pages = 0;
  let all = [];

  while (pages < maxPages) {
    const url = `${baseUrl}?limit=${limit}&offset=${offset}`;
    const { header } = buildSmsGlobalMacHeader({
      apiKey,
      secretKey: apiSecret,
      method: "GET",
      url,
    });

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: header,
        Accept: "application/json",
      },
    });

    const txt = await r.text();
    let body = null;
    try {
      body = JSON.parse(txt);
    } catch {
      body = null;
    }

    if (!r.ok) {
      throw new Error(`SMSGlobal fetch failed (${r.status}): ${txt.slice(0, 300)}`);
    }

    const messages =
      body?.messages ||
      body?.data ||
      body?.results ||
      body?.items ||
      body?.sms ||
      [];

    if (Array.isArray(messages) && messages.length) {
      all = all.concat(messages);
    }

    const count = Array.isArray(messages) ? messages.length : 0;
    if (count < limit) break;

    offset += limit;
    pages += 1;
  }

  return all;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!SUPABASE_URL || !ANON_KEY) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env" });
    }

    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing Authorization token" });

    const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser();
    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const userId = userData.user.id;

    const { data: account, error: accountErr } = await supabaseAdmin
      .from("accounts")
      .select("sms_api_key, sms_api_secret")
      .eq("user_id", userId)
      .maybeSingle();

    if (accountErr) {
      return res.status(500).json({ ok: false, error: accountErr.message });
    }

    const apiKey = s(account?.sms_api_key) || s(process.env.SMSGLOBAL_API_KEY);
    const apiSecret = s(account?.sms_api_secret) || s(process.env.SMSGLOBAL_API_SECRET);

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ ok: false, error: "Missing SMSGlobal API credentials" });
    }

    const messages = await fetchSmsGlobalMessages({ apiKey, apiSecret });

    const providerIds = messages.map(pickProviderId).filter(Boolean);
    const existing = new Set();

    for (const chunk of chunkArray(providerIds, 100)) {
      const { data: rows, error: exErr } = await supabaseAdmin
        .from("sms_sent_history")
        .select("provider_message_id")
        .eq("user_id", userId)
        .in("provider_message_id", chunk);

      if (exErr) throw exErr;
      (rows || []).forEach((r) => existing.add(s(r.provider_message_id)));
    }

    const rowsToInsert = [];
    let skippedNoId = 0;
    let skippedExisting = 0;

    messages.forEach((m) => {
      const providerId = pickProviderId(m);
      if (!providerId) {
        skippedNoId += 1;
        return;
      }
      if (existing.has(providerId)) {
        skippedExisting += 1;
        return;
      }

      rowsToInsert.push({
        user_id: userId,
        to_phone: pickToPhone(m),
        body: pickBody(m),
        origin: pickOrigin(m),
        status: pickStatus(m),
        provider_message_id: providerId,
        sent_at: toIsoMaybe(m?.sent_at || m?.sentAt || m?.date_sent || m?.dateSent || m?.created_at || m?.createdAt),
        delivered_at: toIsoMaybe(m?.delivered_at || m?.deliveredAt || m?.deliveryTime),
        last_error: s(m?.error || m?.errorMessage || m?.last_error || "") || null,
      });
    });

    let inserted = 0;
    for (const chunk of chunkArray(rowsToInsert, 500)) {
      const { error: insErr } = await supabaseAdmin
        .from("sms_sent_history")
        .insert(chunk);
      if (insErr) throw insErr;
      inserted += chunk.length;
    }

    return res.status(200).json({
      ok: true,
      totalFetched: messages.length,
      inserted,
      skippedExisting,
      skippedNoId,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
