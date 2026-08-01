import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { InclusionsSelectionsProjectBanner } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsProjectBanner";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import type { ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import { PROJECT_REQUIRED_MESSAGE, contextFromQuery, hrefForStage } from "../../src/modules/inclusions-selections/routing/stageNavigation";
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
  detail?: string;
};

const EXTERIOR_PRODUCT_TYPES: NavigatorTile[] = [
  { key: "bricks", label: "Bricks" },
  { key: "cladding", label: "Cladding" },
  { key: "roof", label: "Roof" },
  { key: "windows", label: "Windows" },
  { key: "entry-door", label: "Entry Door" },
  { key: "garage-door", label: "Garage Door" },
  { key: "roof-colour", label: "Roof Colour" },
  { key: "roof-material", label: "Roof Material" },
  { key: "fascia", label: "Fascia" },
  { key: "gutters", label: "Gutters" },
  { key: "downpipes", label: "Downpipes" },
  { key: "exterior-paint", label: "Exterior Paint" },
  { key: "lighting", label: "Lighting" },
  { key: "decking", label: "Decking" },
  { key: "balustrades", label: "Balustrades" },
  { key: "pool", label: "Pool" },
  { key: "driveway", label: "Driveway" },
  { key: "landscaping", label: "Landscaping" },
];

const INTERIOR_ROOMS: NavigatorTile[] = [
  { key: "kitchen", label: "Kitchen" },
  { key: "bathroom", label: "Bathrooms" },
  { key: "bedroom", label: "Bedrooms" },
  { key: "laundry", label: "Laundry" },
  { key: "living", label: "Living Areas" },
  { key: "media", label: "Media" },
  { key: "study", label: "Study" },
  { key: "garage", label: "Garage" },
];

const ROOM_PRODUCT_TYPES: Record<string, NavigatorTile[]> = {
  kitchen: [
    { key: "cabinetry", label: "Cabinetry" },
    { key: "benchtops", label: "Benchtops" },
    { key: "splashback", label: "Splashback" },
    { key: "sink", label: "Sink" },
    { key: "sink-mixer", label: "Sink Mixer" },
    { key: "oven", label: "Oven" },
    { key: "cooktop", label: "Cooktop" },
    { key: "rangehood", label: "Rangehood" },
    { key: "dishwasher", label: "Dishwasher" },
    { key: "microwave", label: "Microwave" },
    { key: "handles", label: "Handles" },
    { key: "lighting", label: "Lighting" },
  ],
  bathroom: [
    { key: "vanity", label: "Vanity" },
    { key: "basin", label: "Basin" },
    { key: "basin-mixer", label: "Basin Mixer" },
    { key: "mirror", label: "Mirror" },
    { key: "shower", label: "Shower" },
    { key: "shower-mixer", label: "Shower Mixer" },
    { key: "bath", label: "Bath" },
    { key: "toilet", label: "Toilet" },
    { key: "tiles", label: "Tiles" },
    { key: "accessories", label: "Accessories" },
  ],
  bedroom: [
    { key: "flooring", label: "Flooring" },
    { key: "paint", label: "Paint" },
    { key: "door", label: "Door" },
    { key: "door-handle", label: "Door Handle" },
    { key: "robe", label: "Robe" },
    { key: "robe-fitout", label: "Robe Fitout" },
    { key: "lighting", label: "Lighting" },
    { key: "power-points", label: "Power Points" },
    { key: "window-furnishings", label: "Window Furnishings" },
  ],
  laundry: [
    { key: "cabinetry", label: "Cabinetry" },
    { key: "benchtops", label: "Benchtops" },
    { key: "laundry-tub", label: "Laundry Tub" },
    { key: "laundry-mixer", label: "Laundry Mixer" },
    { key: "splashback", label: "Splashback" },
    { key: "flooring", label: "Flooring" },
    { key: "lighting", label: "Lighting" },
  ],
  living: [
    { key: "flooring", label: "Flooring" },
    { key: "paint", label: "Paint" },
    { key: "doors", label: "Doors" },
    { key: "door-hardware", label: "Door Hardware" },
    { key: "lighting", label: "Lighting" },
    { key: "window-furnishings", label: "Window Furnishings" },
  ],
  media: [
    { key: "flooring", label: "Flooring" },
    { key: "paint", label: "Paint" },
    { key: "lighting", label: "Lighting" },
    { key: "power-points", label: "Power Points" },
    { key: "audio-visual", label: "Audio Visual" },
  ],
  study: [
    { key: "flooring", label: "Flooring" },
    { key: "paint", label: "Paint" },
    { key: "door", label: "Door" },
    { key: "lighting", label: "Lighting" },
    { key: "power-points", label: "Power Points" },
  ],
  garage: [
    { key: "garage-door", label: "Garage Door" },
    { key: "garage-motor", label: "Garage Motor" },
    { key: "internal-door", label: "Internal Door" },
    { key: "floor-finish", label: "Floor Finish" },
    { key: "storage", label: "Storage" },
    { key: "lighting", label: "Lighting" },
    { key: "power", label: "Power" },
  ],
};

