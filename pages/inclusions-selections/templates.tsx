import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AreaGroupTemplateSection } from "../../src/modules/inclusions-selections/components/AreaGroupTemplateSection";
import { CustomTemplateEditor } from "../../src/modules/inclusions-selections/components/CustomTemplateEditor";
import { ProjectTierSelector } from "../../src/modules/inclusions-selections/components/ProjectTierSelector";
import { RequirementCategorySummary } from "../../src/modules/inclusions-selections/components/RequirementCategorySummary";
import { RequirementPreview } from "../../src/modules/inclusions-selections/components/RequirementPreview";
import { SavedBuilderTemplatePanel } from "../../src/modules/inclusions-selections/components/SavedBuilderTemplatePanel";
import { TemplateStageActions } from "../../src/modules/inclusions-selections/components/TemplateStageActions";
import { TemplateStageProjectSummary } from "../../src/modules/inclusions-selections/components/TemplateStageProjectSummary";
import { TemplateStageValidationSummary } from "../../src/modules/inclusions-selections/components/TemplateStageValidationSummary";
import { InclusionsSelectionsStageNav } from "../../src/modules/inclusions-selections/components/InclusionsSelectionsStageNav";
import type { RequirementCategory, RequirementDefinition } from "../../src/modules/inclusions-selections/requirements/requirementTypes";
import type { ProjectSelectionContext } from "../../src/modules/inclusions-selections/repositories/projectAreaRegisterRepository";
import { PROJECT_REQUIRED_MESSAGE, contextFromQuery, hrefForStage } from "../../src/modules/inclusions-selections/routing/stageNavigation";
import {
  applyBuilderTemplate,
  archiveBuilderTemplate,
  assignAreaGroupTier,
  assignAreaTemplate,
  assignAreaTypeTier,
  assignProjectAreaTier,
  assignProjectTier,
  createCustomAreaTemplate,
  createCustomRequirementDefinition,
  duplicateBuilderTemplate,
  loadTemplateStage,
  previewRequirementGeneration,
  reconcileProjectRequirements,
  renameBuilderTemplate,
  resetTemplateOverride,
  saveBuilderTemplate,
  saveTemplateStage,
  validateTemplateStage,
} from "../../src/modules/inclusions-selections/services/templateStageService";
import type { RequirementReconciliationResult, TemplateStageState } from "../../src/modules/inclusions-selections/services/templateStageService";
import type { SavedBuilderTemplate } from "../../src/modules/inclusions-selections/templates/savedBuilderTemplateTypes";
import type { DomainIssue, DomainResult } from "../../src/modules/inclusions-selections/validation/errors";

function groupAreas(state: TemplateStageState): Record<string, typeof state.areaRegister.areas> {
  return state.areaRegister.areas.reduce<Record<string, typeof state.areaRegister.areas>>((acc, area) => {
    acc[area.groupId] = [...(acc[area.groupId] ?? []), area];
    return acc;
  }, {});
}

function attentionCount(state: TemplateStageState): number {
  const validation = validateTemplateStage(state);
  return new Set(validation.issues.map((item) => item.path).filter(Boolean)).size || validation.issues.length;
}

