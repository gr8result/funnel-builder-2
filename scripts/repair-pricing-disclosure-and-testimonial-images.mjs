import assert from "node:assert/strict";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: process.env.WB_ENV_FILE || ".env.local", quiet: true });

const BASE_URL = (process.env.WB_BROWSER_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");
const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const PAGE_NAME = "Pricing";
const OWNER_EMAIL = "support@gr8result.com";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalAvatarUrl(item = {}) {
  return String(
    item.avatarUrl
    || item.avatar
    || item.imageUrl
    || item.image
    || item.photo
    || item.src
    || item.profile?.imageUrl
    || item.profile?.avatarUrl
    || item.author?.imageUrl
    || item.author?.avatarUrl
    || ""
  ).trim();
}

async function mintSession() {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: OWNER_EMAIL });
  if (error) throw error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: verifyError } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
  assert.ok(data?.session?.access_token, "Expected Supabase session");
  return data.session;
}

async function api(token, method = "GET", body = null) {
  const response = await fetch(`${BASE_URL}/api/website-builder/projects?projectId=${encodeURIComponent(PROJECT_ID)}&page=${encodeURIComponent(PAGE_NAME)}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, payload?.error || `HTTP ${response.status}`);
  return payload.project;
}

const session = await mintSession();
const token = session.access_token;
const project = await api(token);
const next = clone(project);
const blocks = Array.isArray(next.pageBlocks?.[PAGE_NAME]) ? next.pageBlocks[PAGE_NAME] : [];
let pricingBlockId = "";
let testimonialBlockId = "";
let testimonialImages = [];

next.pageBlocks = {
  ...(next.pageBlocks || {}),
  [PAGE_NAME]: blocks.map((block) => {
    if (block?.type === "pricing-table") {
      pricingBlockId = String(block.id || "");
      return { ...block, props: { ...(block.props || {}), showSavingsDisclosure: false } };
    }
    if (block?.type === "testimonial") {
      testimonialBlockId = String(block.id || "");
      const items = (Array.isArray(block.props?.items) ? block.props.items : []).map((item) => {
        const avatarUrl = canonicalAvatarUrl(item);
        return {
          ...item,
          avatarUrl,
          avatar: avatarUrl,
          imageUrl: avatarUrl,
          image: avatarUrl,
          photo: avatarUrl,
          src: avatarUrl,
        };
      });
      testimonialImages = items.map((item) => ({ id: item.id || "", author: item.author || "", avatarUrl: item.avatarUrl || "" }));
      return { ...block, props: { ...(block.props || {}), items } };
    }
    return block;
  }),
};
next.chaiData = {
  ...(next.chaiData || {}),
  [PAGE_NAME]: {
    ...(next.chaiData?.[PAGE_NAME] || {}),
    blocks: next.pageBlocks[PAGE_NAME],
  },
};
next.pagesContent = { ...(next.pagesContent || {}), [PAGE_NAME]: "" };
next.__saveBaseRevision = next.revision ?? next.saveRevision ?? "";
next.__saveBasePageRevision = next.pageRevisions?.[PAGE_NAME] ?? "";
next.__saveBaseUpdatedAt = next.updatedAt || next.savedAt || "";
next.__saveRequestId = `repair-pricing-testimonials-${Date.now()}`;

const saved = await api(token, "POST", {
  project: next,
  projectId: PROJECT_ID,
  pageName: PAGE_NAME,
  siteOnly: false,
  saveSource: "manual-save",
  baseRevision: next.__saveBaseRevision,
  basePageRevision: next.__saveBasePageRevision,
  baseUpdatedAt: next.__saveBaseUpdatedAt,
  requestId: next.__saveRequestId,
});

const savedPricing = saved.pageBlocks?.[PAGE_NAME]?.find((block) => block?.type === "pricing-table");
const savedTestimonial = saved.pageBlocks?.[PAGE_NAME]?.find((block) => block?.type === "testimonial");
assert.equal(savedPricing?.props?.showSavingsDisclosure, false, "Pricing disclosure flag was not persisted false");
for (const item of savedTestimonial?.props?.items || []) {
  assert.equal(item.avatarUrl || "", item.avatar || "", `Avatar alias mismatch for ${item.id || item.author || "testimonial"}`);
}

console.log(JSON.stringify({
  ok: true,
  baseUrl: BASE_URL,
  projectId: PROJECT_ID,
  pageName: PAGE_NAME,
  revision: saved.revision ?? saved.saveRevision ?? null,
  pricingBlockId,
  testimonialBlockId,
  showSavingsDisclosure: savedPricing?.props?.showSavingsDisclosure,
  canonicalImageField: "avatarUrl",
  testimonialImages,
}, null, 2));
