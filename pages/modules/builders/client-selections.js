import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  CopyCheck,
  FolderTree,
  Home,
  ListChecks,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Users,
} from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const STORAGE_KEY = "client_selections_top_down_stage1";
const TEMPLATE_TIERS = ["Premium", "Premier", "Classic", "Custom"];
const FLOOR_LEVELS = ["Ground floor", "First floor", "Second floor", "Basement", "External"];
const DEFAULT_TEMPLATE_TIER = "Premier";

const AREA_GROUPS = [
  {
    title: "External areas",
    type: "external",
    defaultFloor: "External",
    areas: ["Exterior", "Front facade", "Rear exterior", "Alfresco", "Patio", "Porch", "Balcony", "Deck", "Pool area", "Pool house", "Outdoor kitchen", "Courtyard", "Driveway", "Paths", "Landscaping selections", "Retaining walls", "Fencing", "External stairs", "External lighting"],
  },
  {
    title: "Garage and utility areas",
    type: "utility",
    defaultFloor: "Ground floor",
    areas: ["Single garage", "Double garage", "Triple garage", "Workshop", "Carport", "Storage room", "Plant room", "Mud room"],
  },
  {
    title: "Living areas",
    type: "living",
    defaultFloor: "Ground floor",
    areas: ["Entry", "Foyer", "Living room", "Family room", "Lounge", "Media room", "Theatre room", "Rumpus room", "Games room", "Dining room", "Study", "Home office", "Library", "Activity room", "Retreat", "Upper living", "Hallways", "Internal stairs"],
  },
  {
    title: "Kitchen and food preparation",
    type: "kitchen",
    defaultFloor: "Ground floor",
    areas: ["Main kitchen", "Butler's pantry", "Walk-in pantry", "Scullery", "Upper kitchenette", "Secondary kitchen", "Bar", "Cellar"],
  },
  {
    title: "Bedrooms",
    type: "bedroom",
    defaultFloor: "Ground floor",
    areas: ["Master bedroom", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Bedroom 6", "Guest bedroom", "Nursery"],
  },
  {
    title: "Wet areas",
    type: "wet_area",
    defaultFloor: "Ground floor",
    areas: ["Main bathroom", "Ensuite", "Ensuite 2", "Ensuite 3", "Powder room", "WC", "Laundry", "Mud room wash area", "Pool bathroom", "Outdoor bathroom"],
  },
  {
    title: "Wardrobes and storage",
    type: "wardrobe",
    defaultFloor: "Ground floor",
    areas: ["Walk-in robe", "Walk-in robe 2", "Built-in robe", "Linen cupboard", "Broom cupboard", "General storage", "Under-stair storage"],
  },
  {
    title: "Other rooms",
    type: "custom",
    defaultFloor: "Ground floor",
    areas: ["Custom area", "Custom room", "Custom external zone"],
  },
];

const TEMPLATE_LIBRARY = {
  bedroom: ["Flooring", "Carpet colour", "Internal door", "Door handle", "Paint colour", "Ceiling fan", "Power points", "Robe doors", "Robe fitout"],
  wet_area: ["Tapware range", "Tapware finish", "Toilet", "Basin", "Shower hardware", "Accessories", "Floor tile", "Wall tile", "Grout", "Mirror", "Cabinet finish", "Handles", "Benchtop"],
  kitchen: ["Oven", "Cooktop", "Rangehood", "Dishwasher", "Sink", "Mixer", "Cabinet profile", "Cabinet colour", "Handles", "Benchtop", "Splashback", "Pantry fitout", "Lighting", "Flooring"],
  living: ["Flooring", "Skirting", "Internal door", "Door handle", "Paint colour", "Lighting", "Power points", "Window furnishings"],
  external: ["Roof system", "Roof profile", "Roof colour", "Gutters", "Fascia", "Downpipes", "Cladding", "External paint", "External lighting", "External tiles or paving"],
  utility: ["Flooring", "Internal door", "Door handle", "Paint colour", "Lighting", "Power points", "Storage fitout"],
  wardrobe: ["Robe doors", "Robe internals", "Handles", "Lighting", "Paint colour"],
  custom: ["Selection item", "Finish", "Colour"],
};

const DEFAULT_GROUP_TYPES = [
  { name: "Bedrooms", groupType: "Bedrooms", areaType: "bedroom" },
  { name: "Wet areas", groupType: "Wet areas", areaType: "wet_area" },
  { name: "Living areas", groupType: "Living areas", areaType: "living" },
  { name: "Kitchens", groupType: "Kitchens", areaType: "kitchen" },
  { name: "External areas", groupType: "External areas", areaType: "external" },
  { name: "Garages", groupType: "Garages", areaType: "utility" },
  { name: "Wardrobes", groupType: "Wardrobes", areaType: "wardrobe" },
];

const TEMPLATE_DEFAULTS = {
  bedroom: {
    Premier: {
      flooring: "Premier carpet range",
      carpet_colour: "Client selected colour",
      internal_door: "Premier internal door",
      door_handle: "Brushed nickel lever set",
      paint_colour: "Whole-house wall colour",
    },
  },
  wet_area: {
    Premier: {
      tapware_range: "Caroma Luna",
      tapware_finish: "Brushed Nickel",
      toilet: "Premier close coupled suite",
      basin: "Semi inset basin",
      floor_tile: "Premier porcelain floor tile",
      wall_tile: "Premier ceramic wall tile",
    },
  },
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function categoryObjects(type) {
  return (TEMPLATE_LIBRARY[type] || TEMPLATE_LIBRARY.custom).map((name, index) => ({
    id: slug(name),
    name,
    required: index < Math.max(3, Math.min(8, (TEMPLATE_LIBRARY[type] || []).length)),
    sortOrder: index + 1,
  }));
}

function emptyState() {
  const areas = [];
  let order = 1;
  AREA_GROUPS.forEach((group) => {
    group.areas.forEach((name) => {
      areas.push({
        id: uid("area"),
        name,
        type: group.type,
        floor: group.defaultFloor,
        quantity: 1,
        groupId: "",
        included: false,
        required: true,
        displayOrder: order,
        notes: "",
        template: null,
        overrides: {},
      });
      order += 1;
    });
  });
  return {
    areas,
    groups: DEFAULT_GROUP_TYPES.map((group) => ({ id: uid("group"), ...group, memberRoomIds: [], sharedSelections: {}, template: null })),
    activeRoomId: "",
    activeGroupId: "",
    updatedAt: new Date().toISOString(),
  };
}

function normaliseState(value) {
  const base = emptyState();
  if (!value || typeof value !== "object") return base;
  const areas = Array.isArray(value.areas) ? value.areas : base.areas;
  const groups = Array.isArray(value.groups) ? value.groups : base.groups;
  return {
    ...base,
    ...value,
    areas: areas.map((area, index) => ({
      ...area,
      id: area.id || uid("area"),
      quantity: Number(area.quantity || 1),
      displayOrder: Number(area.displayOrder || index + 1),
      overrides: area.overrides || {},
    })),
    groups: groups.map((group) => ({
      ...group,
      id: group.id || uid("group"),
      memberRoomIds: Array.isArray(group.memberRoomIds) ? group.memberRoomIds : [],
      sharedSelections: group.sharedSelections || {},
    })),
  };
}

function selectionSource(room, group, categoryId) {
  if (room?.overrides?.[categoryId]) return { type: "override", value: room.overrides[categoryId].value };
  if (group?.sharedSelections?.[categoryId]) return { type: "inherited", value: group.sharedSelections[categoryId].value };
  if (room?.template?.defaults?.[categoryId]) return { type: "template", value: room.template.defaults[categoryId] };
  return { type: "missing", value: "" };
}

export default function BuilderClientSelectionsPage() {
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [session, setSession] = useState(null);
  const [state, setState] = useState(() => emptyState());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const includedRooms = useMemo(
    () => state.areas.filter((area) => area.included).sort((a, b) => a.displayOrder - b.displayOrder),
    [state.areas]
  );
  const activeRoom = includedRooms.find((room) => room.id === state.activeRoomId) || includedRooms[0] || null;
  const activeGroup = state.groups.find((group) => group.id === (activeRoom?.groupId || state.activeGroupId)) || null;
  const activeCategories = activeRoom ? categoryObjects(activeRoom.type) : [];

  const projectProgress = useMemo(() => {
    let required = 0;
    let complete = 0;
    includedRooms.forEach((room) => {
      const group = state.groups.find((entry) => entry.id === room.groupId);
      categoryObjects(room.type).forEach((category) => {
        if (!category.required) return;
        required += 1;
        if (selectionSource(room, group, category.id).value) complete += 1;
      });
    });
    return {
      required,
      complete,
      percent: required ? Math.round((complete / required) * 100) : 0,
    };
  }, [includedRooms, state.groups]);

  useEffect(() => {
    if (!workspaceId && !workspaceLoading) {
      setProjects([{ id: "demo-project", project_name: "Demo Project - Client Selections Stage 1", client_name: "Demo client" }]);
      setSelectedProjectId("demo-project");
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      setState(normaliseState(saved ? JSON.parse(saved) : null));
      setSession(null);
      return;
    }
    if (!workspaceId) return;
    let cancelled = false;
    async function loadProjects() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("builder_commercial_projects")
        .select("id, project_name, client_name, site_address, status, updated_at")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (loadError) {
        setError(loadError.message || "Could not load projects.");
        setProjects([]);
      } else {
        const rows = data || [];
        setProjects(rows);
        setSelectedProjectId((current) => rows.find((project) => project.id === current)?.id || rows[0]?.id || "");
      }
      setLoading(false);
    }
    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceLoading]);

  useEffect(() => {
    if (!workspaceId && selectedProjectId === "demo-project") {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      setState(normaliseState(saved ? JSON.parse(saved) : null));
      return;
    }
    if (!workspaceId || !selectedProjectId) return;
    let cancelled = false;
    async function loadSelectionStructure() {
      setLoading(true);
      setMessage("");
      setError("");
      const { data, error: loadError } = await supabase
        .from("builder_selection_sessions")
        .select("id, project_id, session_name, status, metadata, created_at, updated_at")
        .eq("workspace_id", workspaceId)
        .eq("project_id", selectedProjectId)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (loadError) {
        setError(loadError.message || "Could not load Client Selections structure.");
        setSession(null);
        setState(emptyState());
      } else {
        const existing = (data || []).find((row) => row.metadata?.architecture === "project_areas_room_templates") || (data || [])[0] || null;
        setSession(existing);
        setState(normaliseState(existing?.metadata?.[STORAGE_KEY]));
      }
      setLoading(false);
    }
    loadSelectionStructure();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedProjectId]);

  function updateState(updater) {
    setState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }

  function toggleArea(areaId) {
    updateState((current) => {
      const areas = current.areas.map((area) => {
        if (area.id !== areaId) return area;
        const included = !area.included;
        return { ...area, included, groupId: included ? area.groupId : "" };
      });
      return { ...current, areas };
    });
  }

  function updateArea(areaId, patch) {
    updateState((current) => ({
      ...current,
      areas: current.areas.map((area) => (area.id === areaId ? { ...area, ...patch } : area)),
    }));
  }

  function addRoom(type = "bedroom") {
    const group = AREA_GROUPS.find((entry) => entry.type === type) || AREA_GROUPS[AREA_GROUPS.length - 1];
    const count = state.areas.filter((area) => area.type === type).length + 1;
    const room = {
      id: uid("area"),
      name: type === "bedroom" ? `Bedroom ${count}` : "Custom room",
      type,
      floor: group.defaultFloor,
      quantity: 1,
      groupId: "",
      included: true,
      required: true,
      displayOrder: state.areas.length + 1,
      notes: "",
      template: null,
      overrides: {},
    };
    updateState((current) => ({ ...current, areas: [...current.areas, room], activeRoomId: room.id }));
  }

  function assignGroup(roomId, groupId) {
    updateState((current) => ({
      ...current,
      areas: current.areas.map((area) => (area.id === roomId ? { ...area, groupId } : area)),
      groups: current.groups.map((group) => ({
        ...group,
        memberRoomIds: group.id === groupId
          ? Array.from(new Set([...group.memberRoomIds, roomId]))
          : group.memberRoomIds.filter((id) => id !== roomId),
      })),
      activeGroupId: groupId,
    }));
  }

  function autoGroup(areaType, groupName) {
    const group = state.groups.find((entry) => entry.groupType === groupName) || state.groups.find((entry) => entry.areaType === areaType);
    if (!group) return;
    updateState((current) => {
      const ids = current.areas.filter((area) => area.included && area.type === areaType).map((area) => area.id);
      return {
        ...current,
        areas: current.areas.map((area) => (ids.includes(area.id) ? { ...area, groupId: group.id } : area)),
        groups: current.groups.map((entry) => (entry.id === group.id ? { ...entry, memberRoomIds: ids } : entry)),
        activeGroupId: group.id,
      };
    });
  }

  function createGroup() {
    const group = { id: uid("group"), name: "Custom group", groupType: "Custom group", areaType: "custom", memberRoomIds: [], sharedSelections: {}, template: null };
    updateState((current) => ({ ...current, groups: [...current.groups, group], activeGroupId: group.id }));
  }

  function updateGroup(groupId, patch) {
    updateState((current) => ({
      ...current,
      groups: current.groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    }));
  }

  function applyTemplateToGroup(groupId, tier = DEFAULT_TEMPLATE_TIER) {
    updateState((current) => {
      const group = current.groups.find((entry) => entry.id === groupId);
      if (!group) return current;
      const defaults = TEMPLATE_DEFAULTS[group.areaType]?.[tier] || {};
      const template = {
        id: `${slug(tier)}_${group.areaType}_template`,
        name: `${tier} ${group.groupType === "Wet areas" ? "Wet-area" : group.areaType.replace("_", " ")} template`,
        tier,
        version: "1.0",
        source: "stage_1_template_library",
        dateApplied: new Date().toISOString(),
        defaults,
      };
      return {
        ...current,
        groups: current.groups.map((entry) => (entry.id === groupId ? { ...entry, template } : entry)),
        areas: current.areas.map((area) => (group.memberRoomIds.includes(area.id) ? { ...area, template } : area)),
      };
    });
  }

  function applyTemplateToRoom(roomId, tier = DEFAULT_TEMPLATE_TIER) {
    updateState((current) => ({
      ...current,
      areas: current.areas.map((area) => {
        if (area.id !== roomId) return area;
        const defaults = TEMPLATE_DEFAULTS[area.type]?.[tier] || {};
        return {
          ...area,
          template: {
            id: `${slug(tier)}_${area.type}_template`,
            name: `${tier} ${area.type.replace("_", " ")} template`,
            tier,
            version: "1.0",
            source: "stage_1_template_library",
            dateApplied: new Date().toISOString(),
            defaults,
          },
        };
      }),
    }));
  }

  function updateGroupSelection(groupId, categoryId, value) {
    updateState((current) => ({
      ...current,
      groups: current.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          sharedSelections: {
            ...group.sharedSelections,
            [categoryId]: {
              id: uid("group_selection"),
              categoryId,
              value,
              priceEffect: 0,
              inheritedByRooms: group.memberRoomIds,
              changedAt: new Date().toISOString(),
            },
          },
        };
      }),
    }));
  }

  function overrideRoomSelection(roomId, categoryId, value) {
    updateState((current) => ({
      ...current,
      areas: current.areas.map((area) => {
        if (area.id !== roomId) return area;
        const group = current.groups.find((entry) => entry.id === area.groupId);
        const original = group?.sharedSelections?.[categoryId]?.value || area.template?.defaults?.[categoryId] || "";
        return {
          ...area,
          overrides: {
            ...area.overrides,
            [categoryId]: {
              id: uid("room_override"),
              categoryId,
              value,
              originalGroupValue: original,
              reason: "Room-specific client selection",
              changedAt: new Date().toISOString(),
            },
          },
        };
      }),
    }));
  }

  function restoreRoomSelection(roomId, categoryId) {
    updateState((current) => ({
      ...current,
      areas: current.areas.map((area) => {
        if (area.id !== roomId) return area;
        const overrides = { ...area.overrides };
        delete overrides[categoryId];
        return { ...area, overrides };
      }),
    }));
  }

  async function saveStructure() {
    if (!workspaceId && selectedProjectId === "demo-project") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setMessage("Saved locally for the demo project. Refresh the page to confirm the structure reloads.");
      return;
    }
    if (!workspaceId || !selectedProjectId) return;
    setSaving(true);
    setError("");
    setMessage("");
    const metadata = {
      ...(session?.metadata || {}),
      architecture: "project_areas_room_templates",
      [STORAGE_KEY]: state,
      deletion_report: {
        removedPrimaryInterface: "Flat budget/product row Client Selections page",
        preservedTables: ["builder_client_selections", "builder_selection_sessions", "builder_products", "builder_product_categories", "builder_estimate_snapshots", "builder_variations"],
        migrationPath: "Existing selections remain in builder_client_selections and can be migrated into room/category entities.",
        updatedAt: new Date().toISOString(),
      },
    };
    if (session?.id) {
      const { data, error: updateError } = await supabase
        .from("builder_selection_sessions")
        .update({ metadata, session_name: "Client Selections - Project Areas and Rooms", status: "setup_in_progress", updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("id", session.id)
        .select("id, project_id, session_name, status, metadata, created_at, updated_at")
        .single();
      if (updateError) setError(updateError.message || "Could not save Client Selections structure.");
      else {
        setSession(data);
        setMessage("Saved. Project areas, groups, templates and overrides will reload with this project.");
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("builder_selection_sessions")
        .insert({
          workspace_id: workspaceId,
          project_id: selectedProjectId,
          session_name: "Client Selections - Project Areas and Rooms",
          status: "setup_in_progress",
          metadata,
        })
        .select("id, project_id, session_name, status, metadata, created_at, updated_at")
        .single();
      if (insertError) setError(insertError.message || "Could not create Client Selections structure.");
      else {
        setSession(data);
        setMessage("Created and saved the top-down Client Selections structure.");
      }
    }
    setSaving(false);
  }

  return (
    <>
      <Head>
        <title>Client Selections | Project Areas and Rooms</title>
      </Head>
      <main className="screen">
        <header className="topbar">
          <div>
            <p className="eyebrow">Client Selections</p>
            <h1>Project Areas and Rooms</h1>
            <p className="subcopy">Project first, then areas, room groups, templates, and detailed selections.</p>
          </div>
          <div className="toolbar">
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={workspaceLoading || loading}>
              {projects.length ? projects.map((project) => (
                <option key={project.id} value={project.id}>{project.project_name || project.client_name || "Untitled project"}</option>
              )) : <option value="">No projects found</option>}
            </select>
            <button onClick={saveStructure} disabled={!selectedProjectId || saving}>
              {saving ? <RefreshCw size={16} /> : <Save size={16} />} Save
            </button>
          </div>
        </header>

        {(message || error) && <div className={error ? "notice error" : "notice"}>{error || message}</div>}

        <section className="summaryBand">
          <Metric label="Included rooms" value={includedRooms.length} />
          <Metric label="Room groups" value={state.groups.filter((group) => group.memberRoomIds.length).length} />
          <Metric label="Required complete" value={`${projectProgress.percent}%`} />
          <Metric label="Remaining selections" value={Math.max(projectProgress.required - projectProgress.complete, 0)} />
        </section>

        <section className="workspace">
          <aside className="panel setupPanel">
            <PanelTitle icon={<ListChecks size={18} />} title="Area Checklist" />
            <div className="quickActions">
              <button onClick={() => addRoom("bedroom")}><Plus size={15} /> Bedroom</button>
              <button onClick={() => addRoom("custom")}><Plus size={15} /> Custom room</button>
              <button onClick={() => addRoom("external")}><Plus size={15} /> External zone</button>
            </div>
            {AREA_GROUPS.map((group) => (
              <div key={group.title} className="areaGroup">
                <h2>{group.title}</h2>
                {state.areas.filter((area) => area.type === group.type).map((area) => (
                  <div key={area.id} className={`areaRow${area.included ? " included" : ""}`}>
                    <label>
                      <input type="checkbox" checked={area.included} onChange={() => toggleArea(area.id)} />
                      <span>{area.name}</span>
                    </label>
                    {area.included && (
                      <div className="areaEdit">
                        <input value={area.name} onChange={(event) => updateArea(area.id, { name: event.target.value })} aria-label="Area name" />
                        <select value={area.floor} onChange={(event) => updateArea(area.id, { floor: event.target.value })}>
                          {[...FLOOR_LEVELS, "Custom level"].map((floor) => <option key={floor} value={floor}>{floor}</option>)}
                        </select>
                        <input type="number" min="1" value={area.quantity} onChange={(event) => updateArea(area.id, { quantity: Number(event.target.value || 1) })} aria-label="Quantity" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </aside>

          <section className="panel hierarchyPanel">
            <PanelTitle icon={<FolderTree size={18} />} title="Floor Grouping" />
            {FLOOR_LEVELS.map((floor) => {
              const rooms = includedRooms.filter((room) => room.floor === floor);
              if (!rooms.length) return null;
              return (
                <div key={floor} className="floorBlock">
                  <h2>{floor.toUpperCase()}</h2>
                  {rooms.map((room) => {
                    const group = state.groups.find((entry) => entry.id === room.groupId);
                    const categories = categoryObjects(room.type);
                    const complete = categories.filter((category) => selectionSource(room, group, category.id).value).length;
                    const percent = categories.length ? Math.round((complete / categories.length) * 100) : 0;
                    return (
                      <button key={room.id} className={`roomButton${activeRoom?.id === room.id ? " active" : ""}`} onClick={() => updateState((current) => ({ ...current, activeRoomId: room.id, activeGroupId: room.groupId }))}>
                        <Home size={15} />
                        <span>{room.name}</span>
                        <small>{percent}%</small>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </section>

          <section className="panel groupPanel">
            <PanelTitle icon={<Users size={18} />} title="Room Groups" />
            <div className="quickActions">
              <button onClick={() => autoGroup("bedroom", "Bedrooms")}><CopyCheck size={15} /> Group bedrooms</button>
              <button onClick={() => autoGroup("wet_area", "Wet areas")}><CopyCheck size={15} /> Group wet areas</button>
              <button onClick={createGroup}><Plus size={15} /> Custom group</button>
            </div>
            {state.groups.map((group) => {
              const members = includedRooms.filter((room) => room.groupId === group.id);
              return (
                <div key={group.id} className={`groupBox${state.activeGroupId === group.id ? " active" : ""}`}>
                  <input value={group.name} onChange={(event) => updateGroup(group.id, { name: event.target.value })} />
                  <div className="muted">{group.groupType} / {members.length} rooms</div>
                  <div className="memberGrid">
                    {includedRooms.map((room) => (
                      <label key={room.id}>
                        <input type="checkbox" checked={room.groupId === group.id} onChange={(event) => assignGroup(room.id, event.target.checked ? group.id : "")} />
                        {room.name}
                      </label>
                    ))}
                  </div>
                  <div className="templateButtons">
                    {TEMPLATE_TIERS.map((tier) => (
                      <button key={tier} onClick={() => applyTemplateToGroup(group.id, tier)} className={group.template?.tier === tier ? "selected" : ""}>{tier}</button>
                    ))}
                  </div>
                  {!!members.length && (
                    <SharedSelections group={group} onChange={(categoryId, value) => updateGroupSelection(group.id, categoryId, value)} />
                  )}
                </div>
              );
            })}
          </section>
        </section>

        <section className="roomWorkspace">
          <div className="roomHeader">
            <div>
              <p className="eyebrow">Client Selections Appointment</p>
              <h2>{activeRoom?.name || "Select a room"}</h2>
              <p>{activeRoom?.template?.name || "No template applied"} {activeGroup ? ` / ${activeGroup.name}` : ""}</p>
            </div>
            {activeRoom && (
              <div className="toolbar">
                <select value={activeRoom.groupId || ""} onChange={(event) => assignGroup(activeRoom.id, event.target.value)}>
                  <option value="">No group</option>
                  {state.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
                <select value={activeRoom.template?.tier || ""} onChange={(event) => applyTemplateToRoom(activeRoom.id, event.target.value)}>
                  <option value="">Apply template</option>
                  {TEMPLATE_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                </select>
              </div>
            )}
          </div>

          {activeRoom ? (
            <div className="categoryGrid">
              {activeCategories.map((category) => {
                const source = selectionSource(activeRoom, activeGroup, category.id);
                const isOverride = source.type === "override";
                return (
                  <article key={category.id} className={`categoryCard ${source.value ? "complete" : "incomplete"}`}>
                    <div>
                      <h3>{category.name}</h3>
                      <p>{source.value || "Selection required"}</p>
                    </div>
                    <span className={`pill ${source.type}`}>{source.type}</span>
                    {activeGroup && (
                      <div className="selectionInputs">
                        <label>
                          Group selection
                          <input
                            value={activeGroup.sharedSelections?.[category.id]?.value || ""}
                            onChange={(event) => updateGroupSelection(activeGroup.id, category.id, event.target.value)}
                            placeholder={`Apply ${category.name} to ${activeGroup.name}`}
                          />
                        </label>
                        <label>
                          Room override
                          <input
                            value={activeRoom.overrides?.[category.id]?.value || ""}
                            onChange={(event) => overrideRoomSelection(activeRoom.id, category.id, event.target.value)}
                            placeholder="Override this room only"
                          />
                        </label>
                        {isOverride && (
                          <button className="restore" onClick={() => restoreRoomSelection(activeRoom.id, category.id)}>
                            <RotateCcw size={15} /> Restore to group value
                          </button>
                        )}
                      </div>
                    )}
                    {isOverride && <div className="overrideNote">Overridden from {activeGroup?.name || "group"} selection</div>}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="emptyState"><ChevronRight size={20} /> Tick project areas to begin.</div>
          )}
        </section>
      </main>

      <style jsx>{`
        .screen { min-height: 100vh; background: #f5f7fb; color: #172033; padding: 24px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color-scheme: light; }
        .topbar, .roomHeader { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 18px; }
        h1, h2, h3, p { margin: 0; }
        h1 { font-size: 32px; line-height: 1.1; }
        h2 { font-size: 18px; }
        h3 { font-size: 14px; }
        .eyebrow { color: #2f6f73; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: .08em; margin-bottom: 6px; }
        .subcopy, .muted, .roomHeader p, .categoryCard p { color: #657188; font-size: 13px; }
        .toolbar, .quickActions, .templateButtons { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        button, select, input { border: 1px solid #d4dce8; border-radius: 7px; background: #fff !important; color: #172033 !important; min-height: 36px; padding: 8px 10px; font: inherit; }
        button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 750; cursor: pointer; }
        button:hover { border-color: #6ea4a8; }
        button:disabled { opacity: .55; cursor: not-allowed; }
        .toolbar button { background: #173f44 !important; color: white !important; border-color: #173f44; }
        .notice { margin: 0 0 16px; padding: 12px 14px; border: 1px solid #b8d9c9; background: #eef9f3; border-radius: 8px; color: #175235; }
        .notice.error { border-color: #f2b7b7; background: #fff1f1; color: #9c2020; }
        .summaryBand { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .metric { background: white; border: 1px solid #dfe6ef; border-radius: 8px; padding: 14px; }
        .metric strong { display: block; font-size: 24px; }
        .metric span { color: #657188; font-size: 12px; text-transform: uppercase; font-weight: 800; }
        .workspace { display: grid; grid-template-columns: minmax(340px, 1.3fr) minmax(260px, .8fr) minmax(360px, 1.2fr); gap: 14px; align-items: start; }
        .panel, .roomWorkspace { background: white; border: 1px solid #dfe6ef; border-radius: 8px; padding: 16px; }
        .setupPanel, .hierarchyPanel, .groupPanel { max-height: 72vh; overflow: auto; }
        .panelTitle { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .areaGroup { border-top: 1px solid #edf1f6; padding-top: 14px; margin-top: 14px; }
        .areaGroup h2, .floorBlock h2 { font-size: 12px; text-transform: uppercase; color: #657188; margin-bottom: 8px; letter-spacing: .06em; }
        .areaRow { border: 1px solid transparent; border-radius: 8px; padding: 8px; }
        .areaRow.included { background: #f7fbfb; border-color: #cfe4e5; }
        .areaRow label, .memberGrid label { display: flex; gap: 8px; align-items: center; font-size: 13px; }
        .areaEdit { display: grid; grid-template-columns: minmax(140px, 1fr) 130px 58px; gap: 7px; margin-top: 8px; }
        .areaEdit input, .areaEdit select { min-height: 32px; padding: 6px 8px; font-size: 12px; }
        .floorBlock { margin-bottom: 16px; }
        .roomButton { width: 100%; justify-content: flex-start; margin-bottom: 7px; }
        .roomButton small { margin-left: auto; color: #657188; }
        .roomButton.active { background: #173f44 !important; color: white !important; border-color: #173f44; }
        .roomButton.active small { color: #dceff0; }
        .groupBox { border: 1px solid #e1e7f0; border-radius: 8px; padding: 12px; margin-top: 10px; display: grid; gap: 10px; }
        .groupBox.active { border-color: #6ea4a8; box-shadow: 0 0 0 3px #e7f3f3; }
        .groupBox > input { font-weight: 800; }
        .memberGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; max-height: 130px; overflow: auto; }
        .templateButtons button { min-height: 30px; padding: 5px 8px; font-size: 12px; }
        .templateButtons .selected { background: #173f44 !important; color: white !important; border-color: #173f44; }
        .sharedBox { border-top: 1px solid #edf1f6; padding-top: 10px; display: grid; gap: 7px; }
        .sharedBox label, .selectionInputs label { display: grid; gap: 5px; color: #657188; font-size: 12px; font-weight: 750; }
        .roomWorkspace { margin-top: 14px; }
        .categoryGrid { display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 12px; }
        .categoryCard { border: 1px solid #e1e7f0; border-radius: 8px; padding: 12px; display: grid; gap: 10px; align-content: start; }
        .categoryCard.complete { border-color: #a9d9bf; background: #fbfffc; }
        .categoryCard.incomplete { background: #fff; }
        .pill { width: fit-content; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 850; text-transform: uppercase; background: #edf1f6; color: #657188; }
        .pill.inherited { background: #e9f7f8; color: #175a61; }
        .pill.override { background: #fff3d7; color: #87530a; }
        .pill.template { background: #edf5ec; color: #2d6a31; }
        .selectionInputs { display: grid; gap: 8px; }
        .selectionInputs input { width: 100%; min-width: 0; }
        .restore { justify-content: flex-start; color: #87530a; background: #fff8e7; border-color: #f2d89c; }
        .overrideNote { border-left: 3px solid #d69222; padding-left: 8px; color: #87530a; font-size: 12px; font-weight: 750; }
        .emptyState { min-height: 140px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #657188; }
        @media (max-width: 1240px) {
          .workspace, .categoryGrid, .summaryBand { grid-template-columns: 1fr 1fr; }
          .groupPanel { grid-column: 1 / -1; }
        }
        @media (max-width: 760px) {
          .screen { padding: 14px; }
          .topbar, .roomHeader { display: grid; }
          .workspace, .categoryGrid, .summaryBand { grid-template-columns: 1fr; }
          .areaEdit { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}

BuilderClientSelectionsPage.disableLayout = true;

function Metric({ label, value }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PanelTitle({ icon, title }) {
  return (
    <div className="panelTitle">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function SharedSelections({ group, onChange }) {
  const categories = categoryObjects(group.areaType).slice(0, 4);
  return (
    <div className="sharedBox">
      {categories.map((category) => (
        <label key={category.id}>
          Apply {category.name} to all rooms in this group
          <input
            value={group.sharedSelections?.[category.id]?.value || ""}
            onChange={(event) => onChange(category.id, event.target.value)}
            placeholder={`Group ${category.name}`}
          />
        </label>
      ))}
    </div>
  );
}
