// Takeoff Engine V2 — data model.
// One authoritative rotation field only: PlanPage.rotation. Never add a second
// rotation-like field (userRotation/finalRotation/displayRotation/normalizedRotation) —
// that duplication is what made the legacy engine's rotation unreliable.

export const ROTATIONS = [0, 90, 180, 270];

export function isValidRotation(value) {
  return ROTATIONS.includes(value);
}

export function normalizeRotation(value) {
  const n = ((Number(value) || 0) % 360 + 360) % 360;
  return ROTATIONS.includes(n) ? n : 0;
}

export function rotateRight(rotation) {
  return normalizeRotation(normalizeRotation(rotation) + 90);
}

export function rotateLeft(rotation) {
  return normalizeRotation(normalizeRotation(rotation) + 270);
}

/**
 * @typedef {Object} PlanDocument
 * @property {string} id
 * @property {string} jobId
 * @property {string} fileName
 * @property {string} originalFileUrl   data URL of the uploaded PDF bytes
 * @property {string} createdAt         ISO timestamp
 */

export function createPlanDocument({ id, jobId, fileName, originalFileUrl }) {
  return {
    id,
    jobId: jobId || "",
    fileName,
    originalFileUrl,
    createdAt: new Date().toISOString(),
  };
}

/**
 * @typedef {Object} PlanPage
 * @property {string} id
 * @property {string} documentId
 * @property {number} pageNumber
 * @property {number} sourceWidth        unrotated PDF page width in PDF points
 * @property {number} sourceHeight       unrotated PDF page height in PDF points
 * @property {0|90|180|270} rotation     the ONLY authoritative rotation value
 * @property {boolean} orientationConfirmed
 * @property {Object|null} calibration   null until Phase 9 (scale calibration)
 * @property {number|null} detectedRotationSuggestion  null until Phase 11; a suggestion only, never auto-applied
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export function createPlanPage({ id, documentId, pageNumber, sourceWidth, sourceHeight }) {
  const now = new Date().toISOString();
  return {
    id,
    documentId,
    pageNumber,
    sourceWidth,
    sourceHeight,
    rotation: 0,
    orientationConfirmed: false,
    calibration: null,
    detectedRotationSuggestion: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
