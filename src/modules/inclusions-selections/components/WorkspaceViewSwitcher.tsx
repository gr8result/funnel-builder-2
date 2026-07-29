import type { WorkspaceView } from "../services/selectionWorkspaceService";

export function WorkspaceViewSwitcher({ value, onChange }: { value: WorkspaceView; onChange: (view: WorkspaceView) => void }) {
  return (
    <div className="viewSwitcher" role="tablist" aria-label="Workspace view">
      <button type="button" className={value === "room" ? "selected" : ""} onClick={() => onChange("room")}>Room View</button>
      <button type="button" className={value === "category" ? "selected" : ""} onClick={() => onChange("category")}>Category View</button>
    </div>
  );
}
