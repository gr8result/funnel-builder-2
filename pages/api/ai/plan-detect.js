// /pages/api/ai/plan-detect.js
// GPT-4o vision endpoint for floor plan analysis.
// Returns: externalWalls, internalWalls, rooms, doors, windows — all with confidence.

import { withAuth } from "../../../lib/withWorkspace";

const SYSTEM = `You are a professional architectural floor plan analyst.
You extract precise structural information from floor plan images.
Return ONLY valid JSON — no markdown, no code fences, no explanation.`;

const PROMPT = `Analyse this floor plan image carefully.

Return ONLY this JSON:
{
  "confidence": 0.0,
  "externalWalls": [
    { "points": [[x1pct,y1pct],[x2pct,y2pct],...], "confidence": "high" }
  ],
  "internalWalls": [
    { "points": [[x1pct,y1pct],[x2pct,y2pct]], "confidence": "medium" }
  ],
  "rooms": [
    {
      "name": "Kitchen",
      "xPct": 45.2,
      "yPct": 30.1,
      "confidence": "high",
      "polygon": [[x1pct,y1pct],[x2pct,y2pct],...]
    }
  ],
  "doors": [ { "xPct": 20.0, "yPct": 40.0, "confidence": "medium" } ],
  "windows": [ { "xPct": 30.0, "yPct": 50.0, "confidence": "low" } ]
}

Rules:

COORDINATES: All coordinates are percentages (0-100) of image width (x) and height (y), from top-left.

CONFIDENCE LEVELS:
  "high"   = clearly visible, unambiguous
  "medium" = likely correct but partially obscured or uncertain
  "low"    = estimated or inferred from context

EXTERNAL WALLS:
  Trace the outer building perimeter as one or more polylines.
  Each polyline is an array of corner points [x,y] following the outermost wall face.
  Prefer the outer edge of thick boundary walls.
  Mark confidence "high" if perimeter is clearly visible.

INTERNAL WALLS:
  Each internal wall is an INDEPENDENT segment: exactly 2 points (start and end).
  Do NOT chain internal walls into long polylines.
  One object per wall segment.
  Include load-bearing walls and partition walls.

ROOMS:
  Include all labelled spaces you can read:
  Bedroom, Master Bedroom, Bed 1/2/3/4,
  Kitchen, Living Room, Living, Dining, Dining Room, Family Room,
  Bathroom, Ensuite, WC, Toilet, Laundry, Powder Room,
  Garage, Carport, Entry, Foyer, Hall, Hallway, Corridor,
  Robe, WIR (Walk-in Robe), Pantry, Study, Office, Library,
  Alfresco, Verandah, Porch, Deck, Balcony, Terrace,
  Store, Linen, Void, Stair.

  "xPct" and "yPct" are the approximate centre of the room label text.
  "polygon" is optional — only include if you can clearly trace the room boundary.
  If uncertain about the boundary, omit "polygon" entirely.

DOORS:
  Detect visible door symbols (arc + line or rectangular opening).
  One object per door.

WINDOWS:
  Detect visible window symbols (parallel lines in a wall opening).
  One object per window.

OVERALL CONFIDENCE:
  Set top-level "confidence" to your average certainty (0.0–1.0) across the whole plan.

If this image is NOT a floor plan, return:
{ "confidence": 0, "externalWalls": [], "internalWalls": [], "rooms": [], "doors": [], "windows": [] }`;

