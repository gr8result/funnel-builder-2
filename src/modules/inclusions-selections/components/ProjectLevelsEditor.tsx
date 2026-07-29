import type { ProjectAreaRegister } from "../repositories/projectAreaRegisterRepository";

type Props = {
  register: ProjectAreaRegister;
  levelDraft: string;
  onLevelDraftChange: (value: string) => void;
  onAddLevel: () => void;
  onRenameLevel: (levelId: string, name: string) => void;
  onToggleLevel: (levelId: string, active: boolean) => void;
};

export function ProjectLevelsEditor({ register, levelDraft, onLevelDraftChange, onAddLevel, onRenameLevel, onToggleLevel }: Props) {
  return (
    <section className="panel" aria-labelledby="levels-title">
      <div className="panelHead">
        <h2 id="levels-title">Project Levels</h2>
        <div className="inlineAdd">
          <input value={levelDraft} onChange={(event) => onLevelDraftChange(event.target.value)} placeholder="Add custom level" />
          <button type="button" onClick={onAddLevel}>Add</button>
        </div>
      </div>
      <div className="levelGrid">
        {register.levels.map((level) => (
          <label className="levelItem" key={level.id}>
            <input type="checkbox" checked={level.active} onChange={(event) => onToggleLevel(level.id, event.target.checked)} />
            <input value={level.name} onChange={(event) => onRenameLevel(level.id, event.target.value)} aria-label={`Rename ${level.name}`} />
          </label>
        ))}
      </div>
    </section>
  );
}
