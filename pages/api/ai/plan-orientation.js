// /pages/api/ai/plan-orientation.js
// Uses AI vision to decide whether a floor plan image needs rotation.

import { withAuth } from "../../../lib/withWorkspace";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "30mb",
    },
  },
};

const SYSTEM = `You are a professional architectural plan reviewer.
Your only task is to decide the rotation needed to make a floor plan readable.
Return ONLY valid JSON.`;

const PROMPT = `Look at this rendered floor plan image and decide how it must be rotated so the title block, dimensions, room labels, notes, and normal text are upright and readable by a person.

This image may have PDF metadata rotation of 0 even when the rendered plan is visually upside down. Ignore metadata and judge the rendered pixels only.

Use readable text, room labels, dimensions, title blocks, north points, and sheet notes where visible. Pay special attention to the title block because it is often the clearest orientation signal.

If the text/title block is upside down, return 180.
If the text/title block is sideways clockwise, return 270 because the image must rotate counter-clockwise to become upright.
If the text/title block is sideways counter-clockwise, return 90 because the image must rotate clockwise to become upright.

Return ONLY this JSON:
{
  "rotationDegrees": 0,
  "confidence": 0.0,
  "reason": "short reason"
}

rotationDegrees must be one of:
- 0 if it is already upright
- 90 if the image must rotate 90 degrees clockwise
- 180 if it is upside down
- 270 if the image must rotate 90 degrees counter-clockwise

If unsure, return 0 with low confidence. Do not return 0 when most readable text is clearly upside down.`;

const CANDIDATE_PROMPT = `You are comparing four rendered versions of the same building plan page.
Each image has already been rotated by the candidate rotation shown before it: 0, 90, 180, or 270 degrees.

Choose which candidate image is most upright and readable.

Score each candidate using:
- most readable horizontal text
- highest apparent OCR/readability confidence
- title block and sheet text upright
- number of readable words
- number of horizontal/upright words
- text angle penalty for sideways, vertical, inverted, or mostly unreadable text
- presence/readability of words such as FLOOR PLAN, GROUND FLOOR, FIRST FLOOR, ELEVATION, SECTION, NOTES, SCALE, AREA, GARAGE, BED, BATH, KITCHEN, LIVING, PROPOSED DWELLING

Return ONLY this JSON:
{
  "detectedRotationDegrees": 0,
  "confidence": 0.0,
  "reason": "short reason",
  "scores": [
    { "rotationDegrees": 0, "wordCount": 0, "horizontalWordCount": 0, "confidence": 0.0, "keywordHits": 0, "textAnglePenalty": 0, "score": 0, "readableText": "short note" },
    { "rotationDegrees": 90, "wordCount": 0, "horizontalWordCount": 0, "confidence": 0.0, "keywordHits": 0, "textAnglePenalty": 0, "score": 0, "readableText": "short note" },
    { "rotationDegrees": 180, "wordCount": 0, "horizontalWordCount": 0, "confidence": 0.0, "keywordHits": 0, "textAnglePenalty": 0, "score": 0, "readableText": "short note" },
    { "rotationDegrees": 270, "wordCount": 0, "horizontalWordCount": 0, "confidence": 0.0, "keywordHits": 0, "textAnglePenalty": 0, "score": 0, "readableText": "short note" }
  ]
}

Use this scoring logic:
score = (confidence * 100) + wordCount + (horizontalWordCount * 2) + (keywordHits * 20) - textAnglePenalty

detectedRotationDegrees must be the candidate rotation with the highest score. Do not choose 0 unless the 0-degree candidate has the highest score.`;

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageDataUrl, candidates } = req.body || {};
  const candidateImages = Array.isArray(candidates) ? candidates.filter((candidate) => candidate?.imageDataUrl) : [];
  if (!imageDataUrl && !candidateImages.length) return res.status(400).json({ error: "imageDataUrl or candidates required" });

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(200).json({
      connected: false,
      rotationDegrees: 0,
      confidence: 0,
      message: "AI orientation service is not connected yet. (OPENAI_API_KEY not configured.)",
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              ...(candidateImages.length
                ? candidateImages.flatMap((candidate) => ([
                    { type: "text", text: `Candidate rotation ${normalizeRotation(candidate.rotationDegrees)} degrees` },
                    { type: "image_url", image_url: { url: candidate.imageDataUrl, detail: "high" } },
                  ]))
                : [{ type: "image_url", image_url: { url: imageDataUrl, detail: "high" } }]),
              { type: "text", text: candidateImages.length ? CANDIDATE_PROMPT : PROMPT },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(200).json({
        connected: false,
        rotationDegrees: 0,
        confidence: 0,
        message: `AI orientation error ${response.status}: ${text.slice(0, 300)}`,
      });
    }

    const json = await response.json();
    const rawText = json?.choices?.[0]?.message?.content?.trim() || "";
    const clean = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(200).json({
        connected: true,
        rotationDegrees: 0,
        confidence: 0,
        message: `AI orientation returned unparseable response: ${rawText.slice(0, 200)}`,
      });
    }

    const scores = normalizeScores(parsed.scores);
    const bestScore = chooseBestScore(scores);
    const detectedRotationDegrees = candidateImages.length && bestScore
      ? bestScore.rotationDegrees
      : normalizeRotation(parsed.detectedRotationDegrees ?? parsed.rotationDegrees);
    return res.status(200).json({
      connected: true,
      rotationDegrees: detectedRotationDegrees,
      detectedRotationDegrees,
      confidence: Number(bestScore?.confidence ?? parsed.confidence ?? 0),
      reason: parsed.reason || "",
      scores,
      message: parsed.reason ? `Orientation checked: ${parsed.reason}` : "Orientation checked.",
    });
  } catch (error) {
    return res.status(500).json({
      connected: false,
      rotationDegrees: 0,
      confidence: 0,
      message: `Server error: ${error.message}`,
    });
  }
}

function normalizeRotation(value) {
  const degrees = Number(value) || 0;
  const normalized = ((degrees % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

function normalizeScores(scores) {
  if (!Array.isArray(scores)) return [];
  return scores.map((score) => ({
    rotationDegrees: normalizeRotation(score?.rotationDegrees),
    wordCount: Number(score?.wordCount || 0),
    horizontalWordCount: Number(score?.horizontalWordCount || 0),
    confidence: Number(score?.confidence || 0),
    keywordHits: Number(score?.keywordHits || 0),
    textAnglePenalty: Number(score?.textAnglePenalty || 0),
    score: Number(score?.score || 0) || calculateScore(score),
    readableText: String(score?.readableText || "").slice(0, 160),
  }));
}

function calculateScore(score = {}) {
  return (Number(score.confidence || 0) * 100)
    + Number(score.wordCount || 0)
    + (Number(score.horizontalWordCount || 0) * 2)
    + (Number(score.keywordHits || 0) * 20)
    - Number(score.textAnglePenalty || 0);
}

function chooseBestScore(scores = []) {
  if (!scores.length) return null;
  return [...scores].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.keywordHits !== a.keywordHits) return b.keywordHits - a.keywordHits;
    if (b.horizontalWordCount !== a.horizontalWordCount) return b.horizontalWordCount - a.horizontalWordCount;
    return b.confidence - a.confidence;
  })[0] || null;
}

export default withAuth(handler);
