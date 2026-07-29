import type { ProjectAreaRegister } from "../repositories/projectAreaRegisterRepository";
import { listRegisterAreaGroups } from "../services/projectAreaRegisterService";

type Draft = { name: string; groupId: string; levelId: string };

type Props = {
  register: ProjectAreaRegister;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  onAdd: () => void;
};

export function CustomAreaDialog({ register, draft, onDraftChange, onAdd }: Props) {
  return (
    <section className="panel customPanel" aria-labelledby="custom-title">
      <div>
        <h2 id="custom-title">Custom Area</h2>
      </div>
      <input value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} placeholder="Area name" />
      <select value={draft.groupId} onChange={(event) => onDraftChange({ ...draft, groupId: event.target.value })}>
        {listRegisterAreaGroups().filter((group) => group.id !== "area_group_whole_project").map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
      </select>
      <select value={draft.levelId} onChange={(event) => onDraftChange({ ...draft, levelId: event.target.value })}>
        {register.levels.filter((level) => level.active).map((level) => <option value={level.id} key={level.id}>{level.name}</option>)}
      </select>
      <button type="button" onClick={onAdd}>Add Custom Area</button>
    </section>
  );
}
