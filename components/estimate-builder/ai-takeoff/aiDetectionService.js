// aiDetectionService.js
// Calls /api/ai/plan-detect (GPT-4o vision) for floor plan analysis.
// Returns { connected, overlays, rooms, confidence, message }.
// If the API call fails, returns connected:false with a clear message — no fake data.

export async function runDetection({ imageDataUrl, imageWidth, imageHeight }) {
  if (!imageDataUrl) {
    return { connected: false, overlays: [], rooms: [], confidence: 0, message: "No plan image available." };
  }

  try {
    const res = await fetch("/api/ai/plan-detect", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ imageDataUrl, imageWidth, imageHeight }),
    });

    if (!res.ok) {
      return { connected: false, overlays: [], rooms: [], confidence: 0, message: `API error ${res.status}` };
    }

    const data = await res.json();
    return {
      connected:  data.connected  ?? true,
      overlays:   data.overlays   || [],
      rooms:      data.rooms      || [],
      confidence: data.confidence || 0,
      message:    data.message    || "",
    };
  } catch (err) {
    return {
      connected:  false,
      overlays:   [],
      rooms:      [],
      confidence: 0,
      message:    "AI detection service is not connected yet.",
    };
  }
}

export async function runOrientationDetection({ imageDataUrl, imageWidth, imageHeight }) {
  if (!imageDataUrl) {
    return { connected: false, rotationDegrees: 0, confidence: 0, message: "No plan image available." };
  }

  try {
    const res = await fetch("/api/ai/plan-orientation", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ imageDataUrl, imageWidth, imageHeight }),
    });

    if (!res.ok) {
      return { connected: false, rotationDegrees: 0, confidence: 0, message: `API error ${res.status}` };
    }

    const data = await res.json();
    return {
      connected:       data.connected ?? true,
      rotationDegrees: normalizeOrientationDegrees(data.rotationDegrees),
      confidence:      Number(data.confidence || 0),
      reason:          data.reason || "",
      message:         data.message || "",
    };
  } catch {
    return {
      connected: false,
      rotationDegrees: 0,
      confidence: 0,
      message: "AI orientation service is not connected yet.",
    };
  }
}

export async function runOrientationCandidateScoring({ candidates = [] }) {
  const safeCandidates = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.imageDataUrl)
    .map((candidate) => ({
      rotationDegrees: normalizeOrientationDegrees(candidate.rotationDegrees),
      imageDataUrl: candidate.imageDataUrl,
      imageWidth: candidate.imageWidth || 0,
      imageHeight: candidate.imageHeight || 0,
    }));

  if (!safeCandidates.length) {
    return { connected: false, detectedRotationDegrees: 0, confidence: 0, scores: [], message: "No plan image candidates available." };
  }

  try {
    const res = await fetch("/api/ai/plan-orientation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: safeCandidates }),
    });

    if (!res.ok) {
      return { connected: false, detectedRotationDegrees: 0, confidence: 0, scores: [], message: `API error ${res.status}` };
    }

    const data = await res.json();
    return {
      connected: data.connected ?? true,
      detectedRotationDegrees: normalizeOrientationDegrees(data.detectedRotationDegrees ?? data.rotationDegrees),
      confidence: Number(data.confidence || 0),
      scores: Array.isArray(data.scores) ? data.scores.map((score) => ({
        rotationDegrees: normalizeOrientationDegrees(score?.rotationDegrees),
        wordCount: Number(score?.wordCount || 0),
        horizontalWordCount: Number(score?.horizontalWordCount || 0),
        confidence: Number(score?.confidence || 0),
        keywordHits: Number(score?.keywordHits || 0),
        textAnglePenalty: Number(score?.textAnglePenalty || 0),
        score: Number(score?.score || 0),
        readableText: score?.readableText || "",
      })) : [],
      reason: data.reason || "",
      message: data.message || "",
    };
  } catch {
    return {
      connected: false,
      detectedRotationDegrees: 0,
      confidence: 0,
      scores: [],
      message: "AI orientation scoring service is not connected yet.",
    };
  }
}

function normalizeOrientationDegrees(value) {
  const degrees = Number(value) || 0;
  const normalized = ((degrees % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}
