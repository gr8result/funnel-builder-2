import { SECTION_BLOCKS } from './catalogue.js';


// ─────────────────────────────────────────────
// HELPER: build full page HTML from section IDs
// ─────────────────────────────────────────────
export const sectionMap = Object.fromEntries(SECTION_BLOCKS.map(b => [b.id, b.html]));


export function enforceReadableTypography(html) {
  return `${html || ''}`
    .replace(/font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px/gi, (_match, value) => {
      const nextValue = Math.max(16, Number(value) || 0);
      return `font-size:${nextValue}px`;
    })
    .replace(/font-weight\s*:\s*([0-9]+)/gi, (_match, value) => {
      const nextValue = Math.min(600, Number(value) || 0);
      return `font-weight:${nextValue}`;
    });
}


export function assemblePage(sectionIds) {
  return enforceReadableTypography(
    sectionIds.map(id => sectionMap[id] ? sectionMap[id]() : '').join('\n')
  );
}
