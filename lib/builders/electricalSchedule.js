// Client Selections > Electrical. A room-by-room QUANTITY schedule: how many of each electrical
// point every room of the house needs. Nothing here is a product - no brands, ranges, finishes or
// prices. Client Selections records room, point type, quantity and notes; the Quotation Builder
// owns the rate (its own electrical rate rows) and therefore the money.
//
// Rooms come from the one project room source (projectLocations.js), never from a list kept here.
// A room is linked by its stable project room id, so renaming it keeps its quantities and its
// quotation rows. Stored on the job in the "electrical-schedule" selection as `electricalSchedule`:
//   { version, rooms: [{ roomId, roomKey, room, points: { [pointKey]: qty }, custom: [{ id, label, quantity }],
//                        included: { [pointKey]: qty }, notes, status, confirmedAt }], updatedAt }
// Light fittings and ceiling fans are products and belong to Lighting & Ceiling Fans, not here.

import { plumbingLocationKey } from "./plumbingFixtureAllocation.js";

export const ELECTRICAL_SCHEDULE_REQUIREMENT_KEY = "electrical-schedule";
export const ELECTRICAL_SCHEDULE_SOURCE = "client-selections-electrical-schedule";
export const ELECTRICAL_SCHEDULE_SECTION = "ELECTRICAL - CLIENT SELECTIONS";
export const ELECTRICAL_SCHEDULE_VERSION = 1;
// confirmed: quantities confirmed for the room. standard: the room takes the standard inclusion
// (or needs no additional electrical changes). Both count as complete.
export const ELECTRICAL_ROOM_STATUS = { confirmed: "confirmed", standard: "standard", draft: "in_progress" };

const KITCHEN = /kitchen|pantry|scullery/i;
const LAUNDRY = /laundry/i;
const GARAGE = /garage|carport|workshop/i;
const OUTDOOR = /alfresco|patio|balcony|porch|deck|verandah|veranda|outdoor/i;

// group: how a room's summary counts the point ("6 powerpoints, 1 data point, 4 appliance points").
// rooms: where the point is offered without asking for it. quote: the Quotation Builder rate row
// this point is priced from, matched on the row's item text.
const point = (key, label, group, quote, extra = {}) => ({ key, label, group, quote, ...extra });
export const ELECTRICAL_POINT_TYPES = [
  point("double-gpo", "Double Powerpoints", "power", /^double (power ?point|gpo)s?$/i, { core: true }),
  point("single-gpo", "Single Powerpoints", "power", /^single (power ?point|gpo)s?$/i, { core: true }),
  point("usb-gpo", "USB Powerpoints", "power", /\busb\b/i),
  point("tv", "TV Point", "tv", /\b(tv|television) point/i, { core: true }),
  point("data", "Data Point", "data", /\b(data|network|cat ?6|rj45) point/i, { core: true }),
  point("phone", "Phone Point", "phone", /\b(tele)?phone point/i),
  point("appliance", "Dedicated Appliance Point", "appliance", /dedicated (appliance )?(point|circuit)|^20 ?amp circuit$/i, { rooms: [KITCHEN, LAUNDRY, GARAGE] }),
  point("fridge", "Fridge Point", "appliance", /\b(fridge|refrigerator)/i, { rooms: [KITCHEN] }),
  point("dishwasher", "Dishwasher Point", "appliance", /dishwasher/i, { rooms: [KITCHEN] }),
  point("microwave", "Microwave Point", "appliance", /microwave/i, { rooms: [KITCHEN] }),
  point("rangehood", "Rangehood Point", "appliance", /range ?hood/i, { rooms: [KITCHEN] }),
  point("oven", "Oven Point", "appliance", /^(wall )?oven$/i, { rooms: [KITCHEN] }),
  point("cooktop", "Cooktop Point", "appliance", /^(cooktop|hot ?plate)$/i, { rooms: [KITCHEN] }),
  point("washing-machine", "Washing Machine Point", "appliance", /washing machine|\bwasher\b/i, { rooms: [LAUNDRY] }),
  point("dryer", "Dryer Point", "appliance", /\bdryer\b/i, { rooms: [LAUNDRY] }),
  point("garage-door", "Garage Door Point", "appliance", /garage door/i, { rooms: [GARAGE] }),
  point("weatherproof-gpo", "Exterior Weatherproof GPO", "power", /weatherproof/i, { rooms: [OUTDOOR, GARAGE] }),
];
export const ELECTRICAL_POINT_BY_KEY = Object.fromEntries(ELECTRICAL_POINT_TYPES.map((item) => [item.key, item]));

