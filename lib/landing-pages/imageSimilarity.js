import sharp from 'sharp';

// 64-bit difference hash. Near-identical photographs (re-crops, re-encodes, same shot) differ by only a few bits.
export async function differenceHash(buffer) {
  const { data } = await sharp(buffer).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
  return bits;
}

export function hashDistance(a, b) {
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) distance += 1;
  return distance;
}

async function loadBuffer(src, baseUrl) {
  if (/^data:image\//i.test(src)) return Buffer.from(src.split(',')[1] || '', 'base64');
  const url = /^https?:\/\//i.test(src) ? src : new URL(src, baseUrl).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`image ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// Returns assignments with visually similar later images removed, plus the removed slots.
export async function dropSimilarAssignments(assignments, { baseUrl = 'http://localhost:3000', threshold = 8, load = loadBuffer } = {}) {
  const kept = [];
  const dropped = [];
  const hashes = [];
  for (const assignment of assignments) {
    let hash = null;
    try { hash = await differenceHash(await load(assignment.image.src, baseUrl)); } catch { hash = null; }
    const twin = hash ? hashes.find((entry) => hashDistance(entry.hash, hash) <= threshold) : null;
    if (twin) { dropped.push({ slotId: assignment.slot.id, similarTo: twin.slotId }); continue; }
    if (hash) hashes.push({ hash, slotId: assignment.slot.id });
    kept.push(assignment);
  }
  return { kept, dropped };
}
