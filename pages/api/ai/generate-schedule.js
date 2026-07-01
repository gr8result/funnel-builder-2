// /pages/api/ai/generate-schedule.js
// Generates a full construction schedule from job summary data using GPT-4o.

import { withAuth } from "../../../lib/withWorkspace";

const SYSTEM = `You are a senior construction project manager and scheduler based in Queensland, Australia.
You create detailed, realistic construction schedules for residential and commercial building projects.
You understand QLD-specific requirements: QBCC, building certifiers, engineering, Q-Leave, council approvals.
Return ONLY valid JSON — no markdown, no explanation, no code fences.`;

function buildPrompt(jobSummary) {
  return `Generate a complete construction schedule for this project:

${JSON.stringify(jobSummary, null, 2)}

Return this JSON structure:
{
  "projectName": "string",
  "estimatedWeeks": number,
  "tasks": [
    {
      "id": "t-001",
      "stage": "Stage name",
      "task": "Task description",
      "trade": "Trade or supplier name",
      "durationDays": 5,
      "dependsOn": ["t-id"],
      "startOffsetDays": 0,
      "requiredOrderDate": null,
      "notes": "Any important note",
      "included": true,
      "isProcurement": false,
      "procurementType": "",
      "confidence": "high"
    }
  ]
}

Rules:

STAGES (in order, include all relevant):
1. Preliminaries & Admin - QBCC, QLeave, insurances, contracts, bank drawdowns
2. Approvals & Engineering - DA, CDC, council approvals, engineer specs, certifier engagement
3. Site Setup - fencing, toilet, skip bin, electricity connection, driveway protection
4. Earthworks & Site Prep - clear, excavate, drainage, underground services
5. Slab / Base Stage - formwork, reo, plumbing under-slab, pour, cure
6. Frame Stage - timber/steel frames, bracing, tie-downs, frame inspection
7. Roof Stage - trusses (order early!), roof cover, fascia, guttering
8. Lock-Up Stage - external cladding, windows/doors, garage doors, external insulation
9. Fit-Out Rough-Ins - electrical rough-in, plumbing rough-in, AC ducts, data/comms
10. Waterproofing & Tiling - wet area waterproof, inspection, tiling
11. Linings & Plaster - internal insulation, plasterboard, stopping/set
12. Joinery & Cabinetry - kitchen, bathrooms, laundry (must order 8+ weeks ahead)
13. Fit-Off Trades - electrical fit-off, plumbing fit-off, AC install
14. Painting - prep, prime, coats, touch-up
15. Flooring - hard flooring, carpet (order 2-4 weeks ahead)
16. Appliances & Fixtures - oven, cooktop, rangehood, tapware, showerscreens
17. External Works - driveway, paths, landscaping, fencing, letterbox
18. Final Clean & Inspections - professional clean, practical completion inspection, certifier sign-off
19. Practical Completion
20. Handover

PROCUREMENT RULES:
- Roof trusses: isProcurement=true, need quote→approve→order→delivery chain (order 6+ weeks before install)
- Windows/doors: isProcurement=true, order 6-8 weeks before lock-up
- Kitchen/cabinetry: isProcurement=true, order 8-10 weeks before install
- Flooring: isProcurement=true, order 2-4 weeks before install
- Appliances: isProcurement=true, order 4-6 weeks before fit-off
- Steel frames: isProcurement=true, order with frames
- Inspections are hold points: procurementType="inspection"

DEPENDENCIES:
- Use task IDs in dependsOn arrays
- Slab requires earthworks complete
- Frame requires slab cured (7+ days)
- Roof requires frame inspection
- Lock-up requires roof
- Rough-ins require lock-up (for wet areas) or frame (for early rough-in)
- Plaster requires rough-in inspections
- Joinery requires plaster
- Fit-off requires joinery
- Paint after plaster and joinery
- Flooring after paint
- Final clean after all trades

DURATIONS:
- Use realistic work days for QLD residential construction
- Adjust for project size: ${jobSummary.totalFloorArea ? `${jobSummary.totalFloorArea}m²` : "unknown size"}
- Levels: ${jobSummary.levels || 1}
- Construction method: ${jobSummary.constructionMethod || "timber frame"}

CONFIDENCE:
- "high" = standard trade work, well-understood duration
- "medium" = duration depends on site conditions or scope
- "low" = regulatory/approval items with variable timelines

NOTES:
- Include QLD-specific items: QBCC insurance, QLeave levy, building certifier milestones
- Include hold points for: slab pre-pour inspection, frame inspection, waterproofing inspection, practical completion
- Include procurement chain tasks for long-lead items (mark isProcurement: true)
- requiredOrderDate: calculate as ISO date offset from project start if applicable
- Return 40-80 tasks for a complete residential build

startOffsetDays should be 0 for tasks with no predecessors.
For tasks with dependencies, set startOffsetDays to the expected start day (after predecessors finish).
`;
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { jobSummary } = req.body || {};
  if (!jobSummary) return res.status(400).json({ ok: false, error: "jobSummary required" });

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(200).json({
      ok:    false,
      error: "AI schedule generation is not connected yet. (OPENAI_API_KEY not configured.)",
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model:       "gpt-4o",
        max_tokens:  8192,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user",   content: buildPrompt(jobSummary) },
        ],
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      return res.status(200).json({ ok: false, error: `OpenAI error ${response.status}: ${txt.slice(0, 300)}` });
    }

    const json    = await response.json();
    const rawText = json?.choices?.[0]?.message?.content?.trim() || "";
    const clean   = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      return res.status(200).json({ ok: false, error: `Could not parse AI response: ${rawText.slice(0, 200)}` });
    }

    if (!Array.isArray(parsed.tasks) || !parsed.tasks.length) {
      return res.status(200).json({ ok: false, error: "AI returned no tasks. Try again or check the job data." });
    }

    // Assign sequential IDs if AI didn't provide them
    let seq = 0;
    const tasks = parsed.tasks.map(t => ({
      ...t,
      id: t.id || `t-${String(++seq).padStart(3, "0")}`,
    }));

    return res.status(200).json({
      ok:             true,
      projectName:    parsed.projectName || jobSummary.projectName || "New Build",
      estimatedWeeks: parsed.estimatedWeeks || Math.ceil(tasks.reduce((m, t) => Math.max(m, (t.startOffsetDays || 0) + (t.durationDays || 0)), 0) / 7),
      tasks,
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: `Server error: ${err.message}` });
  }
}

export default withAuth(handler);
