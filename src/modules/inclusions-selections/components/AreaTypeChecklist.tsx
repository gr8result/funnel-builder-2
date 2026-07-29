import { CREATE_AREAS_CHECKLIST } from "../areas/areaChecklistCatalog";
import type { ProjectAreaRegister } from "../repositories/projectAreaRegisterRepository";
import { findAreaType, previewAreaQuantityChange } from "../services/projectAreaRegisterService";
import { AreaQuantityControl } from "./AreaQuantityControl";

type Props = {
  register: ProjectAreaRegister;
  pendingRemoval: { areaTypeId: string; quantity: number } | null;
  onQuantityChange: (areaTypeId: string, quantity: number, confirmRemoval?: boolean) => void;
};

function selectedQuantity(register: ProjectAreaRegister, areaTypeId: string): number {
  return register.selections.find((selection) => selection.areaTypeId === areaTypeId)?.quantity ?? 0;
}

export function AreaTypeChecklist({ register, pendingRemoval, onQuantityChange }: Props) {
  return (
    <section className="panel" aria-labelledby="checklist-title">
      <div className="panelHead">
        <h2 id="checklist-title">Area Checklist</h2>
        <button type="button" className="ghostButton" onClick={() => onQuantityChange("area_type_whole_project", selectedQuantity(register, "area_type_whole_project") ? 0 : 1)}>
          Whole Project
        </button>
      </div>
      <div className="checklistGrid">
        {CREATE_AREAS_CHECKLIST.map((group) => (
          <div className="checklistGroup" key={group.groupId}>
            <h3>{group.label}</h3>
            {group.areaTypes.map((item) => {
              const areaType = findAreaType(register, item.areaTypeId);
              if (!areaType) return null;
              const quantity = selectedQuantity(register, item.areaTypeId);
              const removal = pendingRemoval?.areaTypeId === item.areaTypeId ? previewAreaQuantityChange(register, item.areaTypeId, pendingRemoval.quantity) : null;
              return (
                <div className="checklistItem" key={item.areaTypeId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={quantity > 0}
                      onChange={(event) => onQuantityChange(item.areaTypeId, event.target.checked ? item.defaultQuantity : 0)}
                    />
                    <span>{areaType.name}</span>
                  </label>
                  {item.repeatable ? (
                    <AreaQuantityControl quantity={quantity} disabled={quantity === 0} onChange={(next) => onQuantityChange(item.areaTypeId, next)} />
                  ) : null}
                  {removal && removal.eligibleForRemoval.length > 0 ? (
                    <div className="removalNotice">
                      <span>Remove: {removal.eligibleForRemoval.map((area) => area.name).join(", ")}</span>
                      <button type="button" onClick={() => onQuantityChange(item.areaTypeId, pendingRemoval?.quantity ?? quantity, true)}>Confirm</button>
                    </div>
                  ) : null}
                  {removal && removal.protectedFromRemoval.length > 0 ? (
                    <p className="protectedNotice">Kept because customised or linked: {removal.protectedFromRemoval.map((area) => area.name).join(", ")}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
