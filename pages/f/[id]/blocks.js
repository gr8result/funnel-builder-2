// /pages/f/[id]/blocks.js
// FULL REPLACEMENT
//
// This is NOT a real page, but Next.js treats it as one.
// We provide a default export to satisfy Next, while keeping named exports.

import React from "react";

// ✅ default export so Next build passes
export default function BlocksPageShim() {
  return null;
}

// If you had exports here before, keep them.
// (Add your real block exports below as needed.)
export const BLOCKS = [];
