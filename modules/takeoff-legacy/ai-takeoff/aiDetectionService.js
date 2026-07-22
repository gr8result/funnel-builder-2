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