const SUMMARY_GROUPS = [
  ["power", "powerpoint", "powerpoints"], ["data", "data point", "data points"], ["tv", "TV point", "TV points"],
  ["phone", "phone point", "phone points"], ["appliance", "appliance point", "appliance points"], ["custom", "other point", "other points"],
];

const quantity = (value) => Math.max(0, Math.min(99, Math.round(Number(value) || 0)));
const text = (value) => String(value ?? "").trim();

function cleanPoints(points = {}) {
  return Object.fromEntries(Object.entries(points || {})
    .filter(([key]) => ELECTRICAL_POINT_BY_KEY[key])
    .map(([key, value]) => [key, quantity(value)])
    .filter(([, value]) => value > 0));
}

function cleanCustom(custom = []) {
  return (Array.isArray(custom) ? custom : [])
    .map((item, index) => ({ id: text(item?.id) || `custom-${index + 1}`, label: text(item?.label), quantity: quantity(item?.quantity) }))
    .filter((item) => item.label);
}

// ---- Standard Inclusions baseline -------------------------------------------------------------
// An allowance counts as a room baseline only when the builder's Standard Inclusions say which
// rooms it applies to: either structured (`electricalAllowances: [{ room, point, quantity }]`) or
// an Electrical bullet such as "3 x double powerpoints per bedroom" / "Kitchen: 6 double power
// points". A bullet with no room ("Power point allowance") is shown as text and never guessed
// into rooms.
const POINT_ALIASES = [
  ["weatherproof-gpo", /weather ?proof/i], ["usb-gpo", /\busb\b/i], ["double-gpo", /double (power ?points?|gpos?)|\bdgpos?\b/i],
  ["single-gpo", /single (power ?points?|gpos?)/i], ["tv", /\b(tv|television) points?/i], ["data", /\b(data|network) points?/i],
  ["phone", /\b(tele)?phone points?/i], ["fridge", /fridge point/i], ["dishwasher", /dishwasher point/i], ["microwave", /microwave point/i],
  ["rangehood", /range ?hood point/i], ["oven", /oven point/i], ["cooktop", /(cooktop|hot ?plate) point/i],
  ["washing-machine", /washing machine point/i], ["dryer", /dryer point/i], ["garage-door", /garage door point/i],
  ["appliance", /dedicated (appliance )?(points?|circuits?)/i],
];
const pointKeyFromText = (value = "") => ELECTRICAL_POINT_BY_KEY[value] ? value : POINT_ALIASES.find(([, pattern]) => pattern.test(value))?.[0] || "";

