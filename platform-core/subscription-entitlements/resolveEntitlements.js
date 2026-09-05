// Pure entitlement resolution. No I/O, no database, no request object.
//
// Given what a workspace holds — a plan's modules, add-on rows, bundle codes and
// any legacy module ids — produce the full set of entitlement codes it may use.
//
// Resolution order:
//   1. Normalise every input code (legacy aliases -> canonical codes).
//   2. Expand bundle codes into their member modules.
//   3. Apply grants to a fixpoint, so a granted code may itself grant others.
//
// SAFETY PROPERTY: resolution only ever ADDS. Every input code that is not a
// bundle survives into the output untouched, so wiring this in front of the
// existing entitlement logic can never take access away from a paying customer.
// scripts/test-entitlement-resolver.mjs asserts this directly.

import { DASHBOARD_MODULE_ALIASES } from "../../lib/moduleEntitlements.js";
import { BUNDLES, GRANTS, isBundleCode } from "./moduleCatalog.js";

// Guard against a malformed GRANTS cycle rather than looping forever.
const MAX_GRANT_PASSES = 16;

/**
 * Map a legacy or user-supplied module id onto its canonical entitlement code.
 * Unknown codes pass through unchanged — an unrecognised code must never be
 * silently dropped, or a customer loses access the moment a new code appears.
 */
export function normaliseCode(code) {
  const raw = String(code ?? "").trim();
  if (!raw) return "";
  return DASHBOARD_MODULE_ALIASES[raw] || raw;
}

/** Normalise a list of codes, dropping blanks and de-duplicating. */
export function normaliseCodes(codes = []) {
  const out = new Set();
  for (const code of Array.isArray(codes) ? codes : []) {
    const normalised = normaliseCode(code);
    if (normalised) out.add(normalised);
  }
  return out;
}

/**
 * Replace bundle codes with their members. The bundle code itself is retained,
 * so callers can still tell which bundle produced the access.
 */
export function expandBundles(codes) {
  const out = new Set(codes);
  for (const code of codes) {
    if (!isBundleCode(code)) continue;
    for (const member of BUNDLES[code]) out.add(member);
  }
  return out;
}

/** Apply GRANTS repeatedly until no new code appears (transitive closure). */
export function applyGrants(codes) {
  const out = new Set(codes);
  for (let pass = 0; pass < MAX_GRANT_PASSES; pass += 1) {
    let added = false;
    for (const code of Array.from(out)) {
      const granted = GRANTS[code];
      if (!granted) continue;
      for (const target of granted) {
        if (!out.has(target)) {
          out.add(target);
          added = true;
        }
      }
    }
    if (!added) return out;
  }
  return out;
}

/**
 * Resolve the complete entitlement set for a workspace.
 *
 * @param {object}   input
 * @param {string[]} input.planModules   modules included by the base plan
 * @param {string[]} input.addOns        separately purchased module codes
 * @param {string[]} input.bundles       purchased bundle codes
 * @param {string[]} input.legacyModuleIds  ids from the existing entitlement rows
 * @returns {{ modules: Set<string>, has: (code: string) => boolean }}
 */
export function resolveEntitlements({
  planModules = [],
  addOns = [],
  bundles = [],
  legacyModuleIds = [],
} = {}) {
  const seed = new Set([
    ...normaliseCodes(planModules),
    ...normaliseCodes(addOns),
    ...normaliseCodes(bundles),
    ...normaliseCodes(legacyModuleIds),
  ]);

  const modules = applyGrants(expandBundles(seed));

  return {
    modules,
    has: (code) => modules.has(normaliseCode(code)),
  };
}

/**
 * Convenience predicate for a single code.
 * @returns {boolean}
 */
export function hasModuleAccess(input, code) {
  return resolveEntitlements(input).has(code);
}
