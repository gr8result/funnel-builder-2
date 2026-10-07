const BASES = ['OBSERVED', 'DERIVED', 'ASSUMED'];

function evidenceRecord(value) {
  if (!value || !BASES.includes(value.basis) || !Number.isFinite(value.confidence)
    || value.confidence < 0 || value.confidence > 1 || typeof value.evidence !== 'string') {
    throw new Error('Analysis evidence requires a basis, confidence from 0 to 1, and evidence text.');
  }
  return { basis: value.basis, confidence: value.confidence, evidence: value.evidence.slice(0, 4000) };
}

// Preserve only the small, documented provenance payload in canonical objects.
export function validateAnalysisEvidence(value) {
  const result = evidenceRecord(value);
  if (value.fields !== undefined) {
    if (!value.fields || typeof value.fields !== 'object' || Array.isArray(value.fields)) throw new Error('Analysis evidence fields must be an object.');
    result.fields = Object.fromEntries(Object.entries(value.fields).slice(0, 30).map(([key, item]) => [key, evidenceRecord(item)]));
  }
  for (const key of ['originalTag', 'rawSizeCode']) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string') throw new Error(`Analysis ${key} must be text.`);
      result[key] = value[key].slice(0, 500);
    }
  }
  if (value.discrepancies !== undefined) {
    if (!Array.isArray(value.discrepancies) || value.discrepancies.some((item) => typeof item !== 'string')) throw new Error('Analysis discrepancies must be text entries.');
    result.discrepancies = value.discrepancies.slice(0, 30).map((item) => item.slice(0, 1000));
  }
  return result;
}
