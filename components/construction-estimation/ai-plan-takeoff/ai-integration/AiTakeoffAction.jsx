import React, { useMemo, useState } from 'react';
import { createJobSetupPayload } from '../takeoffSchedule.js';
import { BUILDING_LEVELS, floorPlanSheets, roomsByLevel } from './roomSchedule.js';

const buttonStyle = { padding: '10px 12px', border: 0, borderRadius: 5, cursor: 'pointer', fontWeight: 700 };

// A paid OpenAI request never starts from one click: the builder sees what is sent and that it is charged,
// then authorises it.
function PaidConfirmation({ id, what, onConfirm, onCancel }) {
  return (
    <div id={id} role="alertdialog" aria-label="Authorise paid AI requests" style={{ marginTop: 8, padding: 10, border: '1px solid #f59e0b', background: '#fffbeb', borderRadius: 6 }}>
      <strong style={{ display: 'block', color: '#78350f' }}>Paid OpenAI requests</strong>
      <div style={{ color: '#451a03', margin: '4px 0 8px' }}>{what} The plan sheets are sent to OpenAI and every request is charged to the OpenAI API account set up for this app. Nothing is sent unless you authorise it.</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button id={`${id}-authorise`} type="button" onClick={onConfirm} style={{ ...buttonStyle, background: '#b45309', color: '#fff' }}>Authorise paid AI requests</button>
        <button id={`${id}-cancel`} type="button" onClick={onCancel} style={{ ...buttonStyle, background: '#e2e8f0' }}>Cancel</button>
      </div>
    </div>
  );
}
const reviewText = (value) => typeof value === 'string' ? value : value?.message || value?.reason || value?.evidence || JSON.stringify(value);

