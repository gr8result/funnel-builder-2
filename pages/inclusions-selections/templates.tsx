import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { InclusionsSelectionsNoFileState } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsNoFileState";
import { InclusionsSelectionsProjectBanner } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsProjectBanner";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import type { ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import { contextFromQuery, hrefForStage } from "../../src/modules/inclusions-selections/routing/stageNavigation";
import {
  approvedSelectionAreas,
  approvedSelectionItemsForArea,
  loadApprovedSelectionMappings,
} from "../../lib/selections/quotationTemplateCsv";
import {
  loadTemplateStage,
  reconcileProjectRequirements,
  saveTemplateStage,
} from "../../src/modules/inclusions-selections/services/templateStageService";
import type { TemplateStageState } from "../../src/modules/inclusions-selections/services/templateStageService";

type NavigatorMode = "start" | "exterior" | "interior" | "room";

type NavigatorTile = {
  key: string;
  label: string;
  imageClass: string;
};

const EXTERIOR_PRODUCT_TYPES: NavigatorTile[] = [
  { key: "bricks", label: "Bricks", imageClass: "tileBricks" },
  { key: "cladding", label: "Cladding", imageClass: "tileCladding" },
  { key: "render", label: "Render", imageClass: "tileRender" },
  { key: "roof", label: "Roof", imageClass: "tileRoof" },
  { key: "roof-colour", label: "Roof Colour", imageClass: "tileRoofColour" },
  { key: "windows", label: "Windows", imageClass: "tileWindows" },
  { key: "entry-door", label: "Entry Door", imageClass: "tileEntryDoor" },
  { key: "garage-door", label: "Garage Door", imageClass: "tileGarageDoor" },
  { key: "gutters", label: "Gutters", imageClass: "tileGutters" },
  { key: "fascia", label: "Fascia", imageClass: "tileFascia" },
  { key: "lighting", label: "Lighting", imageClass: "tileLighting" },
  { key: "driveway", label: "Driveway", imageClass: "tileDriveway" },
  { key: "decking", label: "Decking", imageClass: "tileDecking" },
  { key: "balustrades", label: "Balustrades", imageClass: "tileBalustrades" },
  { key: "pool", label: "Pool", imageClass: "tilePool" },
  { key: "exterior-paint", label: "Exterior Paint", imageClass: "tileExteriorPaint" },
];

const INTERIOR_ROOMS: NavigatorTile[] = [
  { key: "kitchen", label: "Kitchen", imageClass: "tileKitchen" },
  { key: "bathroom", label: "Bathroom", imageClass: "tileBathroom" },
  { key: "ensuite", label: "Ensuite", imageClass: "tileEnsuite" },
  { key: "laundry", label: "Laundry", imageClass: "tileLaundry" },
  { key: "bedroom", label: "Bedrooms", imageClass: "tileBedroom" },
  { key: "living", label: "Living Areas", imageClass: "tileLiving" },
  { key: "media", label: "Media", imageClass: "tileMedia" },
  { key: "study", label: "Study", imageClass: "tileStudy" },
  { key: "garage", label: "Garage", imageClass: "tileGarage" },
];

