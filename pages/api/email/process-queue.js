// /pages/api/email/process-queue.js
// FULL REPLACEMENT — Alias route → campaign queue processor
// ✅ If anything calls /api/email/process-queue, it will still work

export { default } from "./process-campaign-queue";

