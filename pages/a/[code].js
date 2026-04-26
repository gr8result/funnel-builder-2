// /pages/a/[code].js
//
// FULL FILE (NEW)
//
// ✅ Handles cookie link: /a/<tracking_code>
// ✅ Sets 90-day cookie
// ✅ Looks up affiliate_links by tracking_code
// ✅ Redirects to the product SALES page with affiliate code attached
// ✅ Works server-side (no client JS needed)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function makeSupabaseServer() {
  // Prefer service role for server-side lookup (avoids RLS headaches)
  if (SUPABASE_URL && SERVICE_KEY) {
    return createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  // Fallback (may fail if RLS blocks it)
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
}

function appendAffiliateParam(urlString, trackingCode) {
  if (!urlString) return null;

  try {
    // Absolute URL
    const u = new URL(urlString);
    u.searchParams.set("aff", trackingCode);
    return u.toString();
  } catch {
    // Relative path (internal Next route)
    const hasQuery = urlString.includes("?");
    const hasHash = urlString.includes("#");

    // Split off hash so we keep it
    let base = urlString;
    let hash = "";
    if (hasHash) {
      const parts = urlString.split("#");
      base = parts[0];
      hash = "#" + parts.slice(1).join("#");
    }

    const joiner = base.includes("?") ? "&" : "?";
    return `${base}${joiner}aff=${encodeURIComponent(trackingCode)}${hash}`;
  }
}

function setCookie(res, name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=/`,
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=Lax`,
  ];

  // If you're on https in production, also set Secure
  // (won't hurt locally because most browsers ignore Secure on http)
  if (process.env.NODE_ENV === "production") parts.push("Secure");

  // Use HttpOnly so client JS can’t mess with it
  parts.push("HttpOnly");

  res.setHeader("Set-Cookie", parts.join("; "));
}

export async function getServerSideProps(ctx) {
  const { code } = ctx.params || {};
  const trackingCode = String(code || "").trim();

  if (!trackingCode) {
    return {
      redirect: { destination: "/", permanent: false },
    };
  }

  const supabase = makeSupabaseServer();

  // 1) Find the affiliate link row for this tracking code
  const { data: linkRow, error: linkErr } = await supabase
    .from("affiliate_links")
    .select("product_id, affiliate_id, tracking_code")
    .eq("tracking_code", trackingCode)
    .maybeSingle();

  if (linkErr || !linkRow?.product_id) {
    // If code doesn't exist, don’t crash — send home
    return {
      redirect: { destination: "/", permanent: false },
    };
  }

  // 2) Find the product sales page URL/path
  // NOTE: This assumes your products table contains sales_page_url (common in your UI).
  // We also try a couple of common fallbacks.
  const { data: productRow } = await supabase
    .from("products")
    .select(
      "id, sales_page_url, sales_page, sales_url, affiliate_page_url, thumbnail_url, image_url, title"
    )
    .eq("id", linkRow.product_id)
    .maybeSingle();

  const salesUrl =
    productRow?.sales_page_url ||
    productRow?.sales_url ||
    productRow?.sales_page ||
    null;

  // 3) Set 90-day cookie (90 * 24 * 60 * 60 seconds)
  const ninetyDays = 90 * 24 * 60 * 60;

  // Cookie value can include both tracking code + product id if you want
  // Keep it simple: tracking_code
  setCookie(ctx.res, "gr8_affiliate", trackingCode, ninetyDays);

  // 4) Redirect to sales page with aff param attached
  const destination = appendAffiliateParam(salesUrl || "/", trackingCode) || "/";

  return {
    redirect: { destination, permanent: false },
  };
}

export default function AffiliateRedirectPage() {
  // Never renders (SSR redirect), but required as default export
  return null;
}