const ROOM_PRODUCT_TYPES: Record<string, NavigatorTile[]> = {
  kitchen: [
    { key: "cabinetry", label: "Cabinetry", imageClass: "tileCabinetry" },
    { key: "cabinet-finish", label: "Cabinet Finish", imageClass: "tileCabinetFinish" },
    { key: "handles", label: "Handles", imageClass: "tileHandles" },
    { key: "benchtops", label: "Benchtops", imageClass: "tileBenchtops" },
    { key: "splashback", label: "Splashback", imageClass: "tileSplashback" },
    { key: "sink", label: "Sink", imageClass: "tileSink" },
    { key: "sink-mixer", label: "Sink Mixer", imageClass: "tileMixer" },
    { key: "oven", label: "Oven", imageClass: "tileOven" },
    { key: "cooktop", label: "Cooktop", imageClass: "tileCooktop" },
    { key: "rangehood", label: "Rangehood", imageClass: "tileRangehood" },
    { key: "dishwasher", label: "Dishwasher", imageClass: "tileDishwasher" },
    { key: "microwave", label: "Microwave", imageClass: "tileMicrowave" },
    { key: "lighting", label: "Lighting", imageClass: "tileLighting" },
    { key: "flooring", label: "Flooring", imageClass: "tileFlooring" },
    { key: "paint", label: "Paint", imageClass: "tilePaint" },
  ],
  bathroom: [
    { key: "vanity", label: "Vanity", imageClass: "tileVanity" },
    { key: "basin", label: "Basin", imageClass: "tileBasin" },
    { key: "basin-mixer", label: "Basin Mixer", imageClass: "tileMixer" },
    { key: "mirror", label: "Mirror", imageClass: "tileMirror" },
    { key: "shower", label: "Shower", imageClass: "tileShower" },
    { key: "shower-mixer", label: "Shower Mixer", imageClass: "tileMixer" },
    { key: "bath", label: "Bath", imageClass: "tileBath" },
    { key: "toilet", label: "Toilet", imageClass: "tileToilet" },
    { key: "tiles", label: "Tiles", imageClass: "tileTiles" },
    { key: "accessories", label: "Accessories", imageClass: "tileAccessories" },
  ],
  ensuite: [
    { key: "vanity", label: "Vanity", imageClass: "tileVanity" },
    { key: "basin", label: "Basin", imageClass: "tileBasin" },
    { key: "basin-mixer", label: "Basin Mixer", imageClass: "tileMixer" },
    { key: "mirror", label: "Mirror", imageClass: "tileMirror" },
    { key: "shower", label: "Shower", imageClass: "tileShower" },
    { key: "shower-mixer", label: "Shower Mixer", imageClass: "tileMixer" },
    { key: "toilet", label: "Toilet", imageClass: "tileToilet" },
    { key: "tiles", label: "Tiles", imageClass: "tileTiles" },
  ],
  bedroom: [
    { key: "flooring", label: "Flooring", imageClass: "tileFlooring" },
    { key: "paint", label: "Paint", imageClass: "tilePaint" },
    { key: "door", label: "Door", imageClass: "tileEntryDoor" },
    { key: "door-handle", label: "Door Handle", imageClass: "tileHandles" },
    { key: "robe", label: "Robe", imageClass: "tileRobe" },
    { key: "robe-fitout", label: "Robe Fitout", imageClass: "tileRobe" },
    { key: "lighting", label: "Lighting", imageClass: "tileLighting" },
    { key: "power-points", label: "Power Points", imageClass: "tilePower" },
    { key: "window-furnishings", label: "Window Furnishings", imageClass: "tileWindows" },
  ],
  laundry: [
    { key: "cabinetry", label: "Cabinetry", imageClass: "tileCabinetry" },
    { key: "benchtops", label: "Benchtops", imageClass: "tileBenchtops" },
    { key: "laundry-tub", label: "Laundry Tub", imageClass: "tileSink" },
    { key: "laundry-mixer", label: "Laundry Mixer", imageClass: "tileMixer" },
    { key: "splashback", label: "Splashback", imageClass: "tileSplashback" },
    { key: "flooring", label: "Flooring", imageClass: "tileFlooring" },
    { key: "lighting", label: "Lighting", imageClass: "tileLighting" },
  ],
  living: [
    { key: "flooring", label: "Flooring", imageClass: "tileFlooring" },
    { key: "paint", label: "Paint", imageClass: "tilePaint" },
    { key: "doors", label: "Doors", imageClass: "tileEntryDoor" },
    { key: "door-hardware", label: "Door Hardware", imageClass: "tileHandles" },
    { key: "lighting", label: "Lighting", imageClass: "tileLighting" },
    { key: "window-furnishings", label: "Window Furnishings", imageClass: "tileWindows" },
  ],
  media: [
    { key: "flooring", label: "Flooring", imageClass: "tileFlooring" },
    { key: "paint", label: "Paint", imageClass: "tilePaint" },
    { key: "lighting", label: "Lighting", imageClass: "tileLighting" },
    { key: "power-points", label: "Power Points", imageClass: "tilePower" },
    { key: "audio-visual", label: "Audio Visual", imageClass: "tileMedia" },
  ],
  study: [
    { key: "flooring", label: "Flooring", imageClass: "tileFlooring" },
    { key: "paint", label: "Paint", imageClass: "tilePaint" },
    { key: "door", label: "Door", imageClass: "tileEntryDoor" },
    { key: "lighting", label: "Lighting", imageClass: "tileLighting" },
    { key: "power-points", label: "Power Points", imageClass: "tilePower" },
  ],
  garage: [
    { key: "garage-door", label: "Garage Door", imageClass: "tileGarageDoor" },
    { key: "garage-motor", label: "Garage Motor", imageClass: "tileGarage" },
    { key: "internal-door", label: "Internal Door", imageClass: "tileEntryDoor" },
    { key: "floor-finish", label: "Floor Finish", imageClass: "tileDriveway" },
    { key: "storage", label: "Storage", imageClass: "tileRobe" },
    { key: "lighting", label: "Lighting", imageClass: "tileLighting" },
    { key: "power", label: "Power", imageClass: "tilePower" },
  ],
};