// Dev-only, stage-by-stage logging — never logs keys, tokens, full auth
// headers, or document contents, only which stage was reached and whether it
// succeeded. Distinguishing these stages is exactly what "AI detection API
// error 401" used to collapse into one message.
function logStage(message) {
  if (process.env.NODE_ENV !== "production") console.log(`[plan-detect] ${message}`);
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // withAuth (see lib/withWorkspace.js) already rejected the request before
  // this handler ever runs if the user session didn't resolve — reaching
  // this line means req.user is populated.
  logStage("Takeoff detection request received");
  logStage(`User session resolved: yes (user ${req.user?.id ? "present" : "MISSING — should not happen past withAuth"})`);

  const { imageDataUrl, imageWidth, imageHeight } = req.body || {};
  if (!imageDataUrl) return res.status(400).json({ error: "imageDataUrl required", code: "BAD_REQUEST" });
  logStage(`Plan image received: yes (${imageWidth || "?"}x${imageHeight || "?"})`);

  const key = process.env.OPENAI_API_KEY;
  logStage(`Provider configured: ${key ? "yes" : "no"}`);
  if (!key) {
    return res.status(200).json({
      connected:  false,
      overlays:   [],
      rooms:      [],
      confidence: 0,
      code:       "PROVIDER_NOT_CONFIGURED",
      message:    "Automatic detection is not configured on this environment.",
    });
  }

  try {
    logStage("Provider request started");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model:       "gpt-4o",
        max_tokens:  8192,
        temperature: 0.05,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
              { type: "text",      text: PROMPT },
            ],
          },
        ],
      }),
    });
    logStage(`Provider response status: ${response.status}`);

    if (response.status === 401 || response.status === 403) {
      // The application's own auth already passed (withAuth) — this 401/403
      // is the *provider* (OpenAI) rejecting our server-side API key, e.g.
      // it's revoked/expired/wrong-project. Never conflate this with the
      // application's own USER_AUTH_REQUIRED case.
      console.error("[plan-detect] Provider authentication failed (key rejected by OpenAI) — check OPENAI_API_KEY.");
      return res.status(200).json({
        connected: false, overlays: [], rooms: [], confidence: 0,
        code: "PROVIDER_AUTH_FAILED",
        message: "The plan detection service rejected its server credentials.",
      });
    }

    if (!response.ok) {
      const txt = await response.text();
      return res.status(200).json({
        connected: false, overlays: [], rooms: [], confidence: 0,
        code: "PROVIDER_ERROR",
        message: `AI error ${response.status}: ${txt.slice(0, 300)}`,
      });
    }

    const json    = await response.json();
    const rawText = json?.choices?.[0]?.message?.content?.trim() || "";
    const clean   = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      return res.status(200).json({
        connected: true, overlays: [], rooms: [], confidence: 0,
        message: `AI returned unparseable response: ${rawText.slice(0, 200)}`,
      });
    }

    const W = Number(imageWidth)  || 1200;
    const H = Number(imageHeight) || 900;
    const pct = ([xp, yp]) => ({ x: Math.round((xp / 100) * W), y: Math.round((yp / 100) * H) });

    let seq = 0;
    function makeId(type) { return `ai-${type}-${Date.now()}-${++seq}`; }

    const overlays = [];

    // ── External walls (polylines) ─────────────────────────────────────────
    for (const seg of (parsed.externalWalls || [])) {
      const pts = (seg.points || []).map(pct);
      if (pts.length < 2) continue;
      overlays.push({
        id:         makeId("ew"),
        type:       "externalWall",
        points:     pts,
        label:      "External Wall",
        level:      "ground",
        status:     "suggested",
        confidence: seg.confidence || "medium",
        source:     "ai",
        wallType:   "",
        floorFinish:"",
        roomName:   "",
        notes:      "",
      });
    }

    // ── Internal walls (independent 2-point segments) ──────────────────────
    for (const seg of (parsed.internalWalls || [])) {
      const pts = (seg.points || []).map(pct);
      if (pts.length < 2) continue;
      // Clamp to exactly 2 points per segment
      overlays.push({
        id:         makeId("iw"),
        type:       "internalWall",
        points:     pts.slice(0, 2),
        label:      "Internal Wall",
        level:      "ground",
        status:     "suggested",
        confidence: seg.confidence || "medium",
        source:     "ai",
        wallType:   "",
        floorFinish:"",
        roomName:   "",
        notes:      "",
      });
    }

    // ── Doors ─────────────────────────────────────────────────────────────
    for (const d of (parsed.doors || [])) {
      overlays.push({
        id:         makeId("dr"),
        type:       "door",
        points:     [pct([d.xPct, d.yPct])],
        label:      "Door",
        level:      "ground",
        status:     "suggested",
        confidence: d.confidence || "medium",
        source:     "ai",
        wallType:   "", floorFinish: "", roomName: "", notes: "",
      });
    }

    // ── Windows ───────────────────────────────────────────────────────────
    for (const w of (parsed.windows || [])) {
      overlays.push({
        id:         makeId("wn"),
        type:       "window",
        points:     [pct([w.xPct, w.yPct])],
        label:      "Window",
        level:      "ground",
        status:     "suggested",
        confidence: w.confidence || "medium",
        source:     "ai",
        wallType:   "", floorFinish: "", roomName: "", notes: "",
      });
    }

    // ── Rooms (polygons where available) ──────────────────────────────────
    const roomOverlays = [];
    for (const r of (parsed.rooms || [])) {
      if (r.polygon && r.polygon.length >= 3) {
        const pts = r.polygon.map(pct);
        roomOverlays.push({
          id:         makeId("rm"),
          type:       "room",
          points:     pts,
          label:      r.name || "Room",
          level:      "ground",
          status:     "suggested",
          confidence: r.confidence || "medium",
          source:     "ai",
          wallType:   "",
          floorFinish:"",
          roomName:   r.name || "",
          notes:      "",
        });
      }
    }

    // ── Room analysis records (all rooms, with/without polygon) ───────────
    const rooms = (parsed.rooms || []).map((r, i) => ({
      id:           makeId("ra"),
      name:         r.name || "Unknown",
      xPct:         r.xPct,
      yPct:         r.yPct,
      xPx:          Math.round((r.xPct / 100) * W),
      yPx:          Math.round((r.yPct / 100) * H),
      confidence:   r.confidence || "medium",
      hasPolygon:   !!(r.polygon && r.polygon.length >= 3),
      polygonOverlayId: roomOverlays[i]?.id || null,
    }));

    const allOverlays = [...overlays, ...roomOverlays];
    const totalConf   = parsed.confidence || 0;
    const highCount   = allOverlays.filter(o => o.confidence === "high").length;
    const totalCount  = allOverlays.length;

    return res.status(200).json({
      connected:  true,
      code:       "OK",
      overlays:   allOverlays,
      rooms,
      confidence: totalConf,
      message:    `Detected ${totalCount} item${totalCount!==1?"s":""} (${highCount} high confidence). Confidence: ${Math.round(totalConf*100)}%.`,
    });

  } catch (err) {
    console.error("[plan-detect] Unhandled error:", err?.message || err);
    return res.status(500).json({
      connected: false, overlays: [], rooms: [], confidence: 0,
      code: "PROVIDER_ERROR",
      message:   `Server error: ${err.message}`,
    });
  }
}

export default withAuth(handler);
