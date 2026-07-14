import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getIp } from "../../../lib/rateLimit";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null;

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const rl = checkRateLimit(`fgp:${getIp(req)}`, 8, 60 * 1000);
  if (!rl.ok) return res.status(429).json({ ok: false, error: "Too many requests. Please try again shortly." });

  try {
    const body = req.body || {};
    if (clean(body.company, 120)) {
      return res.status(200).json({ ok: true });
    }

    const payload = {
      agency_name: clean(body.agencyName, 180),
      contact_name: clean(body.contactName, 180),
      position: clean(body.position, 180),
      email: clean(body.email, 220).toLowerCase(),
      phone: clean(body.phone, 80),
      website: clean(body.website, 260),
      country: clean(body.country, 120),
      saas_experience: clean(body.saasExperience, 2400),
      message: clean(body.message, 3000),
      preferred_meeting_timing: clean(body.preferredTiming, 400),
      consent: body.consent === true,
      agency_slug: clean(body.agencySlug, 160),
      source_path: "/founding-growth-partner",
      ip_address: getIp(req),
      user_agent: clean(req.headers["user-agent"], 500),
    };

    const missing = [];
    ["agency_name", "contact_name", "email", "country", "message", "preferred_meeting_timing"].forEach((key) => {
      if (!payload[key]) missing.push(key);
    });
    if (!isEmail(payload.email)) missing.push("valid_email");
    if (!payload.consent) missing.push("consent");

    if (missing.length) {
      return res.status(400).json({ ok: false, error: "Please complete all required fields.", fields: missing });
    }

    if (!supabase) {
      return res.status(500).json({ ok: false, error: "Submission storage is not configured." });
    }

    const { error } = await supabase.from("founding_growth_partner_enquiries").insert(payload);
    if (error) {
      console.error("[founding-growth-partner] enquiry insert failed", error);
      return res.status(500).json({ ok: false, error: "Could not save the submission. Please contact Gr8 Result directly." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[founding-growth-partner] interest error", error);
    return res.status(500).json({ ok: false, error: "Submission failed. Please try again." });
  }
}