// The Rooms schedule: every room of the house, by level. Read from the room names on the
// floor-plan sheets, corrected by hand, and used by every room-based Client Selection.
function RoomsSchedule({ analysis, sheetLevels, disabled }) {
  const [confirming, setConfirming] = useState(false);
  const rooms = analysis.report?.rooms || [];
  const control = analysis.rooms;
  const sheets = floorPlanSheets(sheetLevels);
  const levels = sheets.length ? [...new Set(sheets.map((sheet) => sheet.level))] : BUILDING_LEVELS;
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const addLevel = levels.includes(level) ? level : levels[0];
  const add = () => { if (!name.trim()) return; control.add(name, addLevel); setName(''); };
  return (
    <div id="takeoff-rooms-schedule" style={{ marginTop: 12, borderTop: '1px solid #cbd5e1', paddingTop: 12 }}>
      <strong style={{ display: 'block' }}>Rooms schedule{rooms.length ? ` — ${rooms.length} room${rooms.length === 1 ? '' : 's'}` : ''}</strong>
      <div style={{ color: '#475569', margin: '4px 0 8px' }}>The rooms of this house. Cabinetry, floor coverings, tiles, paint and the other room-by-room selections use this list.</div>
      <button id="read-rooms-from-plans" type="button" disabled={disabled || control.busy} onClick={() => setConfirming(true)}
        style={{ ...buttonStyle, width: '100%', background: disabled || control.busy ? '#94a3b8' : '#1d4ed8', color: 'white' }}>
        {control.busy ? 'Reading room names…' : rooms.some((room) => room.source === 'plan') ? 'READ ROOMS WITH AI AGAIN (OPENAI — PAID)' : 'READ ROOMS WITH AI (OPENAI — PAID)'}
      </button>
      {confirming && <PaidConfirmation id="confirm-ai-rooms" what="Reading room names with AI makes one or two requests per floor-plan sheet."
        onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); control.read({ authorised: true }); }} />}
      <div style={{ color: '#64748b', marginTop: 4 }}>Run Takeoff already reads printed room names locally (no charge). This optional AI reading can help where names are unreadable. Review amber boundaries on the plan before using their quantities.</div>
      {control.message && <div id="read-rooms-status" role="status" aria-live="polite" style={{ marginTop: 8, color: control.error ? '#b91c1c' : '#334155' }}>{control.message}</div>}
      {roomsByLevel(rooms).map((group) => (
        <div key={group.level} style={{ marginTop: 10 }} data-rooms-level={group.level}>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{group.level}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {group.rooms.map((room) => (
              <span key={room.name} data-room-name={room.name} title={room.source === 'manual' ? 'Added by hand' : `Read from sheet ${room.page}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 9px', borderRadius: 999, background: room.source === 'manual' ? '#fef3c7' : '#e0f2fe', color: '#0f172a' }}>
                {room.name}
                <button type="button" disabled={disabled} aria-label={`Remove ${room.name}`} onClick={() => control.remove(room.name)}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 700, color: '#475569', padding: '0 5px' }}>×</button>
              </span>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input id="add-room-name" aria-label="Room name" value={name} disabled={disabled} placeholder="Add a room" onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') add(); }} style={{ flex: 1, minWidth: 0, padding: '7px 8px', border: '1px solid #94a3b8', borderRadius: 5 }} />
        <select aria-label="Level" value={addLevel} disabled={disabled} onChange={(event) => setLevel(event.target.value)} style={{ padding: '7px 4px', border: '1px solid #94a3b8', borderRadius: 5 }}>
          {levels.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button id="add-room" type="button" disabled={disabled || !name.trim()} onClick={add} style={{ ...buttonStyle, background: '#e2e8f0' }}>Add</button>
      </div>
    </div>
  );
}

const reviewButton = { ...buttonStyle, padding: '7px 10px', background: '#e2e8f0', fontSize: 13 };

// One thing the builder has to decide, with the control that settles it.
function ReviewDecision({ decision, disabled, onResolve, onGoToPage }) {
  const action = decision.action || {};
  const [value, setValue] = useState(action.suggested ?? '');
  const page = decision.pages?.[0];
  return (
    <div data-review-decision={decision.id} style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 6, padding: 10, marginTop: 8 }}>
      <strong style={{ display: 'block', color: '#78350f' }}>{decision.title}</strong>
      <div style={{ color: '#451a03', margin: '4px 0 8px' }}>{decision.detail}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {action.type === 'choose' && action.options.map((option) => (
          <button key={option.value} type="button" disabled={disabled} onClick={() => onResolve(decision, option.value)} style={{ ...reviewButton, background: '#0f766e', color: '#fff' }}>{option.label}</button>
        ))}
        {action.type === 'number' && <>
          <input type="number" aria-label={`${decision.title} (${action.unit})`} value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)}
            style={{ width: 90, padding: '6px 8px', border: '1px solid #94a3b8', borderRadius: 5 }} />
          <span>{action.unit}</span>
          <button type="button" disabled={disabled || !(action.allowZero ? value !== '' && Number(value) >= 0 : Number(value) > 0)} onClick={() => onResolve(decision, Number(value))} style={{ ...reviewButton, background: '#0f766e', color: '#fff' }}>Apply</button>
        </>}
        {['acknowledge', 'rerun'].includes(action.type) && <button type="button" disabled={disabled} onClick={() => onResolve(decision, true)} style={reviewButton}>I have checked this</button>}
        {page && onGoToPage && <button type="button" onClick={() => onGoToPage(page)} style={reviewButton}>Show sheet {page}</button>}
      </div>
    </div>
  );
}

// What the takeoff holds, in the three kinds the builder must tell apart: measured from the drawing and
// accepted, waiting for the builder's review, and the optional AI-assisted analysis.
function TakeoffSummary({ report, review }) {
  const counts = report.counts || {};
  const local = !report.aiAssisted;
  const withheldWalls = (report.wallReviewCandidates || []).length;
  const roomsToApprove = (report.rooms || []).filter((room) => room.polygon?.length >= 3 && !room.confirmed && !room.excluded).length;
  const measured = [
    [counts.walls, 'wall', 'walls'], [counts.windows, 'window', 'windows'], [counts.doors, 'door', 'doors'], [counts.floorAreas, 'floor area', 'floor areas'],
    [counts.roomBoundaries, 'room with a measured boundary', 'rooms with measured boundaries'],
  ].filter(([value]) => value > 0).map(([value, one, many]) => `${value} ${value === 1 ? one : many}`);
  return (
    <div id="takeoff-summary" style={{ marginTop: 8, display: 'grid', gap: 6 }}>
      <div id="takeoff-measured-summary" data-kind="measured" style={{ padding: 8, borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac' }}>
        <strong style={{ color: '#166534' }}>{local ? 'Measured locally from the drawing (no AI)' : 'Measured from the drawing'}</strong>
        <div style={{ color: '#14532d' }}>{measured.length ? `${measured.join(', ')} in the takeoff.` : 'Nothing was measured on the selected sheets.'} Lengths, areas and positions come from the PDF's own linework and your calibration.</div>
      </div>
      <div id="takeoff-review-summary" data-kind="review" style={{ padding: 8, borderRadius: 6, background: review.decisions.length || withheldWalls || roomsToApprove ? '#fffbeb' : '#f8fafc', border: '1px solid #fcd34d' }}>
        <strong style={{ color: '#92400e' }}>Requires builder review</strong>
        <div style={{ color: '#451a03' }}>
          {review.decisions.length} item{review.decisions.length === 1 ? '' : 's'} to confirm
          {withheldWalls ? `; ${withheldWalls} measured wall${withheldWalls === 1 ? '' : 's'} held back until you classify ${withheldWalls === 1 ? 'it' : 'them'} (not in quantities)` : ''}
          {roomsToApprove ? `; ${roomsToApprove} room boundar${roomsToApprove === 1 ? 'y' : 'ies'} to approve before ${roomsToApprove === 1 ? 'its' : 'their'} area is used` : ''}.
        </div>
      </div>
      <div id="takeoff-ai-summary" data-kind="ai" style={{ padding: 8, borderRadius: 6, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
        <strong style={{ color: '#334155' }}>AI-assisted analysis</strong>
        <div style={{ color: '#475569' }}>{report.aiAssisted ? `Used: OpenAI ${report.aiAssisted.model || ''}, ${report.aiAssisted.requests} request${report.aiAssisted.requests === 1 ? '' : 's'}.` : 'Not used. Optional; needs an available OpenAI account and your authorisation for each run.'}</div>
      </div>
    </div>
  );
}

export function AiTakeoffAction({ analysis, schedule, sheetLevels = {}, disabled, onCalibrate, onReview, onSave, onGoToPage }) {
  const { stage, message, report, scaleProposal } = analysis;
  const [confirmingAssisted, setConfirmingAssisted] = useState(false);
  const busy = ['reading', 'measuring', 'building'].includes(stage);
  const pending = busy || stage === 'scale' || stage === 'calibration';
  // The same review Job Setup shows when these quantities are imported.
  const review = useMemo(() => {
    if (!schedule || !report || report.status === 'rooms') return { checklist: [], decisions: [], diagnostics: [] };
    try { return createJobSetupPayload(schedule, { sheetLevels }).review; } catch { return { checklist: [], decisions: [], diagnostics: [] }; }
  }, [schedule, sheetLevels, report]);
  const rooms = report?.rooms || [];
  const fixtures = report?.fixtures || [];
  const inspections = report?.inspections || [];
  const scaleLabel = scaleProposal?.denominator ? `1:${scaleProposal.denominator}`
    : `${scaleProposal?.source || 'Drawing evidence'} (${Number(scaleProposal?.pixelsPerMm || 0).toPrecision(6)} px/mm)`;
  return (
    <section aria-label="AI Takeoff" style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 12, background: '#f8fafc', fontSize: 13 }}>
      <button id="run-ai-takeoff" type="button" disabled={disabled || pending} onClick={() => analysis.run()}
        style={{ ...buttonStyle, width: '100%', background: disabled || pending ? '#94a3b8' : '#0f766e', color: 'white' }}>
        {busy ? 'Measuring plan…' : 'RUN TAKEOFF — MEASURE LOCALLY (NO AI CHARGES)'}
      </button>
      <div style={{ color: '#475569', marginTop: 4 }}>Measures the floor-plan sheets you have given a level, from the PDF's own linework, on this computer. Nothing is sent to OpenAI.</div>
      {analysis.report?.runId === 'ai-takeoff-v3-local' && (
        <button id="remeasure-takeoff" type="button" disabled={disabled || pending}
          onClick={() => { if (typeof window === 'undefined' || window.confirm('Measure the plan again with the current measuring rules? The earlier local measurement is replaced; anything drawn by hand is kept. This is refused if anything from the earlier measurement has been approved.')) analysis.run({ remeasure: true }); }}
          style={{ ...buttonStyle, width: '100%', marginTop: 8, background: disabled || pending ? '#e2e8f0' : '#fff', color: '#0f766e', border: '1px solid #0f766e' }}>
          Re-measure with the current rules (replaces the unapproved local measurement)
        </button>
      )}
      <button id="run-ai-assisted-takeoff" type="button" disabled={disabled || pending} onClick={() => setConfirmingAssisted(true)}
        style={{ ...buttonStyle, width: '100%', marginTop: 8, background: disabled || pending ? '#e2e8f0' : '#fff', color: '#92400e', border: '1px solid #f59e0b' }}>
        Optional: AI-assisted analysis (OpenAI — paid)…
      </button>
      {confirmingAssisted && <PaidConfirmation id="confirm-ai-assisted" what="AI-assisted analysis reads every sheet and adds opening types, room names and plan notes (several requests per sheet, a few minutes each). Locally measured quantities are kept if it fails."
        onCancel={() => setConfirmingAssisted(false)} onConfirm={() => { setConfirmingAssisted(false); analysis.run({ assisted: true, authorised: true }); }} />}
      {message && <div id="ai-takeoff-status" role="status" aria-live="polite" style={{ marginTop: 10, color: stage === 'error' ? '#b91c1c' : '#334155' }}>{message}</div>}
      {stage === 'scale' && scaleProposal && (
        <div style={{ marginTop: 10 }}>
          <strong>Detected scale: {scaleLabel}</strong>
          <p>Confirm this scale matches the plan. Measurements will use the existing Takeoff calibration.</p>
          {(scaleProposal.review || []).map((item, index) => <p key={index}>{reviewText(item)}</p>)}
          <button id="ai-takeoff-confirm-scale" type="button" onClick={analysis.confirmScale} style={{ ...buttonStyle, background: '#0f766e', color: '#fff' }}>Confirm scale and continue</button>
          <button type="button" onClick={() => { analysis.useManualCalibration(); onCalibrate(); }} style={{ ...buttonStyle, marginTop: 6 }}>Use manual calibration</button>
        </div>
      )}
      {stage === 'calibration' && <>
        <button type="button" onClick={onCalibrate} style={{ ...buttonStyle, marginTop: 10 }}>Calibrate plan</button>
        {analysis.hasCalibration && <button type="button" onClick={analysis.continueManualCalibration} style={{ ...buttonStyle, marginTop: 8 }}>I verified the current calibration — continue</button>}
      </>}
      {pending && <button type="button" onClick={analysis.cancel} style={{ ...buttonStyle, display: 'block', marginTop: 8 }}>Cancel analysis</button>}
      {report && report.status !== 'rooms' && (
        <div id="ai-takeoff-result" style={{ marginTop: 12 }}>
          <strong>{report.status === 'review' || review.decisions.length ? 'TAKEOFF REQUIRES REVIEW' : 'TAKEOFF COMPLETE'}</strong>
          <TakeoffSummary report={report} review={review} />
          <div style={{ marginTop: 8 }}>
            {review.checklist.map((item) => <div key={item.label} style={{ color: '#166534' }}>✓ {item.label}</div>)}
            {report.counts?.alreadyMeasured > 0 && <div style={{ color: '#475569' }}>{report.counts.alreadyMeasured} item{report.counts.alreadyMeasured === 1 ? '' : 's'} already in this takeoff {report.counts.alreadyMeasured === 1 ? 'was' : 'were'} kept, not added twice</div>}
            <div id="ai-takeoff-review-count" style={{ marginTop: 6, fontWeight: 700, color: review.decisions.length ? '#b45309' : '#166534' }}>
              {review.decisions.length ? `⚠ ${review.decisions.length} item${review.decisions.length === 1 ? '' : 's'} require${review.decisions.length === 1 ? 's' : ''} confirmation` : rooms.some(room => room.reviewRequired) ? 'Room boundaries require confirmation on the plan' : '✓ Nothing needs confirmation'}
            </div>
          </div>
          {review.decisions.length > 0 && <div style={{ marginTop: 4 }}>
            <strong style={{ display: 'block', marginTop: 8 }}>Requires review</strong>
            {review.decisions.map((decision) => <ReviewDecision key={decision.id} decision={decision} disabled={disabled || pending} onResolve={analysis.resolveDecision} onGoToPage={onGoToPage} />)}
          </div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button id="ai-takeoff-review" type="button" onClick={onReview} style={{ ...buttonStyle, background: '#e2e8f0' }}>REVIEW TAKEOFF</button>
            <button id="ai-takeoff-save" type="button" disabled={disabled || pending} onClick={onSave} style={{ ...buttonStyle, background: '#2563eb', color: '#fff' }}>SAVE TAKEOFF</button>
          </div>
          <details id="ai-takeoff-diagnostics" style={{ marginTop: 10 }}>
            <summary>Advanced diagnostics ({review.diagnostics.length})</summary>
            <p>Technical notes from the analysis. Nothing here needs action. OBSERVED = read from the drawing. DERIVED = calculated from reliable geometry, dimensions or another sheet. ASSUMED = a default, shown above when it needs confirming.</p>
            {review.diagnostics.map((item, index) => <p key={index}>{item}</p>)}
            {inspections.map((item) => <p key={item.page}>Sheet {item.page}: {item.drawingType}, {item.level}. {item.scale?.evidence}</p>)}
            {rooms.length > 0 && <><strong>Named spaces — Rooms schedule</strong>{rooms.map((item, index) => <p key={index}>{item.name || item.label} — {item.basis}, {Math.round((item.confidence || 0) * 100)}%</p>)}</>}
            {fixtures.length > 0 && <><strong>Detected items — Custom Takeoffs schedule</strong>{fixtures.map((item, index) => <p key={index}>{item.type || item.name}: {item.quantity} — {item.basis}, {Math.round((item.confidence || 0) * 100)}%</p>)}</>}
            <p>Provider: {report.provider}; model: {report.modelVersion}</p>
          </details>
        </div>
      )}
      <RoomsSchedule analysis={analysis} sheetLevels={sheetLevels} disabled={disabled || pending} />
    </section>
  );
}
