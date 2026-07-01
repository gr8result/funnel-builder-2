// AIPlanTakeoffPage.jsx — AI-assisted Manual Takeoff.

import { useState, useCallback, useReducer, useEffect } from "react";

import PDFUploadPanel        from "./PDFUploadPanel";
import ScaleCalibrationPanel from "./ScaleCalibrationPanel";
import TakeoffToolbar        from "./TakeoffToolbar";
import PlanCanvas            from "./PlanCanvas";
import RoomPanel             from "./RoomPanel";
import ObjectPanel           from "./ObjectPanel";
import AIReviewPanel         from "./AIReviewPanel";

import { TOOLS, createProject } from "./takeoffTypes";
import { saveProject, loadByJobId, summarise } from "./takeoffUtils";
import { runDetection, runOrientationDetection } from "./aiDetectionService";

// ── Reducer: pages array with undo/redo ───────────────────────────────────────

const initState = (pages) => ({ pages, undo:[], redo:[] });

function reducer(state, action) {
  switch (action.type) {

    case "RESET":
      return initState(action.pages);

    case "SET_PAGES":
      return { pages:action.pages, undo:[...state.undo,state.pages].slice(-60), redo:[] };

    case "PATCH_PAGE": {
      const pages = state.pages.map(pg => pg.id===action.pageId ? action.fn(pg) : pg);
      return { pages, undo:[...state.undo,state.pages].slice(-60), redo:[] };
    }

    case "UPDATE_OVERLAY": {
      const pages = state.pages.map(pg =>
        pg.id!==action.pageId ? pg : {
          ...pg,
          overlays: pg.overlays.map(o => o.id===action.id ? {...o,...action.patch} : o),
        }
      );
      return { pages, undo:[...state.undo,state.pages].slice(-60), redo:[] };
    }

    case "UNDO":
      if (!state.undo.length) return state;
      return { pages:state.undo[state.undo.length-1], undo:state.undo.slice(0,-1), redo:[state.pages,...state.redo] };

    case "REDO":
      if (!state.redo.length) return state;
      return { pages:state.redo[0], undo:[...state.undo,state.pages], redo:state.redo.slice(1) };

    default: return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

async function rotateTakeoffPage(page, rotationDegrees) {
  const degrees = normalizeRotationDegrees(rotationDegrees);
  if (!degrees || typeof window === "undefined") return page;
  const rotatedImage = await rotateImageDataUrl(page.imageDataUrl, page.naturalWidth, page.naturalHeight, degrees);
  const pdfPageRotationDegrees = normalizeRotationDegrees(page.pdfPageRotationDegrees || page.pdfPageRotation || page.pdfRotationDegrees || 0);
  const detectedRotationDegrees = normalizeRotationDegrees((page.detectedRotationDegrees || 0) + degrees);
  const manualRotationDegrees = normalizeRotationDegrees(page.manualRotationDegrees || page.userRotationDegrees || 0);
  return {
    ...page,
    imageDataUrl: rotatedImage.dataUrl,
    naturalWidth: rotatedImage.width,
    naturalHeight: rotatedImage.height,
    pdfPageRotationDegrees,
    pdfPageRotation: pdfPageRotationDegrees,
    pdfRotationDegrees: pdfPageRotationDegrees,
    detectedRotationDegrees,
    manualRotationDegrees,
    userRotationDegrees: manualRotationDegrees,
    finalRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + detectedRotationDegrees + manualRotationDegrees),
    planRotationDegrees: normalizeRotationDegrees(pdfPageRotationDegrees + detectedRotationDegrees + manualRotationDegrees),
    overlays: (page.overlays || []).map((overlay) => ({
      ...overlay,
      points: (overlay.points || []).map((point) => rotatePoint(point, page.naturalWidth, page.naturalHeight, degrees)),
    })),
  };
}

function rotateImageDataUrl(dataUrl, width, height, rotationDegrees) {
  return new Promise((resolve, reject) => {
    const degrees = normalizeRotationDegrees(rotationDegrees);
    const sourceWidth = Number(width) || 0;
    const sourceHeight = Number(height) || 0;
    if (!dataUrl || !degrees || !sourceWidth || !sourceHeight) {
      resolve({ dataUrl, width: sourceWidth, height: sourceHeight });
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const swap = degrees === 90 || degrees === 270;
      canvas.width = swap ? sourceHeight : sourceWidth;
      canvas.height = swap ? sourceWidth : sourceHeight;
      const ctx = canvas.getContext("2d");
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => reject(new Error("Could not rotate plan image."));
    image.src = dataUrl;
  });
}

function rotatePoint(point, width, height, rotationDegrees) {
  const degrees = normalizeRotationDegrees(rotationDegrees);
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  const W = Number(width) || 0;
  const H = Number(height) || 0;
  if (degrees === 90) return { x: H - y, y: x };
  if (degrees === 180) return { x: W - x, y: H - y };
  if (degrees === 270) return { x: y, y: W - x };
  return { x, y };
}

function normalizeRotationDegrees(value) {
  const degrees = Number(value) || 0;
  const normalized = ((degrees % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

export default function AIPlanTakeoffPage({ sheet }) {
  const jobId = sheet?.workbook?.openedFileName || sheet?.workbook?.id || "";
  const savedTakeoffProject = sheet?.workbook?.aiTakeoffProject;

  const [project, setProject] = useState(() => savedTakeoffProject?.pages ? savedTakeoffProject : loadByJobId(jobId) || createProject(jobId));
  const [plans, setPlans] = useState(() => Array.isArray(sheet?.workbook?.plans) ? sheet.workbook.plans : project.plans || []);
  const [state,   dispatch]   = useReducer(reducer, initState(project.pages || []));
  const pages = state.pages;

  // View state
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id || null);
  const [activeTool,     setActiveTool]     = useState(TOOLS.POINTER);
  const [selectedId,     setSelectedId]     = useState(null);
  const [snapEnabled,    setSnapEnabled]    = useState(true);
  const [calibrating,    setCalibrating]    = useState(null);
  const [rightTab,       setRightTab]       = useState("rooms"); // "rooms" | "properties" | "ai"

  // ── AI detection state ─────────────────────────────────────────────────────
  const [analysing,  setAnalysing]  = useState(false);
  const [aiMessage,  setAiMessage]  = useState("");

  const [zoom,     setZoom]     = useState(1);
  const [pan,      setPan]      = useState({ x:0, y:0 });
  const [rotation, setRotation] = useState(0);

  const selectedPage = pages.find(p=>p.id===selectedPageId) || pages[0] || null;
  const selectedPlan = selectedPage?.planId ? plans.find((plan) => plan.id === selectedPage.planId) : null;
  const rawPpm       = selectedPage?.scale?.pixelsPerMetre || 0;
  const overlays     = selectedPage?.overlays || [];
  const selectedOv   = overlays.find(o=>o.id===selectedId) || null;
  const orientationConfirmed = !!selectedPage && !selectedPage.orientationNeedsReview && !!(selectedPage.orientationAccepted || selectedPlan?.orientationAccepted);
  const scaleConfirmed = !!selectedPage?.scale?.pixelsPerMetre && selectedPage.scale.accepted !== false;
  const ppm          = scaleConfirmed ? rawPpm : 0;
  const totals       = summarise(overlays, ppm);
  const setupReady = !!selectedPage && orientationConfirmed && scaleConfirmed;

  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = { ...project, jobId, plans, pages, updatedAt:new Date().toISOString() };
    setProject(p);
    saveProject(p);
    sheet?.updateTakeoffProject?.(p);
  }, [pages, plans]); // eslint-disable-line

  useEffect(() => {
    if (!setupReady && activeTool !== TOOLS.POINTER && activeTool !== TOOLS.PAN) {
      setActiveTool(TOOLS.POINTER);
      setCalibrating(null);
    }
  }, [activeTool, setupReady]);

  // ── PDF upload ─────────────────────────────────────────────────────────────
  const handlePagesChange = useCallback((newPages, filename) => {
    dispatch({ type:"SET_PAGES", pages:newPages });
    setProject(p=>({...p,pdfFilename:filename||p.pdfFilename}));
    setSelectedPageId((current) => newPages.some((page) => page.id === current) ? current : newPages[0]?.id || null);
    setSelectedId(null);
    setActiveTool(TOOLS.POINTER);
  }, []);

  const handlePlansChange = useCallback((newPlans) => {
    const safePlans = Array.isArray(newPlans) ? newPlans : [];
    setPlans(safePlans);
    sheet?.updatePlans?.(safePlans);
  }, [sheet]);

  // ── Scale ──────────────────────────────────────────────────────────────────
  const handleScaleChange = useCallback((scale) => {
    if (!selectedPageId) return;
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,scale,scaleNeedsReview:!scale?.accepted,scaleConfidence:scale?.confidence||pg.scaleConfidence||0}) });
    const page = pages.find((pg) => pg.id === selectedPageId);
    if (page?.planId) {
      const nextPlans = plans.map((plan) => plan.id === page.planId ? {
        ...plan,
        scale,
        scaleNeedsReview: !scale?.accepted,
        scaleConfidence: scale?.confidence || plan.scaleConfidence || 0,
      } : plan);
      setPlans(nextPlans);
      sheet?.updatePlans?.(nextPlans);
    }
  }, [pages, plans, selectedPageId, sheet]);

  const handleStartCalibration  = useCallback(() => { setCalibrating({points:[]}); }, []);
  const handleCancelCalibration = useCallback(() => { setCalibrating(null); }, []);
  const handleCalibrationPoint  = useCallback((pt) => {
    setCalibrating(prev=>({ points:[...(prev?.points||[]),pt].slice(0,2) }));
  }, []);

  // ── Overlays ───────────────────────────────────────────────────────────────
  const addOverlay = useCallback((ov) => {
    if (!selectedPageId) return;
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,overlays:[...(pg.overlays||[]),ov]}) });
    setSelectedId(ov.id);
    if (ov.type==="room") setRightTab("rooms");
  }, [selectedPageId]);

  const deleteOverlay = useCallback((id) => {
    if (!selectedPageId) return;
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,overlays:pg.overlays.filter(o=>o.id!==id)}) });
    if (selectedId===id) setSelectedId(null);
  }, [selectedPageId, selectedId]);

  const updateOverlay = useCallback((id, patch) => {
    if (!selectedPageId) return;
    dispatch({ type:"UPDATE_OVERLAY", pageId:selectedPageId, id, patch });
  }, [selectedPageId]);

  // ── Tool change ────────────────────────────────────────────────────────────
  const handleToolChange = useCallback((t) => {
    if (!setupReady && t !== TOOLS.POINTER && t !== TOOLS.PAN) {
      setAiMessage("Complete Plan Setup first: confirm orientation and scale before using takeoff tools.");
      return;
    }
    setActiveTool(t);
    if (t!==TOOLS.CALIBRATE) handleCancelCalibration();
    if (t===TOOLS.POINTER) setRightTab("properties");
    else if (t===TOOLS.ROOM) setRightTab("rooms");
  }, [handleCancelCalibration, setupReady]);

  // ── AI detection ──────────────────────────────────────────────────────────
  const analyseSinglePage = useCallback(async (page) => {
    if (!page?.imageDataUrl) return { detected: 0, message: "No plan image available." };
    const detectionPage = page;
    setAiMessage(`Analysing ${page.planFileName || `page ${page.pageNumber}`}...`);

    const result = await runDetection({
      imageDataUrl: detectionPage.imageDataUrl,
      imageWidth: detectionPage.naturalWidth,
      imageHeight: detectionPage.naturalHeight,
      scale: detectionPage.scale,
      level: detectionPage.level,
    });

    if (!result.connected) {
      return { detected: 0, message: result.message || "AI detection service is not connected yet." };
    }

    if (!result.overlays?.length) {
      return { detected: 0, message: result.message || "AI did not detect walls or rooms on the selected plan." };
    }

    dispatch({
      type: "PATCH_PAGE",
      pageId: page.id,
      fn: pg => ({
        ...pg,
        overlays:     [...(pg.overlays || []), ...result.overlays],
        roomAnalysis: { rooms: result.rooms || [], analyzedAt: new Date().toISOString() },
      }),
    });

    return {
      detected: result.overlays.length,
      message: result.message || `Detected ${result.overlays.length} items.`,
    };
  }, []);
  const handleAnalysePlan = useCallback(async () => {
    if (!pages.length) { setAiMessage("Upload plan files first."); return; }
    const pendingOrientationPlans = plans.filter((plan) => (
      plan.includedInTakeoff !== false
      && (plan.orientationNeedsReview || (!plan.orientationAccepted && Number(plan.orientationConfidence || 0) <= 0))
    ));
    if (pendingOrientationPlans.length) {
      setAiMessage("Choose and accept the upright orientation for each selected plan before running AI takeoff.");
      setRightTab("ai");
      return;
    }
    const includedPlanIds = new Set(plans.filter((plan) => plan.includedInTakeoff !== false).map((plan) => plan.id));
    const pagesToAnalyse = pages.filter((page) => !page.planId || includedPlanIds.has(page.planId));
    if (!pagesToAnalyse.length) { setAiMessage("Select at least one plan to include in AI takeoff."); return; }
    const pagesMissingScale = pagesToAnalyse.filter((page) => !(page.scale?.pixelsPerMetre > 0) || page.scale?.accepted === false);
    if (pagesMissingScale.length) {
      setAiMessage("Confirm the plan scale before running AI takeoff.");
      return;
    }

    setAnalysing(true);
    let detectedTotal = 0;
    const messages = [];
    for (const page of pagesToAnalyse) {
      const result = await analyseSinglePage(page);
      detectedTotal += result.detected || 0;
      if (result.message) messages.push(result.message);
    }
    setAiMessage(detectedTotal
      ? `AI analysed ${pagesToAnalyse.length} selected plan page${pagesToAnalyse.length === 1 ? "" : "s"} and added ${detectedTotal} suggestions.`
      : messages[0] || "AI did not detect takeoff items on the selected plans.");
    setRightTab("ai");
    setAnalysing(false);
  }, [analyseSinglePage, pages, plans]);

  const handleOrientPlan = useCallback(async () => {
    if (!selectedPage?.imageDataUrl) { setAiMessage("Upload a PDF plan first."); return; }
    setAnalysing(true);
    setAiMessage("Checking plan orientation...");
    const orientation = await runOrientationDetection({
      imageDataUrl: selectedPage.imageDataUrl,
      imageWidth: selectedPage.naturalWidth,
      imageHeight: selectedPage.naturalHeight,
    });
    if (!orientation.connected) {
      setAiMessage(orientation.message || "AI orientation service is not connected yet.");
      setAnalysing(false);
      return;
    }
    const rotationDegrees = normalizeRotationDegrees(orientation.rotationDegrees);
    if (!rotationDegrees) {
      setAiMessage(orientation.reason ? `Plan is already upright. ${orientation.reason}` : "Plan is already upright.");
      setAnalysing(false);
      return;
    }
    const rotatedPage = await rotateTakeoffPage(selectedPage, rotationDegrees);
    dispatch({
      type: "PATCH_PAGE",
      pageId: selectedPageId,
      fn: pg => ({
        ...pg,
        ...rotatedPage,
        orientationCorrection: {
          rotationDegrees,
          confidence: orientation.confidence || 0,
          reason: orientation.reason || "",
          correctedAt: new Date().toISOString(),
        },
      }),
    });
    setRotation(0);
    setAiMessage(`Rotated plan ${rotationDegrees} degrees. ${orientation.reason || ""}`.trim());
    setAnalysing(false);
  }, [selectedPage, selectedPageId, setRotation]);
  // Accept: change a single suggestion to "edited" (user-acknowledged, can still edit)
  const acceptSuggestion = useCallback((id) => {
    updateOverlay(id, { status: "edited" });
  }, [updateOverlay]);

  // Confirm: accept + lock as confirmed (counts toward measurements)
  const confirmSuggestion = useCallback((id) => {
    updateOverlay(id, { status: "confirmed" });
  }, [updateOverlay]);

  // Accept all high-confidence suggestions
  const acceptAllHigh = useCallback(() => {
    overlays.filter(o => o.status === "suggested" && o.confidence === "high" && o.source === "ai")
            .forEach(o => updateOverlay(o.id, { status: "edited" }));
  }, [overlays, updateOverlay]);

  // Delete all AI suggestions on this page
  const deleteAllSuggested = useCallback(() => {
    if (!selectedPageId) return;
    dispatch({
      type: "PATCH_PAGE",
      pageId: selectedPageId,
      fn: pg => ({ ...pg, overlays: (pg.overlays || []).filter(o => !(o.status === "suggested" && o.source === "ai")) }),
    });
  }, [selectedPageId]);

  const confirmedCount = overlays.filter(o=>o.status==="confirmed").length;
  const suggestedCount = overlays.filter(o=>o.status==="suggested" && o.source==="ai").length;

  return (
    <div style={S.root}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Toolbar */}
      <TakeoffToolbar
        activeTool={activeTool}     onToolChange={handleToolChange}
        snapEnabled={snapEnabled}   onToggleSnap={()=>setSnapEnabled(v=>!v)}
        onUndo={()=>dispatch({type:"UNDO"})} canUndo={state.undo.length>0}
        onRedo={()=>dispatch({type:"REDO"})} canRedo={state.redo.length>0}
        overlayCount={overlays.length}
        confirmedCount={confirmedCount}
        onAnalysePlan={handleAnalysePlan}
        onOrientPlan={handleOrientPlan}
        analysing={analysing}
        hasPage={pages.length>0}
        setupReady={setupReady}
      />

      {/* AI status banner */}
      {aiMessage && (
        <div style={S.aiBanner}>
          🤖 {aiMessage}
          <button style={S.aiBannerClose} onClick={()=>setAiMessage("")}>✕</button>
        </div>
      )}

      <div style={S.body}>

        {/* Left: PDF upload + scale */}
        <div style={S.left}>
          <PDFUploadPanel
            pages={pages}
            plans={plans}
            jobId={jobId}
            onPagesChange={handlePagesChange}
            onPlansChange={handlePlansChange}
            onSelectPage={id=>{setSelectedPageId(id);setSelectedId(null);}}
            selectedPageId={selectedPageId}
          />

          {selectedPage && (
            <>
              <div style={S.divider}/>
              <PlanSetupChecklist
                orientationConfirmed={orientationConfirmed}
                scaleConfirmed={scaleConfirmed}
                ready={setupReady}
                orientationConfidence={selectedPlan?.orientationConfidence ?? selectedPage.orientationCorrection?.confidence ?? 0}
                scaleConfidence={selectedPage.scale?.confidence ?? selectedPlan?.scaleConfidence ?? 0}
              />
              <div style={S.divider}/>
              <ScaleCalibrationPanel
                scale={selectedPage.scale}
                calibrating={calibrating}
                measuredFloorAreaM2={totals.floorAreaM2}
                onScaleChange={handleScaleChange}
                onStartCalibration={handleStartCalibration}
                onCancelCalibration={handleCancelCalibration}
              />
            </>
          )}

          {/* Takeoff summary */}
          {overlays.length > 0 && (
            <>
              <div style={S.divider}/>
              <Summary totals={totals} ppm={ppm}/>
            </>
          )}
        </div>

        {/* Centre: canvas */}
        <div style={S.centre}>
          <PlanCanvas
            page={selectedPage}
            tool={activeTool}
            overlays={overlays}
            selectedId={selectedId}
            calibrating={calibrating}
            snapEnabled={snapEnabled}
            onAddOverlay={addOverlay}
            onUpdateOverlay={updateOverlay}
            onDeleteOverlay={deleteOverlay}
            onSelectOverlay={id=>{setSelectedId(id);if(id)setRightTab("properties");}}
            onCalibrationPoint={handleCalibrationPoint}
            zoom={zoom}         setZoom={setZoom}
            pan={pan}           setPan={setPan}
            rotation={rotation} setRotation={setRotation}
          />
        </div>

        {/* Right: rooms / properties / AI review */}
        <div style={S.right}>
          <div style={S.rightTabs}>
            <button style={{...S.tab,...(rightTab==="rooms"?S.tabOn:{})}} onClick={()=>setRightTab("rooms")}>
              ⬡ Rooms{totals.rooms.length>0&&<span style={S.tabBadge}>{totals.rooms.length}</span>}
            </button>
            <button style={{...S.tab,...(rightTab==="properties"?S.tabOn:{})}} onClick={()=>setRightTab("properties")}>
              ↖ Properties
            </button>
            <button style={{...S.tab,...(rightTab==="ai"?S.tabOn:{})}} onClick={()=>setRightTab("ai")}>
              🤖 AI{suggestedCount>0&&<span style={{...S.tabBadge,background:"#fef9c3",color:"#92400e"}}>{suggestedCount}</span>}
            </button>
          </div>
          <div style={S.rightContent}>
            {rightTab==="rooms"&&(
              <RoomPanel
                overlays={overlays} ppm={ppm}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdate={updateOverlay}
              />
            )}
            {rightTab==="properties"&&(
              <ObjectPanel
                overlay={selectedOv} ppm={ppm}
                onUpdate={updateOverlay}
                onDelete={deleteOverlay}
              />
            )}
            {rightTab==="ai"&&(
              <AIReviewPanel
                overlays={overlays}
                aiRooms={selectedPage?.roomAnalysis?.rooms}
                ppm={ppm}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAccept={acceptSuggestion}
                onConfirm={confirmSuggestion}
                onDelete={deleteOverlay}
                onAcceptAllHigh={acceptAllHigh}
                onDeleteAllSuggested={deleteAllSuggested}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Takeoff summary (left panel) ──────────────────────────────────────────────

function Summary({ totals, ppm }) {
  const r2 = n => (n||0).toFixed(2);
  return (
    <div style={SS.wrap}>
      <div style={SS.title}>Takeoff Summary</div>
      {!ppm&&<div style={SS.noScale}>Set scale for measurements</div>}
      <SRow label="Ext Walls"    value={ppm?`${r2(totals.externalWallLM)} m`:"—"} />
      <SRow label="Int Walls"    value={ppm?`${r2(totals.internalWallLM)} m`:"—"} />
      <SRow label="Floor Area"   value={ppm?`${r2(totals.floorAreaM2)} m²`:"—"} />
      <SRow label="Doors"        value={`${totals.doorCount}`} />
      <SRow label="Windows"      value={`${totals.windowCount}`} />
      {totals.columnCount>0&&<SRow label="Columns" value={`${totals.columnCount}`} />}
    </div>
  );
}

function SRow({label,value}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"2px 0"}}>
      <span style={{color:"#64748b"}}>{label}</span>
      <span style={{fontWeight:700,color:"#0f172a"}}>{value}</span>
    </div>
  );
}

