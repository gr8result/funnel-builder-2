import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as catalogue from '../index.js';
import { SERVICE_PAGE_THEMES } from '../data/themes/index.js';
import {
  SERVICE_IMAGE_TERMS_BY_SLUG,
  SERVICE_IMAGE_POOLS,
  SERVICE_IMAGE_GROUP_BY_SLUG,
} from '../data/serviceImages.js';
import { captureCatalogue } from './captureCatalogue.mjs';

const baseline = JSON.parse(fs.readFileSync(
  new URL('./fixtures/catalogue-baseline.json', import.meta.url), 'utf8',
));
const current = captureCatalogue(catalogue, SERVICE_PAGE_THEMES, {
  SERVICE_IMAGE_TERMS_BY_SLUG, SERVICE_IMAGE_POOLS, SERVICE_IMAGE_GROUP_BY_SLUG,
});

test('preserves public exports and all catalogue counts', () => {
  assert.deepEqual(current.exports, baseline.exports);
  assert.deepEqual(current.counts, baseline.counts);
});

test('preserves every theme field, unique slug, and original theme order', () => {
  const slugs = SERVICE_PAGE_THEMES.map((theme) => theme.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.deepEqual(slugs, Object.keys(baseline.themes));
  assert.deepEqual(current.themes, baseline.themes);
});

test('preserves every section block, its metadata, order, and generated HTML', () => {
  const ids = catalogue.SECTION_BLOCKS.map((block) => block.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, Object.keys(baseline.blocks));
  assert.deepEqual(current.blocks, baseline.blocks);
});

test('preserves ordered funnel definitions and every selection mapping', () => {
  assert.equal(new Set(current.funnelIds).size, current.funnelIds.length);
  assert.deepEqual(current.funnelIds, baseline.funnelIds);
  assert.equal(current.funnelDefinitions, baseline.funnelDefinitions);
});

test('preserves the generated HTML for every funnel page', () => {
  assert.deepEqual(current.pages, baseline.pages);
});

test('preserves direct section rendering and assembly edge cases', () => {
  assert.deepEqual(current.directSections, baseline.directSections);
  assert.equal(current.emptyPage, baseline.emptyPage);
  assert.equal(current.unknownSections, baseline.unknownSections);
});

test('preserves all image catalogue data, asset references, and fallback cases', () => {
  assert.equal(current.imageData, baseline.imageData);
  assert.equal(current.assets, baseline.assets);
  assert.equal(current.fallbackResults, baseline.fallbackResults);
});

