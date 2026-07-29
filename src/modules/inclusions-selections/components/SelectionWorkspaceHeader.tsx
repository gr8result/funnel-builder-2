export function SelectionWorkspaceHeader({ onBackToTemplates }: { onBackToTemplates: () => void }) {
  return (
    <header className="workspaceHeader">
      <div>
        <h1>Inclusions and Selections Workspace</h1>
        <p>Complete selections by room or by category. Apply matching products across compatible areas while keeping every selection connected to its exact project location.</p>
      </div>
      <button type="button" onClick={onBackToTemplates}>Back to Templates</button>
    </header>
  );
}
