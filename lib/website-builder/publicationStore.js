import { supabaseAdmin } from "../supabaseAdmin";
import { normalizeDomain, resolveWebsiteDomain, slugifyWebsiteValue } from "./publishConfig";

function normalizePublication(record) {
  if (!record) return null;
  return {
    ...record,
    site_data: record.site_data && typeof record.site_data === "object" ? record.site_data : {},
    resolved_domain: resolveWebsiteDomain(record),
  };
}

export async function getPublishedWebsiteBySlug(slug) {
  const safeSlug = slugifyWebsiteValue(slug);
  if (!safeSlug) return null;

  const { data, error } = await supabaseAdmin
    .from("published_websites")
    .select("id, user_id, name, slug, primary_domain, custom_domain, domain_status, site_data, published, published_at, updated_at")
    .eq("slug", safeSlug)
    .eq("published", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizePublication(data);
}

export async function getPublishedWebsiteByDomain(hostname) {
  const host = normalizeDomain(hostname);
  if (!host) return null;

  const { data, error } = await supabaseAdmin
    .from("published_websites")
    .select("id, user_id, name, slug, primary_domain, custom_domain, domain_status, site_data, published, published_at, updated_at")
    .or(`custom_domain.eq.${host},primary_domain.eq.${host}`)
    .eq("published", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizePublication(data);
}