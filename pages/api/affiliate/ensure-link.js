// /pages/api/affiliate/ensure-links.js
// FULL REPLACEMENT
//
// ✅ POST /api/affiliate/ensure-links
// Body: { product_ids: ["uuid", ...] }  (also tolerates { product_ids: "uuid" })
// Auth: Authorization: Bearer <supabase access_token>
//
// ✅ Uses SERVICE ROLE (server-only) to write affiliate_links
// ✅ Generates tracking_code in Node using crypto
// ✅ Safe: only generates for the logged-in affiliate_id
// ✅ Returns REAL failure reason (error + detail)
// ✅ Tolerates Next.js body arriving as string (parses JSON if needed)
// ✅ Returns: { ok:true, created, existing, links:[...] }

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import withAdmin from "../../../lib/withAdmin";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE ||
  "";

const supabaseAdmin =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    : null;

function getBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  if (!h || typeof h !== "string") return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function makeCode() {
  // GR8-XXXXXXXXXXXX (12 hex chars)
  const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `GR8-${raw}`;
}

function safeJson(res, status, payload) {
  return res.status(status).json(payload);
}

function normalizeProductIds(body) {
  let product_ids = body?.product_ids;

  if (typeof product_ids === "string" && product_ids.trim()) {
    product_ids = [product_ids.trim()];
  }

  const list = Array.isArray(product_ids)
    ? product_ids.map((x) => String(x || "").trim()).filter(Boolean)
    : [];

  return list;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return safeJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!SUPABASE_URL) {
      return safeJson(res, 500, {
        ok: false,
        error: "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) on server",
        detail:
          "Set SUPABASE_URL in .env.local (server) or ensure NEXT_PUBLIC_SUPABASE_URL exists.",
      });
    }

    if (!SERVICE_KEY) {
      return safeJson(res, 500, {
        ok: false,
        error: "Missing SUPABASE_SERVICE_ROLE_KEY on server",
        detail:
          "Add SUPABASE_SERVICE_ROLE_KEY to .env.local AND to Vercel env vars (Production + Preview).",
      });
    }

    if (!supabaseAdmin) {
      return safeJson(res, 500, {
        ok: false,
        error: "Server Supabase admin client failed to initialize",
      });
    }

    const token = getBearerToken(req);
    if (!token) {
      return safeJson(res, 401, { ok: false, error: "Missing Bearer token" });
    }

    // Validate user from token using ADMIN auth
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);

    if (userErr || !userData?.user?.id) {
      return safeJson(res, 401, {
        ok: false,
        error: "Invalid/expired session",
        detail: userErr?.message || null,
      });
    }

    const affiliateId = userData.user.id;

    // Tolerate req.body being a string (can happen depending on client / config)
    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return safeJson(res, 400, {
          ok: false,
          error: "Request body is not valid JSON",
          detail: e?.message || String(e),
        });
      }
    }

    const product_ids = normalizeProductIds(body);

    if (!product_ids.length) {
      return safeJson(res, 400, {
        ok: false,
        error: "product_ids must be a non-empty array",
        detail: "Send { product_ids: [\"uuid\", ...] }",
      });
    }

    // Pull existing links first
    const { data: existingRows, error: existingErr } = await supabaseAdmin
      .from("affiliate_links")
      .select("id, product_id, affiliate_id, tracking_code, created_at")
      .eq("affiliate_id", affiliateId)
      .in("product_id", product_ids);

    if (existingErr) {
      return safeJson(res, 500, {
        ok: false,
        error: "Failed reading affiliate_links",
        detail: existingErr.message,
      });
    }

    const existingMap = {};
    (existingRows || []).forEach((r) => {
      existingMap[r.product_id] = r;
    });

    const toCreate = product_ids.filter((pid) => !existingMap[pid]);
    let created = 0;

    for (const pid of toCreate) {
      let code = makeCode();

      // collision-safe
      for (let i = 0; i < 6; i++) {
        const { data: check, error: checkErr } = await supabaseAdmin
          .from("affiliate_links")
          .select("id")
          .eq("tracking_code", code)
          .limit(1);

        if (checkErr) {
          return safeJson(res, 500, {
            ok: false,
            error: "Failed validating tracking_code uniqueness",
            detail: checkErr.message,
          });
        }

        if (!check || check.length === 0) break;
        code = makeCode();
      }

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("affiliate_links")
        .insert([
          {
            product_id: pid,
            affiliate_id: affiliateId,
            tracking_code: code,
          },
        ])
        .select("id, product_id, affiliate_id, tracking_code, created_at")
        .single();

      // If unique constraint race occurred, re-fetch and continue
      if (insErr) {
        const { data: refetched, error: refErr } = await supabaseAdmin
          .from("affiliate_links")
          .select("id, product_id, affiliate_id, tracking_code, created_at")
          .eq("affiliate_id", affiliateId)
          .eq("product_id", pid)
          .maybeSingle();

        if (refErr) {
          return safeJson(res, 500, {
            ok: false,
            error: "Insert failed + refetch failed",
            detail: `${insErr.message} | ${refErr.message}`,
          });
        }

        if (refetched?.tracking_code) {
          existingMap[pid] = refetched;
          continue;
        }

        return safeJson(res, 500, {
          ok: false,
          error: "Insert failed (affiliate_links)",
          detail: insErr.message,
        });
      }

      if (inserted) {
        existingMap[pid] = inserted;
        created += 1;
      }
    }

    // Final fetch
    const { data: finalRows, error: finalErr } = await supabaseAdmin
      .from("affiliate_links")
      .select("id, product_id, affiliate_id, tracking_code, created_at")
      .eq("affiliate_id", affiliateId)
      .in("product_id", product_ids);

    if (finalErr) {
      return safeJson(res, 500, {
        ok: false,
        error: "Failed final read of affiliate_links",
        detail: finalErr.message,
      });
    }

    return safeJson(res, 200, {
      ok: true,
      created,
      existing: (existingRows || []).length,
      links: finalRows || [],
    });
  } catch (e) {
    return safeJson(res, 500, {
      ok: false,
      error: e?.message || "Server error",
      detail: e?.stack ? String(e.stack).slice(0, 2000) : null,
    });
  }
}

export default withAdmin(handler);
