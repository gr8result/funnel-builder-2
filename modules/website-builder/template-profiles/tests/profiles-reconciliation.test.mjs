import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { WEBSITE_TEMPLATE_PROFILES } from '../index.js';

// Captured from the complete pre-decomposition export of lib/website-builder/templateProfiles.js.
// The digest includes every field and image reference, as well as object/array ordering.
const originalDatasetSha256 = '69fe454c8cfd1637c098e0be67c1f85823b68879fce9dc7175a27901611e9e85';
const originalProfileKeys = [
  "website-generic-premium",
  "website-business-agency",
  "website-coach-personal-brand",
  "website-local-service",
  "website-saas-simple",
  "website-restaurant-cafe",
  "website-portfolio-creative",
  "website-medical-clinic",
  "website-law-firm",
  "website-real-estate",
  "website-salon-spa",
  "website-fitness-gym",
  "website-home-renovation",
  "website-accounting-bookkeeping",
  "website-plumbing-company",
  "website-electrician-company",
  "website-hvac-air-conditioning",
  "website-roofing-company",
  "website-cleaning-services",
  "website-landscaping-lawn-care",
  "website-pest-control",
  "website-solar-energy",
  "website-pool-service",
  "website-auto-repair",
  "website-painting-decorating",
  "website-concreting-company",
  "website-fencing-gates",
  "website-flooring-tiling",
  "website-garage-door-services",
  "website-glass-glazing",
  "website-mortgage-broker",
  "website-ecommerce-store"
];

test('profile manifest preserves all 32 original keys in order without duplicates', () => {
  assert.deepEqual(Object.keys(WEBSITE_TEMPLATE_PROFILES), originalProfileKeys);
  assert.equal(new Set(originalProfileKeys).size, 32);
});

test('decomposed profiles preserve the complete original dataset', () => {
  const actual = createHash('sha256').update(JSON.stringify(WEBSITE_TEMPLATE_PROFILES)).digest('hex');
  assert.equal(actual, originalDatasetSha256);
});
