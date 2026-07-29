import type { ApplyToScope } from "../services/selectionWorkspaceService";

export function ApplyToDialog({ scope, onScope, onPreview }: { scope: ApplyToScope; onScope: (scope: ApplyToScope) => void; onPreview: () => void }) {
  return (
    <div className="applyToDialog">
      <label className="fieldLabel">
        <span>Apply To</span>
        <select value={scope} onChange={(event) => onScope(event.target.value as ApplyToScope)}>
          <option value="this_requirement">This Requirement Only</option>
          <option value="this_room">This Room</option>
          <option value="selected_rooms">Selected Rooms</option>
          <option value="all_rooms_of_area_type">All Rooms of This AreaType</option>
          <option value="all_rooms_in_area_group">All Rooms in This AreaGroup</option>
          <option value="every_compatible_requirement">Every Compatible Requirement in the Project</option>
        </select>
      </label>
      <button type="button" onClick={onPreview}>Preview Apply To</button>
    </div>
  );
}
