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
const initializedUsers = new Set();
const initializingUsers = new Map();

export async function ensureUserFolders(userId = "") {
  const id = String(userId || "").trim();
  if (!id || initializedUsers.has(id)) return;
  const existing = initializingUsers.get(id);
  if (existing) return existing;
  const task = (async () => {
    try {

    // 1️⃣ Check bucket exists
    const { data: buckets, error: bucketErr } =
      await supabase.storage.listBuckets();

    if (bucketErr || !Array.isArray(buckets)) return;

    const bucketExists = buckets.some((b) => b.name === BUCKET);
    if (!bucketExists) return;

    const basePath = `${id}/`;
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
    initializedUsers.add(id);
  } catch {
    // ABSOLUTELY NEVER throw from here
    }
  })().finally(() => initializingUsers.delete(id));
  initializingUsers.set(id, task);
  return task;
}
