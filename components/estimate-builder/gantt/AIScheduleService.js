// AIScheduleService.js
// Extracts job data from the workbook, sends to the AI API,
// returns a structured schedule as Task[].

import { createTask, CONFIDENCE } from "./ganttTypes";

// ── Extract a readable summary from the workbook ──────────────────────────────

export function extractJobSummary(workbook) {
  const data      = workbook?.data      || {};
  const quotation = workbook?.quotation || {};
  const windowsDoors = workbook?.windowsDoors || [];
  const procurement  = workbook?.procurement?.items || [];

  // Site information
  const siteInfo = {};
  const siteSection = data?.siteInformation?.rows || {};
  for (const [key, row] of Object.entries(siteSection)) {
    if (row?.value != null) siteInfo[key] = row.value;
  }

  // Floor counts
  const floorSection = data?.floorCounts?.rows || {};
  const floors = {};
  for (const [k, row] of Object.entries(floorSection)) {
    if (row?.value != null) floors[k] = row.value;
  }

  // Roof info
  const roofSection = data?.roofInformation?.rows || {};
  const roof = {};
  for (const [k, row] of Object.entries(roofSection)) {
    if (row?.value != null) roof[k] = row.value;
  }

  // Extract quote sections that are active (non-zero cost)
  const activeQuoteSections = [];
  for (const [sectionKey, section] of Object.entries(quotation)) {
    if (!section?.rows?.length) continue;
    const hasValue = section.rows.some(r => Number(r.cost || r.qty || 0) > 0);
    if (hasValue) {
      activeQuoteSections.push({
        section:  section.displayName || sectionKey,
        rowCount: section.rows.length,
      });
    }
  }

  // Procurement items
  const procItems = procurement.slice(0, 30).map(p => ({
    item: p.item || p.description,
    trade: p.trade || p.supplier,
    stage: p.stage,
  }));

  // Windows and doors summary
  const windowCount = windowsDoors.filter(w => w.type === "window").length;
  const doorCount   = windowsDoors.filter(w => w.type === "door").length;

  return {
    projectName:     workbook?.openedFileName || "New Build",
    jobType:         siteInfo.jobType || siteInfo.project_type || "Residential New Build",
    constructionMethod: siteInfo.constructionMethod || "Timber Frame",
    levels:          floors.storeys || floors.levels || 1,
    totalFloorArea:  siteInfo.totalFloorArea || siteInfo.floor_area || null,
    site:            {
      address: siteInfo.address || siteInfo.site_address || null,
      slope:   siteInfo.slope || null,
      soil:    siteInfo.soilType || null,
    },
    roof:            { type: roof.type || roof.roofType || null, pitch: roof.pitch || null },
    windows:         windowCount,
    doors:           doorCount,
    activeQuoteSections,
    procurementItems: procItems,
    templateKey:     workbook?.templateKey || null,
  };
}

// ── Call the AI schedule API ──────────────────────────────────────────────────

export async function generateSchedule(workbook) {
  const summary = extractJobSummary(workbook);

  try {
    const res = await fetch("/api/ai/generate-schedule", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jobSummary: summary }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `API error ${res.status}: ${txt.slice(0, 200)}` };
    }

    const data = await res.json();

    if (!data.ok) {
      return { ok: false, error: data.error || "AI generation failed." };
    }

    // Normalise returned tasks into our Task shape
    const tasks = (data.tasks || []).map(raw => createTask({
      id:              raw.id || undefined,
      stage:           raw.stage || "",
      task:            raw.task || raw.name || "",
      trade:           raw.trade || raw.supplier || "",
      durationDays:    Number(raw.durationDays || raw.duration || 5),
      dependsOn:       Array.isArray(raw.dependsOn) ? raw.dependsOn : [],
      startOffsetDays: Number(raw.startOffsetDays || 0),
      requiredOrderDate: raw.requiredOrderDate || null,
      notes:           raw.notes || "",
      included:        raw.included !== false,
      isProcurement:   !!raw.isProcurement,
      procurementType: raw.procurementType || "",
      confidence:      raw.confidence || CONFIDENCE.MEDIUM,
      source:          "ai",
    }));

    return { ok: true, tasks, projectName: data.projectName || summary.projectName, estimatedWeeks: data.estimatedWeeks };

  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}` };
  }
}