function roomsForScope(scope = "", roomNames = []) {
  const wanted = text(scope).toLowerCase().replace(/^(each|every|all|the)\s+/, "").replace(/s$/, "");
  if (!wanted) return [];
  if (/^(room|habitable room)$/.test(wanted)) return roomNames;
  const exact = roomNames.filter((name) => name.toLowerCase() === text(scope).toLowerCase());
  if (exact.length) return exact;
  return roomNames.filter((name) => new RegExp(`\\b${wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(name));
}

function selectedInclusionSources(inclusions = {}) {
  const packageId = inclusions?.selectedPackageId || inclusions?.selected_standard_inclusions_package_id || "";
  const selectedPackage = (inclusions?.packages || []).find((item) => item.id === packageId) || null;
  const sections = Array.isArray(inclusions?.sections) ? inclusions.sections : Object.entries(inclusions?.sections || {}).map(([title, bullets]) => ({ title, bullets }));
  const electrical = sections.filter((section) => section?.active !== false && /^electrical$/i.test(text(section?.title)) && (!section.package_id || !packageId || section.package_id === packageId));
  // The builder's Electrical section also lists light fittings, fans and smoke alarms. Those are not
  // electrical points and are not shown or counted here (Lighting & Ceiling Fans owns fittings).
  const bullets = electrical.flatMap((section) => section.bullets || []).map(text).filter((bullet) => bullet && !/light|lamp|fans?|smoke|alarm/i.test(bullet));
  return { structured: selectedPackage?.electricalAllowances || inclusions?.electricalAllowances || [], bullets };
}

// { fromInclusions, byRoom: { [roomKey]: { [pointKey]: qty } }, lines: [bullet text] }
export function electricalInclusionBaseline(inclusions = {}, roomNames = []) {
  const { structured, bullets } = selectedInclusionSources(inclusions);
  const byRoom = {};
  const add = (names, pointKey, value) => names.forEach((name) => {
    const key = plumbingLocationKey(name);
    if (!key || !pointKey || !quantity(value)) return;
    byRoom[key] = { ...(byRoom[key] || {}), [pointKey]: quantity(value) };
  });
  (Array.isArray(structured) ? structured : []).forEach((item) => add(roomsForScope(item?.room || item?.roomType || item?.scope, roomNames), pointKeyFromText(text(item?.point || item?.pointKey || item?.label)), item?.quantity ?? item?.qty));
  bullets.forEach((bullet) => {
    const pointKey = pointKeyFromText(bullet);
    const count = bullet.match(/(\d+)\s*(?:x|×|no\.?)?\s/i)?.[1];
    if (!pointKey || !count) return;
    const leading = bullet.match(/^([^:\d]+?)\s*[:\-–]\s*\d/)?.[1];
    const trailing = bullet.match(/\b(?:per|to each|in each|for each|to every|in every|to the|in the|to|in)\s+([a-z0-9' ]+?)\s*$/i)?.[1];
    add(roomsForScope(leading || trailing, roomNames), pointKey, count);
  });
  return { fromInclusions: bullets.length > 0 || Object.keys(byRoom).length > 0, byRoom, lines: bullets };
}

// ---- Quotation Builder rates and existing counts ----------------------------------------------
const isRateSection = (name = "") => /electrical/i.test(name) && !/CLIENT SELECTIONS/i.test(name);
const effectiveRate = (row = {}) => (text(row.manualRate) ? row.manualRate : row.excelRate) ?? "";

// The estimate's own electrical rate row for each point type. A point with several possible rows
// (two rangehood rates) is left without a rate for the estimator to set: never guessed.
export function electricalQuoteRates(quotation = {}) {
  const rows = Object.entries(quotation || {}).filter(([name]) => isRateSection(name))
    .flatMap(([section, group]) => (group?.rows || []).filter((row) => row && row.source !== ELECTRICAL_SCHEDULE_SOURCE && row.active !== false).map((row) => ({ section, row })));
  return Object.fromEntries(ELECTRICAL_POINT_TYPES.map((type) => {
    const matches = rows.filter(({ row }) => type.quote.test(text(row.item)) && !(type.key !== "weatherproof-gpo" && /weatherproof/i.test(text(row.item))));
    if (matches.length !== 1) return [type.key, matches.length ? { ambiguous: matches.map(({ row }) => text(row.item)) } : null];
    const { section, row } = matches[0];
    return [type.key, { section, rowId: row.id, item: text(row.item), unit: row.unit || "EACH", rate: effectiveRate(row), houseQuantity: quantity(row.quantity ?? row.qty), location: text(row.location || row.level) }];
  }).filter(([, value]) => value));
}

// Electrical counts the estimate already holds. Whole-house counts are reported as they are; a
// count is placed in a room only when the estimate row itself names that room.
export function electricalEstimateCounts(workbook = {}, roomNames = []) {
  const rates = electricalQuoteRates(workbook?.quotation || {});
  const byRoom = {};
  const house = [];
  Object.entries(rates).forEach(([pointKey, rate]) => {
    if (!rate.houseQuantity) return;
    const room = roomNames.find((name) => name.toLowerCase() === rate.location.toLowerCase());
    if (room) byRoom[plumbingLocationKey(room)] = { ...(byRoom[plumbingLocationKey(room)] || {}), [pointKey]: rate.houseQuantity };
    else house.push({ pointKey, label: ELECTRICAL_POINT_BY_KEY[pointKey].label, quantity: rate.houseQuantity, item: rate.item });
  });
  return { byRoom, house };
}

// ---- The schedule ---------------------------------------------------------------------------
// The saved schedule laid over the project's current rooms, in project order. A room with no saved
// entry starts from what the project already knows: the estimate's count for that room, else the
// Standard Inclusions allowance. A saved room the project no longer lists is kept (flagged) while
// it still holds quantities, so nothing a client entered disappears silently.
// projectRooms: the canonical rooms ({ id, name, roomType }); a bare name is accepted too.
export function normaliseElectricalSchedule(saved = null, projectRooms = [], { baseline = { byRoom: {} }, estimate = { byRoom: {} } } = {}) {
  const savedRooms = saved?.rooms || [];
  const used = new Set();
  const seen = new Set();
  const rooms = [];
  projectRooms.forEach((entry) => {
    const name = text(typeof entry === "string" ? entry : entry?.name);
    const roomKey = plumbingLocationKey(name);
    const roomId = (typeof entry === "string" ? "" : entry?.id) || roomKey;
    if (!roomKey || seen.has(roomId)) return;
    seen.add(roomId);
    // By stable id; a schedule saved before rooms had ids is matched once by its room name.
    const previous = savedRooms.find((room) => !used.has(room) && room.roomId === roomId) || savedRooms.find((room) => !used.has(room) && !room.roomId && (room.roomKey || plumbingLocationKey(room.room)) === roomKey);
    if (previous) used.add(previous);
    const included = cleanPoints(baseline.byRoom?.[roomKey]);
    const roomType = (typeof entry === "string" ? "" : entry?.roomType || entry?.roomKey) || "";
    rooms.push(previous
      ? { roomId, roomKey, room: name, roomType, points: cleanPoints(previous.points), custom: cleanCustom(previous.custom), included, notes: text(previous.notes), status: previous.status || "", confirmedAt: previous.confirmedAt || "" }
      : { roomId, roomKey, room: name, roomType, points: cleanPoints(estimate.byRoom?.[roomKey] || included), custom: [], included, notes: "", status: "", confirmedAt: "", prefilled: Boolean(estimate.byRoom?.[roomKey] || Object.keys(included).length) });
  });
  savedRooms.filter((previous) => !used.has(previous)).forEach((previous) => {
    const points = cleanPoints(previous.points);
    const custom = cleanCustom(previous.custom);
    if (!Object.keys(points).length && !custom.some((item) => item.quantity)) return;
    const roomKey = previous.roomKey || plumbingLocationKey(previous.room);
    rooms.push({ roomId: previous.roomId || roomKey, roomKey, room: previous.room, roomType: "", points, custom, included: cleanPoints(previous.included), notes: text(previous.notes), status: previous.status || "", confirmedAt: previous.confirmedAt || "", notInProject: true });
  });
  return { version: ELECTRICAL_SCHEDULE_VERSION, rooms, updatedAt: saved?.updatedAt || "" };
}

export function electricalRoomComplete(room = {}) {
  return room.status === ELECTRICAL_ROOM_STATUS.confirmed || room.status === ELECTRICAL_ROOM_STATUS.standard;
}

// "complete" | "in_progress" | "not_started" for one room.
export function electricalRoomState(room = {}) {
  if (electricalRoomComplete(room)) return "complete";
  const touched = room.status === ELECTRICAL_ROOM_STATUS.draft || room.prefilled || Object.keys(room.points || {}).length || (room.custom || []).length || room.notes;
  return touched ? "in_progress" : "not_started";
}

// Completion over the rooms the project actually has.
export function electricalScheduleProgress(schedule = { rooms: [] }) {
  const rooms = (schedule.rooms || []).filter((room) => !room.notInProject);
  const complete = rooms.filter(electricalRoomComplete).length;
  return { total: rooms.length, complete, started: rooms.filter((room) => electricalRoomState(room) !== "not_started").length, allComplete: rooms.length > 0 && complete === rooms.length };
}

// What a room actually gets: its own quantities, or the standard inclusion when it takes that.
export function electricalRoomQuantities(room = {}) {
  return room.status === ELECTRICAL_ROOM_STATUS.standard ? { ...(room.included || {}) } : { ...(room.points || {}) };
}

// ["6 powerpoints", "1 data point"] - the room card summary.
export function electricalRoomSummary(room = {}) {
  const quantities = electricalRoomQuantities(room);
  const totals = {};
  Object.entries(quantities).forEach(([key, value]) => { const group = ELECTRICAL_POINT_BY_KEY[key]?.group; if (group) totals[group] = (totals[group] || 0) + value; });
  if (room.status !== ELECTRICAL_ROOM_STATUS.standard) (room.custom || []).forEach((item) => { totals.custom = (totals.custom || 0) + item.quantity; });
  return SUMMARY_GROUPS.filter(([group]) => totals[group]).map(([group, one, many]) => `${totals[group]} ${totals[group] === 1 ? one : many}`);
}

// The point types a room's editor opens with: the core points, the points that suit this room,
// and anything the room already has or is included with. The rest sit behind "Add another point".
export function electricalPointsForRoom(room = {}, { rates = {} } = {}) {
  // A room's type counts as well as its name: "Jack's Room" typed as a kitchen gets kitchen points.
  const shown = (type) => type.core || (type.rooms || []).some((pattern) => pattern.test(`${room.room || ""} ${room.roomType || ""}`)) || room.points?.[type.key] > 0 || room.included?.[type.key] > 0
    || (type.key === "usb-gpo" && Boolean(rates["usb-gpo"]?.rowId));
  return { shown: ELECTRICAL_POINT_TYPES.filter(shown), more: ELECTRICAL_POINT_TYPES.filter((type) => !shown(type)) };
}

// One line per room and point: INCLUDED, SELECTED and VARIATION quantities kept separate. The id is
// stable for the life of the job, so a changed quantity updates its quotation row.
export function electricalScheduleLines(schedule = { rooms: [] }) {
  return (schedule.rooms || []).flatMap((room) => {
    const selected = electricalRoomQuantities(room);
    const included = room.included || {};
    const lines = ELECTRICAL_POINT_TYPES.filter((type) => selected[type.key] > 0 || included[type.key] > 0).map((type) => ({
      id: `electrical-schedule:${room.roomId || room.roomKey}:${type.key}`, roomId: room.roomId || room.roomKey, roomKey: room.roomKey, room: room.room, pointKey: type.key, label: type.label,
      includedQty: included[type.key] || 0, selectedQty: selected[type.key] || 0, variationQty: (selected[type.key] || 0) - (included[type.key] || 0), notes: room.notes || "",
    }));
    const custom = room.status === ELECTRICAL_ROOM_STATUS.standard ? [] : (room.custom || []).filter((item) => item.quantity > 0).map((item) => ({
      id: `electrical-schedule:${room.roomId || room.roomKey}:custom:${item.id}`, roomId: room.roomId || room.roomKey, roomKey: room.roomKey, room: room.room, pointKey: "custom", label: item.label,
      includedQty: 0, selectedQty: item.quantity, variationQty: item.quantity, notes: room.notes || "", custom: true,
    }));
    return [...lines, ...custom];
  });
}

// The stored form: only what was entered (no transient flags).
export function storedElectricalSchedule(schedule = { rooms: [] }, now = new Date().toISOString()) {
  return {
    version: ELECTRICAL_SCHEDULE_VERSION,
    updatedAt: now,
    rooms: (schedule.rooms || []).map((room) => ({ roomId: room.roomId || room.roomKey, roomKey: room.roomKey, room: room.room, points: cleanPoints(room.points), custom: cleanCustom(room.custom), included: cleanPoints(room.included), notes: text(room.notes), status: room.status || "", confirmedAt: room.confirmedAt || "" })),
  };
}

// The Selections Book row for the schedule. It carries quantities only: no allowance, price or
// variation amount is ever created in Client Selections.
export function electricalSelectionPatch(requirement = {}, schedule = { rooms: [] }, { projectId = "", organisationId = "", now = new Date().toISOString() } = {}) {
  const stored = storedElectricalSchedule(schedule, now);
  const progress = electricalScheduleProgress(schedule);
  const lines = electricalScheduleLines(stored);
  const summary = `Electrical schedule: ${progress.complete} of ${progress.total} room${progress.total === 1 ? "" : "s"} complete`;
  return {
    selectedOptionId: ELECTRICAL_SCHEDULE_REQUIREMENT_KEY,
    selectedProduct: summary,
    description: lines.map((line) => `${line.room}: ${line.selectedQty} x ${line.label}`).join("; "),
    status: progress.allComplete ? "selected" : "pending",
    included: true,
    allowanceAmount: 0, selectedCost: 0, upgradeCost: 0,
    guidedSelection: {
      source: "guided_client_selections", projectId, organisationId,
      area: requirement.areaKey, room: requirement.areaLabel,
      requirementKey: requirement.requirementKey || ELECTRICAL_SCHEDULE_REQUIREMENT_KEY, requirementLabel: requirement.label || "Electrical",
      productName: summary, selectedProduct: summary,
      electricalSchedule: stored,
      electricalLines: lines,
      electricalRoomStatuses: (schedule.rooms || []).filter((room) => !room.notInProject).map((room) => ({ roomId: room.roomId || room.roomKey, roomKey: room.roomKey, room: room.room, status: electricalRoomState(room) })),
      electricalCompleteRooms: progress.complete,
      allowance: 0, selectedPrice: 0, variation: 0, variationAmount: 0,
      configurationComplete: progress.allComplete,
      updatedAt: now,
    },
  };
}

export function storedElectricalScheduleFromBook(book = {}) {
  for (const room of book?.rooms || []) for (const row of room.rows || []) {
    if (row?.guidedSelection?.electricalSchedule) return row.guidedSelection.electricalSchedule;
  }
  return null;
}

// Client Selections -> Quotation Builder. One row per room and point type in ELECTRICAL - CLIENT
// SELECTIONS, id electrical-schedule:<room>:<point>, so a changed quantity updates that row and
// never adds another. The rate is the estimate's own electrical rate for the point (re-read every
// time, so a rate changed in the Quotation Builder follows through); a manualRate the estimator
// typed on a schedule row is kept. The estimate's rate rows are never altered. Rows written
// earlier for points no longer scheduled are removed.
export function connectElectricalScheduleToQuotation(workbook = {}, book = {}) {
  const schedule = storedElectricalScheduleFromBook(book);
  const quotation = workbook.quotation || {};
  const previousRows = Object.values(quotation).flatMap((section) => (section?.rows || []).filter((row) => row?.source === ELECTRICAL_SCHEDULE_SOURCE));
  if (!schedule && !previousRows.length) return workbook;
  const rates = electricalQuoteRates(quotation);
  const describe = (line) => [line.includedQty ? `Included ${line.includedQty}` : "", `Selected ${line.selectedQty}`, line.includedQty ? `Variation ${line.variationQty > 0 ? "+" : ""}${line.variationQty}` : "", line.notes].filter(Boolean).join(" · ");
  const rows = electricalScheduleLines(schedule || { rooms: [] }).map((line) => {
    const previous = previousRows.find((row) => row.id === line.id) || {};
    const rate = line.custom ? null : rates[line.pointKey];
    const linked = rate?.rowId ? rate : null;
    const item = `${line.label.replace(/Powerpoints$/, "Powerpoint")} - ${line.room}`;
    return {
      ...previous,
      id: line.id,
      source: ELECTRICAL_SCHEDULE_SOURCE,
      section: ELECTRICAL_SCHEDULE_SECTION,
      item,
      rawText: item,
      description: describe(line),
      location: line.room,
      roomId: line.roomId,
      roomKey: line.roomKey,
      electricalPointKey: line.pointKey,
      unit: linked?.unit || previous.unit || "EACH",
      qty: line.selectedQty,
      quantity: line.selectedQty,
      includedQty: line.includedQty,
      selectedQty: line.selectedQty,
      variationQty: line.variationQty,
      excelRate: linked ? linked.rate : "",
      manualRate: previous.manualRate ?? "",
      rateSourceSection: linked?.section || "",
      rateSourceRowId: linked?.rowId || "",
      rateSourceItem: linked?.item || "",
      priceStatus: linked && text(linked.rate) ? "Quotation rate" : rate?.ambiguous ? "Rate required - several quotation rates match" : "Rate required in Quotation Builder",
      lineType: "Standard rate item",
      quoteRequired: false,
      cost: "",
      notes: line.notes,
      included: true,
      active: true,
    };
  });
  const next = Object.fromEntries(Object.entries(quotation).map(([name, section]) => [name, (section?.rows || []).some((row) => row?.source === ELECTRICAL_SCHEDULE_SOURCE) ? { ...section, rows: section.rows.filter((row) => row?.source !== ELECTRICAL_SCHEDULE_SOURCE) } : section]));
  const target = next[ELECTRICAL_SCHEDULE_SECTION] || { collapsed: true, rows: [] };
  if (rows.length || (target.rows || []).length) next[ELECTRICAL_SCHEDULE_SECTION] = { ...target, rows: [...(target.rows || []), ...rows] };
  else delete next[ELECTRICAL_SCHEDULE_SECTION];
  return { ...workbook, quotation: next };
}
