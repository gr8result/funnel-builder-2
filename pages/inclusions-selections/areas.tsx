import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AreaStageActions } from "../../src/modules/inclusions-selections/components/AreaStageActions";
import { AreaRegisterValidationSummary } from "../../src/modules/inclusions-selections/components/AreaRegisterValidationSummary";
import { AreaTypeChecklist } from "../../src/modules/inclusions-selections/components/AreaTypeChecklist";
import { CustomAreaDialog } from "../../src/modules/inclusions-selections/components/CustomAreaDialog";
import { GeneratedAreaRegister } from "../../src/modules/inclusions-selections/components/GeneratedAreaRegister";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import { ProjectLevelsEditor } from "../../src/modules/inclusions-selections/components/ProjectLevelsEditor";
import { ProjectSelectionSummary } from "../../src/modules/inclusions-selections/components/ProjectSelectionSummary";
import type { ProjectAreaRegister, ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import { PROJECT_REQUIRED_MESSAGE, contextFromQuery, hrefForStage } from "../../src/modules/inclusions-selections/routing/stageNavigation";
import {
  assignProjectAreaLevel,
  canContinueToTemplates,
  createCustomProjectArea,
  createCustomProjectLevel,
  deleteProjectArea,
  duplicateProjectArea,
  loadProjectAreaRegister,
  renameProjectArea,
  renameProjectLevel,
  saveProjectAreaRegister,
  setAreaQuantity,
  setProjectLevelActive,
  validateProjectContext,
} from "../../src/modules/inclusions-selections/services/projectAreaRegisterService";
import type { DomainIssue, DomainResult } from "../../src/modules/inclusions-selections/validation/errors";

function firstActiveLevelId(register: ProjectAreaRegister | null): string {
  return register?.levels.find((level) => level.active)?.id ?? "";
}

export default function CreateSelectionAreasPage() {
  const router = useRouter();
  const [register, setRegister] = useState<ProjectAreaRegister | null>(null);
  const [issues, setIssues] = useState<DomainIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [levelDraft, setLevelDraft] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<{ areaTypeId: string; quantity: number } | null>(null);
  const [customDraft, setCustomDraft] = useState({ name: "", groupId: "area_group_custom", levelId: "" });

  const context = useMemo<Partial<ProjectSelectionContext>>(() => contextFromQuery(router.query), [router.query]);

  const contextResult = validateProjectContext(context);

  useEffect(() => {
    if (!router.isReady || !contextResult.ok || !contextResult.value) return;
    let cancelled = false;
    loadProjectAreaRegister(contextResult.value).then((loaded) => {
      if (cancelled) return;
      setRegister(loaded);
      setCustomDraft((draft) => ({ ...draft, levelId: firstActiveLevelId(loaded) }));
      setIssues(canContinueToTemplates(loaded).issues);
    });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, contextResult.ok, contextResult.value?.organisationId, contextResult.value?.projectId]);

  function applyResult(result: DomainResult<ProjectAreaRegister>) {
    setIssues(result.issues);
    if (result.ok && result.value) {
      setRegister(result.value);
      return true;
    }
    return false;
  }

  function handleQuantityChange(areaTypeId: string, quantity: number, confirmRemoval = false) {
    if (!register) return;
    const result = setAreaQuantity(register, areaTypeId, quantity, confirmRemoval);
    if (!result.ok && result.issues.some((item) => item.code === "confirm_area_removal")) {
      setPendingRemoval({ areaTypeId, quantity });
      setIssues(result.issues);
      return;
    }
    setPendingRemoval(null);
    applyResult(result);
  }

  async function handleSave() {
    if (!register) return;
    setSaving(true);
    try {
      const result = await saveProjectAreaRegister(register);
      applyResult(result);
    } catch (_error) {
      setIssues([{ code: "save_failed", message: "The area register could not be saved. Please try again.", severity: "error" }]);
    } finally {
      setSaving(false);
    }
  }

  async function handleContinue() {
    if (!register) return;
    const validation = canContinueToTemplates(register);
    if (!applyResult(validation)) return;
    setSaving(true);
    const saved = await saveProjectAreaRegister(register);
    setSaving(false);
    if (!applyResult(saved)) return;
    router.push(hrefForStage("templates", register));
  }

  if (router.isReady && !contextResult.ok) {
    return (
      <main className="createAreasPage">
        <InclusionsSelectionsStageNav currentStage="areas" context={context} />
        <section className="requiredState">
          <h1>Create Selection Areas</h1>
          <p>{PROJECT_REQUIRED_MESSAGE}</p>
        </section>
        <style jsx global>{pageStyles}</style>
      </main>
    );
  }

  if (!register) {
    return (
      <main className="createAreasPage">
        <InclusionsSelectionsStageNav currentStage="areas" context={context} />
        <section className="requiredState">
          <h1>Create Selection Areas</h1>
          <p>Loading project areas.</p>
        </section>
        <style jsx global>{pageStyles}</style>
      </main>
    );
  }

  const validation = canContinueToTemplates(register);
  const customAreaDraft = { ...customDraft, levelId: customDraft.levelId || firstActiveLevelId(register) };

  return (
    <main className="createAreasPage">
      <InclusionsSelectionsStageNav currentStage="areas" context={register} />
      <header className="pageHeader">
        <div>
          <h1>Create Selection Areas</h1>
          <p>Select every internal and external area included in this project. This creates the room structure used for templates, inclusions, product selections, pricing and estimating.</p>
        </div>
      </header>
      <ProjectSelectionSummary register={register} />
      <ProjectLevelsEditor
        register={register}
        levelDraft={levelDraft}
        onLevelDraftChange={setLevelDraft}
        onAddLevel={() => {
          const result = createCustomProjectLevel(register, levelDraft);
          if (applyResult(result)) setLevelDraft("");
        }}
        onRenameLevel={(levelId, name) => applyResult(renameProjectLevel(register, levelId, name))}
        onToggleLevel={(levelId, active) => applyResult(setProjectLevelActive(register, levelId, active))}
      />
      <div className="workspace">
        <AreaTypeChecklist register={register} pendingRemoval={pendingRemoval} onQuantityChange={handleQuantityChange} />
        <div className="rightColumn">
          <CustomAreaDialog
            register={register}
            draft={customAreaDraft}
            onDraftChange={setCustomDraft}
            onAdd={() => {
              const result = createCustomProjectArea(register, customAreaDraft);
              if (applyResult(result)) setCustomDraft({ name: "", groupId: "area_group_custom", levelId: firstActiveLevelId(register) });
            }}
          />
          <AreaRegisterValidationSummary issues={issues.length ? issues : validation.issues} />
        </div>
      </div>
      <GeneratedAreaRegister
        register={register}
        onRenameArea={(areaId, name) => applyResult(renameProjectArea(register, areaId, name))}
        onAssignLevel={(areaId, levelId) => applyResult(assignProjectAreaLevel(register, areaId, levelId))}
        onDuplicateArea={(areaId) => applyResult(duplicateProjectArea(register, areaId))}
        onDeleteArea={(areaId) => applyResult(deleteProjectArea(register, areaId))}
      />
      <AreaStageActions canContinue={validation.ok} saving={saving} onSave={handleSave} onContinue={handleContinue} />
      <p className="persistenceNote">Drafts use the new browser-scoped repository until the approved database migration exists.</p>
      <style jsx global>{pageStyles}</style>
    </main>
  );
}

const pageStyles = `
  .createAreasPage {
    min-height: 100vh;
    background: #f6f8fb;
    color: #182033;
    padding: 32px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .pageHeader, .requiredState {
    max-width: 1180px;
    margin: 0 auto 20px;
  }
  h1 {
    margin: 0 0 10px;
    font-size: 34px;
    line-height: 1.1;
    letter-spacing: 0;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0;
  }
  h3 {
    margin: 0 0 12px;
    font-size: 15px;
    letter-spacing: 0;
  }
  p {
    line-height: 1.5;
  }
  .pageHeader p {
    max-width: 780px;
    margin: 0;
    color: #5b6578;
  }
  .summaryBar, .panel, .issuePanel, .stageActions {
    max-width: 1180px;
    margin: 0 auto 16px;
  }
  .summaryBar {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .summaryBar div, .panel, .issuePanel {
    background: #ffffff;
    border: 1px solid #dfe5ee;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(20, 31, 51, 0.04);
  }
  .summaryBar div {
    padding: 14px;
  }
  .summaryBar span {
    display: block;
    color: #647084;
    font-size: 12px;
    margin-bottom: 4px;
  }
  .summaryBar strong {
    font-size: 14px;
  }
  .panel {
    padding: 18px;
  }
  .panelHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .inlineAdd, .customPanel {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  input, select, button {
    min-height: 36px;
    border-radius: 6px;
    border: 1px solid #cfd7e3;
    background: #ffffff;
    color: #182033;
    font: inherit;
  }
  input, select {
    padding: 7px 9px;
    min-width: 0;
  }
  button {
    padding: 7px 12px;
    cursor: pointer;
    font-weight: 650;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .ghostButton {
    background: #eef3f8;
  }
  .primaryButton {
    background: #1d4f91;
    border-color: #1d4f91;
    color: #ffffff;
  }
  .levelGrid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .levelItem {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 10px;
    border: 1px solid #e3e8f0;
    border-radius: 8px;
  }
  .workspace {
    max-width: 1180px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 16px;
  }
  .rightColumn {
    min-width: 0;
  }
  .checklistGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .checklistGroup {
    border: 1px solid #e3e8f0;
    border-radius: 8px;
    padding: 14px;
  }
  .checklistItem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-top: 1px solid #eef2f6;
  }
  .checklistItem label {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }
  .quantityControl {
    display: grid;
    grid-template-columns: 34px 58px 34px;
    gap: 4px;
  }
  .quantityControl input {
    text-align: center;
    padding: 4px;
  }
  .removalNotice, .protectedNotice {
    grid-column: 1 / -1;
    color: #865100;
    font-size: 13px;
    margin: 0;
  }
  .removalNotice {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    background: #fff7e6;
    border: 1px solid #f6d69b;
    border-radius: 6px;
    padding: 8px;
  }
  .customPanel {
    flex-wrap: wrap;
  }
  .customPanel input, .customPanel select {
    flex: 1 1 150px;
  }
  .issuePanel {
    padding: 12px 14px;
    border-color: #ffd3d1;
    color: #9b2c25;
  }
  .issuePanel p {
    margin: 4px 0;
  }
  .validNotice {
    margin: 0 auto 16px;
    max-width: 1180px;
    color: #1d6d47;
    background: #e9f8ef;
    border: 1px solid #b7e2c6;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .areaTableWrap {
    overflow-x: auto;
  }
  .areaTable {
    width: 100%;
    border-collapse: collapse;
  }
  .areaTable th, .areaTable td {
    text-align: left;
    padding: 9px;
    border-top: 1px solid #edf1f6;
    vertical-align: middle;
  }
  .areaTable input, .areaTable select {
    width: 100%;
  }
  .rowActions {
    display: flex;
    gap: 8px;
  }
  .areaCardList {
    display: none;
  }
  .emptyState, .persistenceNote {
    max-width: 1180px;
    margin: 12px auto;
    color: #647084;
  }
  .stageActions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    position: sticky;
    bottom: 0;
    background: rgba(246, 248, 251, 0.94);
    padding: 14px 0;
  }
  @media (max-width: 900px) {
    .createAreasPage {
      padding: 20px;
    }
    .summaryBar, .levelGrid, .workspace, .checklistGrid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 760px) {
    h1 {
      font-size: 28px;
    }
    .panelHead, .inlineAdd, .stageActions {
      align-items: stretch;
      flex-direction: column;
    }
    .checklistItem {
      grid-template-columns: 1fr;
    }
    .areaTableWrap {
      display: none;
    }
    .areaCardList {
      display: grid;
      gap: 10px;
    }
    .areaCard {
      display: grid;
      gap: 8px;
      border: 1px solid #e3e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .areaCard p {
      margin: 0;
      color: #647084;
      font-size: 13px;
    }
    .rowActions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
