import type { ProjectAreaRegister } from "../repositories/projectAreaRegisterRepository";
import { findAreaType } from "../services/projectAreaRegisterService";

type Props = {
  register: ProjectAreaRegister;
  onRenameArea: (areaId: string, name: string) => void;
  onAssignLevel: (areaId: string, levelId: string) => void;
  onDuplicateArea: (areaId: string) => void;
  onDeleteArea: (areaId: string) => void;
};

function levelName(register: ProjectAreaRegister, levelId?: string): string {
  return register.levels.find((level) => level.id === levelId)?.name ?? "Unassigned";
}

export function GeneratedAreaRegister({ register, onRenameArea, onAssignLevel, onDuplicateArea, onDeleteArea }: Props) {
  return (
    <section className="panel" aria-labelledby="register-title">
      <div className="panelHead">
        <h2 id="register-title">Selected Areas</h2>
        <span>{register.areas.length} areas</span>
      </div>
      <div className="areaTableWrap">
        <table className="areaTable">
          <thead>
            <tr><th>Name</th><th>Type</th><th>Group</th><th>Level</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {register.areas.map((area) => {
              const areaType = findAreaType(register, area.areaTypeId);
              return (
                <tr key={area.id}>
                  <td><input value={area.name} onChange={(event) => onRenameArea(area.id, event.target.value)} /></td>
                  <td>{areaType?.name ?? "Unknown"}</td>
                  <td>{areaType?.groupId ?? area.groupId}</td>
                  <td>
                    <select value={area.levelId ?? ""} onChange={(event) => onAssignLevel(area.id, event.target.value)}>
                      {register.levels.filter((level) => level.active).map((level) => <option value={level.id} key={level.id}>{level.name}</option>)}
                    </select>
                  </td>
                  <td className="rowActions">
                    <button type="button" onClick={() => onDuplicateArea(area.id)}>Duplicate</button>
                    <button type="button" onClick={() => onDeleteArea(area.id)}>Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="areaCardList">
        {register.areas.map((area) => {
          const areaType = findAreaType(register, area.areaTypeId);
          return (
            <article className="areaCard" key={area.id}>
              <input value={area.name} onChange={(event) => onRenameArea(area.id, event.target.value)} aria-label="Area name" />
              <p>{areaType?.name ?? "Unknown"} · {levelName(register, area.levelId)}</p>
              <select value={area.levelId ?? ""} onChange={(event) => onAssignLevel(area.id, event.target.value)}>
                {register.levels.filter((level) => level.active).map((level) => <option value={level.id} key={level.id}>{level.name}</option>)}
              </select>
              <div className="rowActions">
                <button type="button" onClick={() => onDuplicateArea(area.id)}>Duplicate</button>
                <button type="button" onClick={() => onDeleteArea(area.id)}>Remove</button>
              </div>
            </article>
          );
        })}
      </div>
      {register.areas.length === 0 ? <p className="emptyState">Selected areas will appear here.</p> : null}
    </section>
  );
}