function tileInitials(label: string) {
  return label.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function AreaNavigatorStagePage() {
  const router = useRouter();
  const [state, setState] = useState<TemplateStageState | null>(null);
  const [mode, setMode] = useState<NavigatorMode>("start");
  const [selectedRoomKey, setSelectedRoomKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const context = useMemo<Partial<ProjectSelectionContext>>(() => contextFromQuery(router.query), [router.query]);
  const selectedRoom = INTERIOR_ROOMS.find((room) => room.key === selectedRoomKey);
  const roomProductTypes = selectedRoomKey ? ROOM_PRODUCT_TYPES[selectedRoomKey] ?? [] : [];

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
        <section className="requiredState">
          <h1>Choose an Area</h1>
          <p>{PROJECT_REQUIRED_MESSAGE}</p>
        </section>
        <style jsx global>{areaNavigatorStyles}</style>
      </main>
    );
  }

  return (
    <main className="areaNavigatorPage">
      <InclusionsSelectionsProjectBanner currentStage="templates" context={context} />
      <InclusionsSelectionsStageNav currentStage="templates" context={context} />
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
            <span>EX</span>
            <strong>Exterior</strong>
          </button>
          <button type="button" className="homeCard interiorCard" onClick={() => setMode("interior")}>
            <span>IN</span>
            <strong>Interior</strong>
          </button>
        </section>
      ) : null}

      {mode === "exterior" ? (
        <NavigatorTileGrid
          title="Exterior"
          tiles={EXTERIOR_PRODUCT_TYPES}
          backLabel="Choose Area"
          disabled={saving || !state}
          onBack={() => setMode("start")}
          onSelect={(tile) => openPicker("Exterior", tile.label)}
        />
      ) : null}

      {mode === "interior" ? (
        <NavigatorTileGrid
          title="Interior"
          tiles={INTERIOR_ROOMS}
          backLabel="Choose Area"
          disabled={saving || !state}
          onBack={() => setMode("start")}
          onSelect={(tile) => {
            setSelectedRoomKey(tile.key);
            setMode("room");
          }}
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
}: {
  title: string;
  tiles: NavigatorTile[];
  backLabel: string;
  disabled?: boolean;
  onBack: () => void;
  onSelect: (tile: NavigatorTile) => void;
}) {
  return (
    <section className="navigatorSection">
      <div className="sectionBar">
        <button type="button" className="backButton" onClick={onBack}>{backLabel}</button>
        <h2>{title}</h2>
      </div>
      <div className="tileGrid">
        {tiles.map((tile) => (
          <button key={tile.key} type="button" className="selectionTile" disabled={disabled} onClick={() => onSelect(tile)}>
            <span>{tileInitials(tile.label)}</span>
            <strong>{tile.label}</strong>
          </button>
        ))}
      </div>
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
    background: #ffffff;
    border: 1px solid #dfe6ef;
    border-radius: 8px;
    padding: 22px;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 36px;
    line-height: 1.1;
    letter-spacing: 0;
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
    min-height: 280px;
    padding: 26px;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 16px;
    font-size: 26px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  }
  .homeCard span,
  .selectionTile span {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    border-radius: 8px;
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 20px;
    font-weight: 900;
  }
  .homeCard:hover,
  .homeCard:focus-visible,
  .selectionTile:hover,
  .selectionTile:focus-visible {
    border-color: #2563eb;
    box-shadow: 0 14px 34px rgba(37, 99, 235, 0.14);
    outline: none;
  }
  .exteriorCard {
    background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
  }
  .interiorCard {
    background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
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
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 14px;
  }
  .selectionTile {
    min-height: 148px;
    padding: 18px;
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 14px;
    text-align: left;
    background: #ffffff;
  }
  .selectionTile strong {
    font-size: 18px;
  }
  .requiredState,
  .navigatorNotice,
  .loadingNote {
    background: #ffffff;
    border: 1px solid #dfe6ef;
    border-radius: 8px;
    padding: 18px;
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