function imageClassForAreaLabel(label: string): string {
  const text = label.toLowerCase();
  if (text.includes("kitchen")) return "tileKitchen";
  if (text.includes("bath")) return "tileBathroom";
  if (text.includes("ensuite")) return "tileEnsuite";
  if (text.includes("laundry")) return "tileLaundry";
  if (text.includes("bed")) return "tileBedroom";
  if (text.includes("living")) return "tileLiving";
  if (text.includes("media")) return "tileMedia";
  if (text.includes("study")) return "tileStudy";
  if (text.includes("garage")) return "tileGarage";
  return "tileInterior";
}

function imageClassForSelectionLabel(label: string): string {
  const text = label.toLowerCase();
  if (text.includes("brick")) return "tileBricks";
  if (text.includes("cladding")) return "tileCladding";
  if (text.includes("roof")) return "tileRoof";
  if (text.includes("window")) return "tileWindows";
  if (text.includes("door") && text.includes("garage")) return "tileGarageDoor";
  if (text.includes("door")) return "tileEntryDoor";
  if (text.includes("gutter")) return "tileGutters";
  if (text.includes("fascia")) return "tileFascia";
  if (text.includes("light")) return "tileLighting";
  if (text.includes("driveway")) return "tileDriveway";
  if (text.includes("deck")) return "tileDecking";
  if (text.includes("balustrade")) return "tileBalustrades";
  if (text.includes("pool")) return "tilePool";
  if (text.includes("paint")) return "tilePaint";
  if (text.includes("oven")) return "tileOven";
  if (text.includes("cooktop")) return "tileCooktop";
  if (text.includes("rangehood")) return "tileRangehood";
  if (text.includes("dishwasher")) return "tileDishwasher";
  if (text.includes("microwave")) return "tileMicrowave";
  if (text.includes("sink")) return "tileSink";
  if (text.includes("mixer")) return "tileMixer";
  if (text.includes("tile")) return "tileTiles";
  if (text.includes("floor")) return "tileFlooring";
  return "tileExterior";
}

