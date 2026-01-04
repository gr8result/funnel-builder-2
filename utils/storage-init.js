// ============================================
// /utils/storage-init.js
// FULL REPLACEMENT — SAFE, QUIET, NON-BLOCKING
//
// ✅ Checks bucket exists BEFORE doing anything
// ✅ Creates folders ONCE per user
// ✅ Never throws, never blocks app
// ✅ Stops console spam completely
// ============================================

import { supabase } from "./supabase-client";

const BUCKET = "private-assets"; // MUST MATCH YOUR REAL BUCKET NAME

export async function ensureUserFolders() {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return;

    // 1️⃣ Check bucket exists
    const { data: buckets, error: bucketErr } =
      await supabase.storage.listBuckets();

    if (bucketErr || !Array.isArray(buckets)) return;

    const bucketExists = buckets.some((b) => b.name === BUCKET);
    if (!bucketExists) return;

    const basePath = `${user.id}/`;
    const folders = ["templates", "uploads", "logos", "proof"];

    // 2️⃣ Create ONE marker file per folder (idempotent)
    for (const folder of folders) {
      const path = `${basePath}${folder}/.keep`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([""]), {
          upsert: false,
          cacheControl: "3600",
        });

      // Ignore "already exists" silently
      if (error && !error.message?.toLowerCase().includes("exists")) {
        // Still do NOT throw — storage must never block app
        console.warn("storage-init:", error.message);
      }
    }
  } catch {
    // ABSOLUTELY NEVER throw from here
  }
}