function PlanSetupChecklist({ orientationConfirmed, scaleConfirmed, ready, orientationConfidence = 0, scaleConfidence = 0 }) {
  return (
    <div style={SS.setupBox}>
      <div style={SS.setupTitle}>Plan Setup</div>
      <SetupRow done={orientationConfirmed} label="Orientation confirmed" detail={`${Math.round(Number(orientationConfidence || 0) * 100)}% confidence`} />
      <SetupRow done={scaleConfirmed} label="Scale confirmed" detail={scaleConfidence ? `${Math.round(Number(scaleConfidence || 0) * 100)}% confidence` : "confirm or measure scale"} />
      <SetupRow done={ready} label="Ready for takeoff" detail={ready ? "tools unlocked" : "tools locked"} />
    </div>
  );
}

function SetupRow({ done, label, detail }) {
  return (
    <div style={SS.setupRow}>
      <span style={done ? SS.setupDotDone : SS.setupDotTodo}>{done ? "OK" : "!"}</span>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

const SS = {
  wrap:    {display:"flex",flexDirection:"column",gap:3,padding:"8px 10px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"},
  title:   {fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2},
  noScale: {fontSize:11,color:"#d97706",fontStyle:"italic",marginBottom:2},
  setupBox: {display:"grid",gap:7,padding:10,background:"#f8fafc",borderRadius:8,border:"1.5px solid #cbd5e1"},
  setupTitle: {fontSize:12,fontWeight:900,color:"#0f172a",textTransform:"uppercase",letterSpacing:"0.05em"},
  setupRow: {display:"flex",gap:8,alignItems:"flex-start",fontSize:12,color:"#334155",lineHeight:1.35},
  setupDotDone: {display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:20,borderRadius:999,background:"#dcfce7",color:"#15803d",fontSize:10,fontWeight:900,flexShrink:0},
  setupDotTodo: {display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:20,borderRadius:999,background:"#fffbeb",color:"#92400e",fontSize:12,fontWeight:900,flexShrink:0},
};

const S = {
  root:          {display:"flex",flexDirection:"column",height:"calc(100vh - 120px)",minHeight:520,background:"#f8fafc",fontFamily:"'Manrope','Segoe UI',system-ui,sans-serif"},
  aiBanner:      {display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:"#faf5ff",borderBottom:"1.5px solid #e9d5ff",fontSize:12,color:"#6d28d9",flexShrink:0},
  aiBannerClose: {marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#9333ea"},
  body:          {display:"flex",flex:1,overflow:"hidden",minHeight:0},
  left:          {width:230,flexShrink:0,display:"flex",flexDirection:"column",gap:10,padding:12,background:"#fff",borderRight:"1.5px solid #e2e8f0",overflowY:"auto"},
  divider:       {height:1,background:"#e2e8f0"},
  centre:        {flex:1,overflow:"hidden",position:"relative",minWidth:0},
  right:         {width:270,flexShrink:0,display:"flex",flexDirection:"column",background:"#fff",borderLeft:"1.5px solid #e2e8f0",overflow:"hidden"},
  rightTabs:     {display:"flex",borderBottom:"1.5px solid #e2e8f0",flexShrink:0},
  tab:           {flex:1,padding:"8px 3px",border:"none",background:"#f8fafc",color:"#64748b",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:3},
  tabOn:         {background:"#fff",color:"#0f172a",borderBottom:"2px solid #2563eb"},
  tabBadge:      {fontSize:10,fontWeight:700,background:"#dbeafe",color:"#1d4ed8",padding:"0 5px",borderRadius:99},
  rightContent:  {flex:1,overflowY:"auto",padding:12,minHeight:0},
};