function queryStringFromContext(context: Partial<ProjectSelectionContext>): string {
  const params = new URLSearchParams();
  Object.entries(context).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function AreaNavigatorStagePage() {
  const router = useRouter();
  const [state, setState] = useState<TemplateStageState | null>(null);
  const [mode, setMode] = useState<NavigatorMode>("start");
  const [selectedRoomKey, setSelectedRoomKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [approvedMappings, setApprovedMappings] = useState<any[]>([]);

  const context = useMemo<Partial<ProjectSelectionContext>>(() => contextFromQuery(router.query), [router.query]);
  const approvedExteriorTiles = useMemo<NavigatorTile[]>(() => approvedSelectionItemsForArea(approvedMappings, "Exterior").map((item: any) => ({ key: item.key, label: item.label, imageClass: imageClassForSelectionLabel(item.label) })), [approvedMappings]);
  const approvedInteriorAreas = useMemo<NavigatorTile[]>(() => approvedSelectionAreas(approvedMappings)
    .filter((area: string) => area.toLowerCase() !== "exterior")
    .map((area: string) => ({ key: area.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: area, imageClass: imageClassForAreaLabel(area) })), [approvedMappings]);
  const selectedRoom = approvedInteriorAreas.find((room) => room.key === selectedRoomKey) ?? INTERIOR_ROOMS.find((room) => room.key === selectedRoomKey);
  const roomProductTypes = useMemo<NavigatorTile[]>(() => selectedRoom?.label
    ? approvedSelectionItemsForArea(approvedMappings, selectedRoom.label).map((item: any) => ({ key: item.key, label: item.label, imageClass: imageClassForSelectionLabel(item.label) }))
    : [], [approvedMappings, selectedRoom?.label]);

  useEffect(() => {
    if (!router.isReady || !context.organisationId || !context.projectId) return;
    let cancelled = false;
    loadTemplateStage(context as ProjectSelectionContext).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, context.organisationId, context.projectId]);

  useEffect(() => {
    if (!router.isReady) return;
    function refreshMappings() {
      setApprovedMappings(loadApprovedSelectionMappings(context));
    }
    refreshMappings();
    window.addEventListener("gr8:approved-selection-mappings-updated", refreshMappings);
    return () => window.removeEventListener("gr8:approved-selection-mappings-updated", refreshMappings);
  }, [router.isReady, context.organisationId, context.projectId]);

  async function openPicker(areaLabel: string, productType: string) {
    if (!state) return;
    setSaving(true);
    setError("");
    const reconciled = reconcileProjectRequirements(state);
    if (!reconciled.ok || !reconciled.value) {
      setSaving(false);
      setError("This project needs selection areas before products can be chosen.");
      return;
    }
    const saved = await saveTemplateStage(reconciled.value);
    setSaving(false);
    if (!saved.ok) {
      setError(saved.issues[0]?.message ?? "Could not prepare this area.");
      return;
    }
    const href = `${hrefForStage("workspace", state.context)}&area=${encodeURIComponent(areaLabel)}&productType=${encodeURIComponent(productType)}`;
    router.push(href);
  }

  if (router.isReady && (!context.organisationId || !context.projectId)) {
    return (
      <main className="areaNavigatorPage">
        <InclusionsSelectionsProjectBanner currentStage="templates" context={context} />
        <InclusionsSelectionsStageNav currentStage="templates" context={context} />
        <InclusionsSelectionsNoFileState context={context} />
        <style jsx global>{areaNavigatorStyles}</style>
      </main>
    );
  }

  return (
    <main className="areaNavigatorPage">
      <InclusionsSelectionsProjectBanner currentStage="templates" context={state?.context ?? context} />
      <InclusionsSelectionsStageNav currentStage="templates" context={state?.context ?? context} />
      <header className="navigatorHeader">
        <div>
          <h1>Choose an Area</h1>
          <p>Select the area of the home you want to complete.</p>
        </div>
      </header>

      {error ? <div className="navigatorNotice">{error}</div> : null}

      {mode === "start" ? (
        <section className="primaryChoiceGrid" aria-label="Choose Exterior or Interior">
          <button type="button" className="homeCard exteriorCard" onClick={() => setMode("exterior")}>
            <span className="tileImage tileExterior" aria-hidden="true" />
            <strong>Exterior</strong>
          </button>
          <button type="button" className="homeCard interiorCard" onClick={() => setMode("interior")}>
            <span className="tileImage tileInterior" aria-hidden="true" />
            <strong>Interior</strong>
          </button>
        </section>
      ) : null}

      {mode === "exterior" ? (
        <NavigatorTileGrid
          title="Exterior"
          tiles={approvedExteriorTiles}
          backLabel="Choose Area"
          disabled={saving || !state}
          onBack={() => setMode("start")}
          onSelect={(tile) => openPicker("Exterior", tile.label)}
          emptyMessage="No approved selection items have been uploaded for this area."
          onUpload={() => router.push(`/modules/estimate-builder${queryStringFromContext(context)}`)}
        />
      ) : null}

      {mode === "interior" ? (
        <NavigatorTileGrid
          title="Interior"
          tiles={approvedInteriorAreas}
          backLabel="Choose Area"
          disabled={saving || !state}
          onBack={() => setMode("start")}
          onSelect={(tile) => {
            setSelectedRoomKey(tile.key);
            setMode("room");
          }}
          emptyMessage="No approved selection items have been uploaded for this area."
          onUpload={() => router.push(`/modules/estimate-builder${queryStringFromContext(context)}`)}
        />
      ) : null}

      {mode === "room" && selectedRoom ? (
        <NavigatorTileGrid
          title={selectedRoom.label}
          tiles={roomProductTypes}
          backLabel="Interior"
          disabled={saving || !state}
          onBack={() => setMode("interior")}
          onSelect={(tile) => openPicker(selectedRoom.label, tile.label)}
          emptyMessage="No approved selection items have been uploaded for this area."
          onUpload={() => router.push(`/modules/estimate-builder${queryStringFromContext(context)}`)}
        />
      ) : null}

      {!state ? <p className="loadingNote">Loading project areas.</p> : null}
      <style jsx global>{areaNavigatorStyles}</style>
    </main>
  );
}

function NavigatorTileGrid({
  title,
  tiles,
  backLabel,
  disabled,
  onBack,
  onSelect,
  emptyMessage,
  onUpload,
}: {
  title: string;
  tiles: NavigatorTile[];
  backLabel: string;
  disabled?: boolean;
  onBack: () => void;
  onSelect: (tile: NavigatorTile) => void;
  emptyMessage?: string;
  onUpload?: () => void;
}) {
  return (
    <section className="navigatorSection">
      <div className="sectionBar">
        <button type="button" className="backButton" onClick={onBack}>{backLabel}</button>
        <h2>{title}</h2>
      </div>
      {tiles.length ? (
        <div className="tileGrid">
          {tiles.map((tile) => (
            <button key={tile.key} type="button" className="selectionTile" disabled={disabled} onClick={() => onSelect(tile)}>
              <span className={`tileImage ${tile.imageClass}`} aria-hidden="true" />
              <strong>{tile.label}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="emptyApprovedState">
          <p>{emptyMessage}</p>
          <div>
            {onUpload ? <button type="button" className="uploadButton" onClick={onUpload}>Upload Approved Selections CSV</button> : null}
            <button type="button" className="backButton" onClick={onBack}>Back</button>
          </div>
        </div>
      )}
    </section>
  );
}

const areaNavigatorStyles = `
  .areaNavigatorPage {
    min-height: 100vh;
    background: #f6f8fb;
    color: #172033;
    padding: 28px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .navigatorHeader,
  .primaryChoiceGrid,
  .navigatorSection,
  .requiredState,
  .navigatorNotice,
  .loadingNote {
    max-width: 1180px;
    margin: 0 auto 18px;
  }
  .navigatorHeader {
    padding: 8px 0 2px;
  }
  h1 {
    margin: 0;
    font-size: 42px;
    line-height: 1.1;
    letter-spacing: 0;
    text-transform: uppercase;
  }
  h2 {
    margin: 0;
    font-size: 28px;
    letter-spacing: 0;
  }
  p {
    margin: 0;
    color: #5c687a;
    line-height: 1.5;
  }
  button {
    min-height: 44px;
    border: 1px solid #d8e2ee;
    border-radius: 8px;
    background: #ffffff;
    color: #172033;
    cursor: pointer;
    font: inherit;
    font-weight: 800;
  }
  button:disabled {
    cursor: wait;
    opacity: 0.65;
  }
  .primaryChoiceGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }
  .homeCard {
    min-height: 360px;
    padding: 0;
    display: grid;
    grid-template-rows: 1fr auto;
    overflow: hidden;
    gap: 0;
    font-size: 30px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  }
  .homeCard strong,
  .selectionTile strong {
    display: block;
    padding: 18px;
    background: #ffffff;
  }
  .homeCard:hover,
  .homeCard:focus-visible,
  .selectionTile:hover,
  .selectionTile:focus-visible {
    border-color: #2563eb;
    box-shadow: 0 14px 34px rgba(37, 99, 235, 0.14);
    outline: none;
  }
  .navigatorSection {
    display: grid;
    gap: 16px;
  }
  .sectionBar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .backButton {
    padding: 10px 14px;
    color: #17406f;
  }
  .tileGrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 14px;
  }
  .selectionTile {
    min-height: 220px;
    padding: 0;
    display: grid;
    grid-template-rows: 1fr auto;
    overflow: hidden;
    gap: 0;
    text-align: left;
    background: #ffffff;
  }
  .selectionTile strong {
    font-size: 20px;
  }
  .tileImage {
    display: block;
    width: 100%;
    min-height: 160px;
    background-size: cover;
    background-position: center;
  }
  .homeCard .tileImage {
    min-height: 292px;
  }
  .tileExterior { background-image: linear-gradient(135deg, rgba(35,61,77,.2), rgba(217,158,86,.15)), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 360'%3E%3Crect width='600' height='360' fill='%23dfe8e2'/%3E%3Cpath d='M70 210 300 70l230 140v110H70z' fill='%23f8fafc'/%3E%3Cpath d='M300 70 60 220h480z' fill='%237c2d12'/%3E%3Crect x='125' y='220' width='70' height='90' fill='%239ca3af'/%3E%3Crect x='245' y='205' width='82' height='62' fill='%2393c5fd'/%3E%3Crect x='385' y='210' width='90' height='100' fill='%23cbd5e1'/%3E%3C/svg%3E"); }
  .tileInterior { background-image: linear-gradient(135deg, rgba(245,158,11,.16), rgba(20,184,166,.12)), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 360'%3E%3Crect width='600' height='360' fill='%23f3efe7'/%3E%3Crect x='70' y='70' width='460' height='230' rx='12' fill='%23ffffff'/%3E%3Crect x='105' y='105' width='160' height='120' fill='%23d1d5db'/%3E%3Crect x='305' y='105' width='165' height='130' fill='%23b7c7b2'/%3E%3Crect x='115' y='245' width='350' height='22' fill='%238b5e3c'/%3E%3C/svg%3E"); }
  .tileBricks { background-image: linear-gradient(135deg, #c66a4a, #7f1d1d); }
  .tileCladding { background-image: repeating-linear-gradient(90deg, #eef2f7 0 22px, #cbd5e1 22px 25px); }
  .tileRender, .tileExteriorPaint, .tilePaint { background-image: linear-gradient(135deg, #f8fafc, #dbeafe); }
  .tileRoof, .tileRoofColour { background-image: linear-gradient(135deg, #334155 0 45%, #64748b 45% 100%); }
  .tileWindows { background-image: linear-gradient(135deg, #dbeafe 0 48%, #93c5fd 48% 52%, #eff6ff 52%); }
  .tileEntryDoor, .tileGarageDoor, .tileGarage { background-image: linear-gradient(135deg, #92400e, #eab308); }
  .tileGutters, .tileFascia { background-image: linear-gradient(135deg, #475569, #e2e8f0); }
  .tileLighting { background-image: radial-gradient(circle at 50% 38%, #fde68a 0 18%, #fef3c7 19% 34%, #334155 35%); }
  .tileDriveway { background-image: linear-gradient(135deg, #94a3b8, #475569); }
  .tileDecking { background-image: repeating-linear-gradient(90deg, #8b5e3c 0 24px, #6b4423 24px 28px); }
  .tileBalustrades { background-image: repeating-linear-gradient(90deg, #f8fafc 0 14px, #94a3b8 14px 18px); }
  .tilePool { background-image: linear-gradient(135deg, #bae6fd, #0284c7); }
  .tileKitchen { background-image: linear-gradient(135deg, #f8fafc 0 35%, #d6d3d1 35% 70%, #78716c 70%); }
  .tileBathroom, .tileEnsuite, .tileShower, .tileToilet, .tileBasin, .tileBath, .tileVanity { background-image: linear-gradient(135deg, #eff6ff, #bfdbfe); }
  .tileLaundry, .tileSink, .tileMixer { background-image: linear-gradient(135deg, #f0fdfa, #99f6e4); }
  .tileBedroom { background-image: linear-gradient(135deg, #fee2e2, #fef3c7); }
  .tileLiving, .tileMedia { background-image: linear-gradient(135deg, #ede9fe, #ddd6fe); }
  .tileStudy { background-image: linear-gradient(135deg, #ecfccb, #bef264); }
  .tileCabinetry, .tileCabinetFinish, .tileHandles, .tileRobe { background-image: linear-gradient(135deg, #fed7aa, #a16207); }
  .tileBenchtops, .tileSplashback, .tileTiles, .tileMirror { background-image: linear-gradient(135deg, #f8fafc, #94a3b8); }
  .tileOven, .tileCooktop, .tileRangehood, .tileDishwasher, .tileMicrowave, .tilePower { background-image: linear-gradient(135deg, #e5e7eb, #111827); }
  .requiredState,
  .navigatorNotice,
  .loadingNote,
  .emptyApprovedState {
    background: #ffffff;
    border: 1px solid #dfe6ef;
    border-radius: 8px;
    padding: 18px;
  }
  .emptyApprovedState {
    display: grid;
    gap: 14px;
  }
  .emptyApprovedState div {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .uploadButton {
    padding: 10px 14px;
    background: #155e75;
    border-color: #155e75;
    color: #ffffff;
  }
  .navigatorNotice {
    border-color: #fecaca;
    color: #991b1b;
    background: #fff7f7;
  }
  @media (max-width: 820px) {
    .areaNavigatorPage {
      padding: 18px;
    }
    .primaryChoiceGrid {
      grid-template-columns: 1fr;
    }
    .homeCard {
      min-height: 190px;
    }
    .sectionBar {
      align-items: stretch;
      flex-direction: column;
    }
    .backButton {
      align-self: start;
    }
  }
  @media (max-width: 560px) {
    h1 {
      font-size: 30px;
    }
    h2 {
      font-size: 24px;
    }
    .tileGrid {
      grid-template-columns: 1fr;
    }
    .selectionTile {
      min-height: 104px;
    }
  }
`;
