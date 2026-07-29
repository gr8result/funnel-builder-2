import type { RequirementNote } from "../repositories/selectionWorkspaceRepository";

export function RequirementNotesPanel({ notes }: { notes: RequirementNote[] }) {
  if (notes.length === 0) return <p className="muted">No notes.</p>;
  return <div className="notesPanel">{notes.map((note) => <p key={note.id}><strong>{note.kind.replace(/_/g, " ")}:</strong> {note.text}</p>)}</div>;
}