export default function RoomTemplatesAndInclusionTiersPage() {
  const router = useRouter();
  const [state, setState] = useState<TemplateStageState | null>(null);
  const [issues, setIssues] = useState<DomainIssue[]>([]);
  const [preview, setPreview] = useState<RequirementReconciliationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedTemplateDraft, setSavedTemplateDraft] = useState("");
  const [customAreaId, setCustomAreaId] = useState("");
  const [customDefinitions, setCustomDefinitions] = useState<RequirementDefinition[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState<RequirementCategory>("allowance");

  const context = useMemo<Partial<ProjectSelectionContext>>(() => contextFromQuery(router.query), [router.query]);

  useEffect(() => {
    if (!router.isReady || !context.organisationId || !context.projectId) return;
    let cancelled = false;
    loadTemplateStage(context as ProjectSelectionContext).then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setIssues(validateTemplateStage(loaded).issues);
    });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, context.organisationId, context.projectId]);

  function applyResult(result: DomainResult<TemplateStageState>) {
    setIssues(result.issues);
    if (result.ok && result.value) {
      setState(result.value);
      setPreview(previewRequirementGeneration(result.value));
      return true;
    }
    return false;
  }

  async function refreshSavedTemplates(nextState: TemplateStageState) {
    const reloaded = await loadTemplateStage(nextState.context);
    setState({ ...nextState, savedBuilderTemplates: reloaded.savedBuilderTemplates });
  }

  async function handleSave() {
    if (!state) return;
    setSaving(true);
    const saved = await saveTemplateStage(state);
    setSaving(false);
    applyResult(saved);
  }

  async function handleContinue() {
    if (!state) return;
    const reconciled = reconcileProjectRequirements(state);
    if (!applyResult(reconciled) || !reconciled.value) return;
    const validation = validateTemplateStage(reconciled.value);
    if (!applyResult(validation)) return;
    setSaving(true);
    const saved = await saveTemplateStage(reconciled.value);
    setSaving(false);
    if (!applyResult(saved)) return;
    router.push(hrefForStage("workspace", state.context));
  }

  if (router.isReady && (!context.organisationId || !context.projectId)) {
    return (
      <main className="templateStagePage">
        <InclusionsSelectionsStageNav currentStage="templates" context={context} />
        <section className="requiredState">
          <h1>Room Templates and Inclusion Tiers</h1>
          <p>{PROJECT_REQUIRED_MESSAGE}</p>
        </section>
        <style jsx global>{templateStyles}</style>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="templateStagePage">
        <InclusionsSelectionsStageNav currentStage="templates" context={context} />
        <section className="requiredState">
          <h1>Room Templates and Inclusion Tiers</h1>
          <p>Loading room templates.</p>
        </section>
        <style jsx global>{templateStyles}</style>
      </main>
    );
  }

  const groups = groupAreas(state);
  const validation = validateTemplateStage(state);
  const projectOverrideCount = state.configuration.groupOverrides.length + state.configuration.areaTypeOverrides.length + state.configuration.areaOverrides.length;
  const customArea = state.areaRegister.areas.find((area) => area.id === customAreaId);

  return (
    <main className="templateStagePage">
      <InclusionsSelectionsStageNav currentStage="templates" context={state.context} />
      <header className="pageHeader">
        <div>
          <h1>Room Templates and Inclusion Tiers</h1>
          <p>Choose the template and inclusion tier for each project area. Templates define what must be selected, while tiers define the standard of inclusions applied.</p>
        </div>
        <button type="button" onClick={() => router.push(hrefForStage("areas", state.context))}>Edit Project Areas</button>
      </header>
      <TemplateStageProjectSummary state={state} requiringAttention={attentionCount(state)} />
      <div className="templateWorkspace">
        <div className="mainColumn">
          <ProjectTierSelector
            value={state.configuration.projectDefault.tierId}
            inheritingCount={Math.max(0, state.areaRegister.areas.length - projectOverrideCount)}
            overriddenCount={projectOverrideCount}
            onChange={(tierId) => applyResult(assignProjectTier(state, tierId))}
            onPreview={() => setPreview(previewRequirementGeneration(state))}
            onReset={() => applyResult(resetTemplateOverride(state, "project"))}
          />
          {Object.entries(groups).map(([groupId, areas]) => (
            <AreaGroupTemplateSection
              key={groupId}
              state={state}
              groupId={groupId}
              areas={areas}
              onGroupTier={(tierId) => applyResult(assignAreaGroupTier(state, groupId, tierId))}
              onGroupTemplate={(templateId) => applyResult(assignAreaTemplate(state, { scope: "area_group", groupId, templateId }))}
              onTypeTier={(areaTypeId, tierId) => applyResult(assignAreaTypeTier(state, areaTypeId, tierId))}
              onTypeTemplate={(areaTypeId, templateId) => applyResult(assignAreaTemplate(state, { scope: "area_type", areaTypeId, templateId }))}
              onAreaTier={(areaId, tierId) => applyResult(assignProjectAreaTier(state, areaId, tierId))}
              onAreaTemplate={(areaId, templateId) => applyResult(assignAreaTemplate(state, { scope: "project_area", areaId, templateId }))}
              onAreaCustom={(areaId) => {
                setCustomAreaId(areaId);
                setCustomDefinitions([]);
              }}
              onPreview={(scope, id) => setPreview(previewRequirementGeneration(state, scope, id))}
              onGenerate={() => applyResult(reconcileProjectRequirements(state))}
              onReset={(scope, id) => applyResult(resetTemplateOverride(state, scope, id))}
            />
          ))}
        </div>
        <aside className="sideColumn">
          <RequirementPreview preview={preview} />
          <RequirementCategorySummary requirements={state.requirements} />
          <SavedBuilderTemplatePanel
            templates={state.savedBuilderTemplates}
            draftName={savedTemplateDraft}
            onDraftName={setSavedTemplateDraft}
            onSaveCurrent={async () => {
              if (!savedTemplateDraft.trim()) return;
              await saveBuilderTemplate(state, savedTemplateDraft);
              setSavedTemplateDraft("");
              await refreshSavedTemplates(state);
            }}
            onApply={(template: SavedBuilderTemplate) => applyResult(applyBuilderTemplate(state, template))}
            onRename={async (template) => {
              const renamed = await renameBuilderTemplate(template, `${template.name} Updated`);
              await refreshSavedTemplates({ ...state, savedBuilderTemplates: state.savedBuilderTemplates.map((item) => item.id === renamed.id ? renamed : item) });
            }}
            onDuplicate={async (template) => {
              await duplicateBuilderTemplate(template);
              await refreshSavedTemplates(state);
            }}
            onArchive={async (template) => {
              await archiveBuilderTemplate(template);
              await refreshSavedTemplates(state);
            }}
          />
          {customArea ? (
            <CustomTemplateEditor
              title={`Custom Template: ${customArea.name}`}
              definitions={customDefinitions}
              draftTitle={customTitle}
              draftCategory={customCategory}
              onDraftTitle={setCustomTitle}
              onDraftCategory={setCustomCategory}
              onAdd={() => {
                if (!customTitle.trim()) return;
                setCustomDefinitions([...customDefinitions, createCustomRequirementDefinition(customTitle, customCategory, customDefinitions.length)]);
                setCustomTitle("");
              }}
              onRemove={(definitionId) => setCustomDefinitions(customDefinitions.filter((definition) => definition.id !== definitionId))}
              onMove={(definitionId, direction) => {
                const index = customDefinitions.findIndex((definition) => definition.id === definitionId);
                const target = index + direction;
                if (index < 0 || target < 0 || target >= customDefinitions.length) return;
                const next = [...customDefinitions];
                [next[index], next[target]] = [next[target], next[index]];
                setCustomDefinitions(next);
              }}
              onApplicability={(definitionId, applicability) => setCustomDefinitions(customDefinitions.map((definition) => definition.id === definitionId ? { ...definition, applicability, required: applicability === "required" } : definition))}
              onSave={() => {
                const result = createCustomAreaTemplate(state, customArea.id, customDefinitions);
                if (applyResult(result)) setCustomAreaId("");
              }}
            />
          ) : null}
          <TemplateStageValidationSummary issues={issues.length ? issues : validation.issues} />
        </aside>
      </div>
      <TemplateStageActions
        canContinue={validation.ok}
        saving={saving}
        onBack={() => router.push(hrefForStage("areas", state.context))}
        onPreview={() => setPreview(previewRequirementGeneration(state))}
        onGenerate={() => applyResult(reconcileProjectRequirements(state))}
        onSave={handleSave}
        onContinue={handleContinue}
      />
      <p className="persistenceNote">Template assignments, saved builder templates and generated selection items use browser-scoped repositories until approved database adapters are added.</p>
      <style jsx global>{templateStyles}</style>
    </main>
  );
}

