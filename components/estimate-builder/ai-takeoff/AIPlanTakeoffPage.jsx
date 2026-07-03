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
import { saveProject, loadByJobId, summarise, getPixelsPerUnit } from "./takeoffUtils";
import { runDetection } from "./aiDetectionService";
import { renderPdfDataUrlPage, normalizePlanRotation } from "./pdfPlanRendering";

// ── Reducer: pages array with undo/redo ───────────────────────────────────────

const initState = (pages) => ({ pages, undo:[], redo:[] });

function getPageRotation(page) {
  return normalizePlanRotation(page?.planRotation || 0);
}

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

    case "PATCH_PAGE_SILENT": {
      let changed = false;
      const pages = state.pages.map(pg => {
        if (pg.id !== action.pageId) return pg;
        const next = action.fn(pg);
        if (next !== pg) changed = true;
        return next;
      });
      return changed ? { ...state, pages } : state;
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
  const [calibrating,    setCalibrating]    = useState(null);
  const [rightTab,       setRightTab]       = useState("rooms"); // "rooms" | "properties" | "ai"

  // ── AI detection state ─────────────────────────────────────────────────────
  const [analysing,  setAnalysing]  = useState(false);
  const [aiMessage,  setAiMessage]  = useState("");

  const [zoom,     setZoom]     = useState(1);
  const selectedPage = pages.find(p=>p.id===selectedPageId) || pages[0] || null;
  const rawPpm       = getPixelsPerUnit(selectedPage?.scale);
  const overlays     = selectedPage?.overlays || [];
  const selectedOv   = overlays.find(o=>o.id===selectedId) || null;
  const scaleConfirmed = getPixelsPerUnit(selectedPage?.scale) > 0 && selectedPage.scale.accepted !== false;
  const ppm          = scaleConfirmed ? rawPpm : 0;
  const totals       = summarise(overlays, ppm);
  const setupReady = !!selectedPage && scaleConfirmed;

  useEffect(() => {
    const savedZoom = Number(selectedPage?.viewState?.zoom);
    setZoom(Number.isFinite(savedZoom) && savedZoom > 0 ? savedZoom : 1);
  }, [selectedPage?.id]);

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

  const handleViewStateChange = useCallback((viewState) => {
    if (!selectedPageId || !viewState) return;
    dispatch({
      type: "PATCH_PAGE_SILENT",
      pageId: selectedPageId,
      fn: (pg) => {
        const nextZoom = Number(viewState.zoom);
        const nextPan = viewState.pan || {};
        const next = {
          zoom: Number.isFinite(nextZoom) && nextZoom > 0 ? nextZoom : 1,
          pan: {
            x: Number.isFinite(Number(nextPan.x)) ? Number(nextPan.x) : 32,
            y: Number.isFinite(Number(nextPan.y)) ? Number(nextPan.y) : 32,
          },
        };
        const current = pg.viewState || {};
        if (current.zoom === next.zoom && current.pan?.x === next.pan.x && current.pan?.y === next.pan.y) return pg;
        return { ...pg, viewState: next };
      },
    });
  }, [selectedPageId]);

  const renderSelectedPageRotation = useCallback(async (page, nextRotation) => {
    const planRotation = normalizePlanRotation(nextRotation);
    const fileName = `${page?.originalFileName || page?.planFileName || ""}`.toLowerCase();
    const isPdf = Boolean(page?.originalFileUrl && fileName.endsWith(".pdf"));
    if (!isPdf) return { planRotation };

    const rendered = await renderPdfDataUrlPage(page.originalFileUrl, page.pageNumber || 1, planRotation, 2.0);
    return {
      imageDataUrl: rendered.dataUrl,
      naturalWidth: rendered.width,
      naturalHeight: rendered.height,
      originalWidth: rendered.width,
      originalHeight: rendered.height,
      normalisedImageData: rendered.dataUrl,
      normalisedImageUrl: rendered.dataUrl,
      planRotation: rendered.planRotation,
    };
  }, []);

  const rotateSelectedPage = useCallback(async (deltaDegrees) => {
    if (!selectedPageId) return;
    const currentPage = pages.find((page) => page.id === selectedPageId);
    if (!currentPage) return;
    const nextRotation = normalizePlanRotation(getPageRotation(currentPage) + deltaDegrees);
    const patch = await renderSelectedPageRotation(currentPage, nextRotation);
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,...patch}) });

    if (currentPage.planId) {
      const nextPlans = plans.map((plan) => plan.id === currentPage.planId ? {
        ...plan,
        planRotation: patch.planRotation,
        fileUrl: patch.imageDataUrl || plan.fileUrl,
        normalisedImageData: patch.normalisedImageData || plan.normalisedImageData,
        normalisedImageUrl: patch.normalisedImageUrl || plan.normalisedImageUrl,
        originalWidth: patch.originalWidth || plan.originalWidth,
        originalHeight: patch.originalHeight || plan.originalHeight,
      } : plan);
      setPlans(nextPlans);
      sheet?.updatePlans?.(nextPlans);
    }
  }, [pages, plans, renderSelectedPageRotation, selectedPageId, sheet]);

  const resetSelectedPageRotation = useCallback(async () => {
    if (!selectedPageId) return;
    const currentPage = pages.find((page) => page.id === selectedPageId);
    if (!currentPage) return;
    const patch = await renderSelectedPageRotation(currentPage, 0);
    dispatch({ type:"PATCH_PAGE", pageId:selectedPageId, fn:pg=>({...pg,...patch}) });

    if (currentPage.planId) {
      const nextPlans = plans.map((plan) => plan.id === currentPage.planId ? {
        ...plan,
        planRotation: 0,
        fileUrl: patch.imageDataUrl || plan.fileUrl,
        normalisedImageData: patch.normalisedImageData || plan.normalisedImageData,
        normalisedImageUrl: patch.normalisedImageUrl || plan.normalisedImageUrl,
        originalWidth: patch.originalWidth || plan.originalWidth,
        originalHeight: patch.originalHeight || plan.originalHeight,
      } : plan);
      setPlans(nextPlans);
      sheet?.updatePlans?.(nextPlans);
    }
  }, [pages, plans, renderSelectedPageRotation, selectedPageId, sheet]);

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
      setAiMessage("Confirm the plan scale before using takeoff tools.");
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
    const includedPlanIds = new Set(plans.filter((plan) => plan.includedInTakeoff !== false).map((plan) => plan.id));
    const pagesToAnalyse = pages.filter((page) => !page.planId || includedPlanIds.has(page.planId));
    if (!pagesToAnalyse.length) { setAiMessage("Select at least one plan to include in AI takeoff."); return; }
    const pagesMissingScale = pagesToAnalyse.filter((page) => !(getPixelsPerUnit(page.scale) > 0) || page.scale?.accepted === false);
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
      {/* Toolbar */}
      <TakeoffToolbar
        activeTool={activeTool}     onToolChange={handleToolChange}
        onUndo={()=>dispatch({type:"UNDO"})} canUndo={state.undo.length>0}
        onRedo={()=>dispatch({type:"REDO"})} canRedo={state.redo.length>0}
        overlayCount={overlays.length}
        confirmedCount={confirmedCount}
        onAnalysePlan={handleAnalysePlan}
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
            onAddOverlay={addOverlay}
            onUpdateOverlay={updateOverlay}
            onDeleteOverlay={deleteOverlay}
            onSelectOverlay={id=>{setSelectedId(id);if(id)setRightTab("properties");}}
            onCalibrationPoint={handleCalibrationPoint}
            zoom={zoom}         setZoom={setZoom}
            viewState={selectedPage?.viewState}
            onViewStateChange={handleViewStateChange}
            onRotateLeft={()=>rotateSelectedPage(270)}
            onRotateRight={()=>rotateSelectedPage(90)}
            onResetRotation={resetSelectedPageRotation}
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

const SS = {
  wrap:    {display:"flex",flexDirection:"column",gap:3,padding:"8px 10px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"},
  title:   {fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2},
  noScale: {fontSize:11,color:"#d97706",fontStyle:"italic",marginBottom:2},
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