const templateStyles = `
  .templateStagePage { min-height: 100vh; background: #f5f7fa; color: #172033; padding: 28px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .pageHeader, .summaryBar, .templateWorkspace, .stageActions, .persistenceNote, .requiredState { max-width: 1240px; margin: 0 auto 16px; }
  .pageHeader { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  h1 { margin: 0 0 8px; font-size: 34px; line-height: 1.1; letter-spacing: 0; }
  h2 { margin: 0; font-size: 18px; letter-spacing: 0; }
  h4 { margin: 0 0 4px; font-size: 16px; letter-spacing: 0; }
  p { line-height: 1.5; }
  .pageHeader p { margin: 0; color: #596579; max-width: 760px; }
  .summaryBar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .summaryBar div, .panel, .issuePanel, .validNotice, .areaTemplateCard { background: #fff; border: 1px solid #dfe6ef; border-radius: 8px; box-shadow: 0 1px 2px rgba(20,31,51,.04); }
  .summaryBar div { padding: 12px; }
  .summaryBar span { display: block; color: #657186; font-size: 12px; margin-bottom: 4px; }
  .summaryBar strong { font-size: 14px; }
  .templateWorkspace { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
  .mainColumn, .sideColumn { display: grid; gap: 16px; min-width: 0; }
  .panel { padding: 16px; }
  .panelHead, .groupHeader, .areaCardHeader, .defaultStats, .rowActions, .previewTotals, .customAddRow { display: flex; gap: 10px; align-items: center; }
  .panelHead, .groupHeader, .areaCardHeader { justify-content: space-between; }
  input, select, button { min-height: 36px; border-radius: 6px; border: 1px solid #cfd8e5; background: #fff; color: #172033; font: inherit; }
  input, select { padding: 7px 9px; min-width: 0; }
  button { padding: 7px 12px; font-weight: 650; cursor: pointer; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .primaryButton { background: #1c4f91; border-color: #1c4f91; color: #fff; }
  .tierGrid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
  .tierOption { text-align: left; display: grid; gap: 6px; min-height: 96px; background: #f8fafc; }
  .tierOption.selected { border-color: #1c4f91; background: #eaf2fc; }
  .tierOption span, .areaTemplateCard p, .savedTemplateItem p { color: #657186; font-size: 13px; margin: 0; }
  .defaultStats { flex-wrap: wrap; color: #596579; font-size: 13px; margin: 12px 0; }
  .expandButton { background: #eef3f8; }
  .groupBody { display: grid; gap: 14px; margin-top: 14px; }
  .areaTypeList, .projectAreaCards, .previewList, .customRequirementList { display: grid; gap: 10px; }
  .areaTypeRow { display: grid; grid-template-columns: minmax(150px, 1fr) minmax(180px, 1fr) 150px auto auto; gap: 10px; align-items: end; border: 1px solid #e7ecf3; border-radius: 8px; padding: 12px; }
  .areaTypeRow span { display: block; color: #657186; font-size: 12px; }
  .projectAreaCards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .areaTemplateCard { padding: 14px; display: grid; gap: 12px; }
  .areaControls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .fieldLabel { display: grid; gap: 5px; color: #475469; font-size: 12px; }
  .fieldLabel select { width: 100%; }
  .areaMeta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; color: #657186; font-size: 13px; }
  .tierBadge, .sourceLabel, .statusPill { display: inline-flex; align-items: center; min-height: 26px; padding: 4px 8px; border-radius: 999px; background: #eef3f8; color: #334155; font-size: 12px; font-weight: 700; }
  .tier-premier { background: #e7f7f1; color: #126344; }
  .tier-premium { background: #f5edff; color: #643499; }
  .tier-classic { background: #eef3f8; color: #334155; }
  .tier-custom { background: #fff5df; color: #865100; }
  .previewTotals { flex-wrap: wrap; margin-bottom: 10px; }
  .previewTotals span { background: #eef3f8; border-radius: 6px; padding: 6px 8px; font-size: 12px; font-weight: 700; }
  .previewItem, .customRequirementRow, .savedTemplateItem, .categorySummary div { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; border-top: 1px solid #edf1f6; padding: 9px 0; }
  .previewItem span { color: #657186; font-size: 12px; }
  .previewItem em { font-style: normal; text-transform: capitalize; font-weight: 700; }
  .action-protected em, .action-removable em { color: #a04400; }
  .issuePanel, .validNotice { padding: 12px 14px; }
  .issuePanel { border-color: #ffd1d1; color: #9b2c25; }
  .validNotice { border-color: #b7e2c6; color: #1d6d47; background: #e9f8ef; }
  .customAddRow { align-items: stretch; }
  .customAddRow input, .customAddRow select { flex: 1 1 140px; }
  .stageActions { display: flex; justify-content: flex-end; gap: 10px; position: sticky; bottom: 0; background: rgba(245,247,250,.95); padding: 14px 0; flex-wrap: wrap; }
  .persistenceNote { color: #657186; font-size: 13px; }
  @media (max-width: 1080px) { .templateWorkspace, .summaryBar, .tierGrid, .projectAreaCards { grid-template-columns: 1fr; } .sideColumn { order: -1; } }
  @media (max-width: 760px) { .templateStagePage { padding: 18px; } h1 { font-size: 28px; } .pageHeader, .panelHead, .groupHeader, .areaCardHeader, .rowActions, .stageActions, .customAddRow { align-items: stretch; flex-direction: column; } .areaTypeRow, .areaControls, .previewItem, .customRequirementRow, .savedTemplateItem, .categorySummary div { grid-template-columns: 1fr; } .tierOption { min-height: 72px; } }
`;
