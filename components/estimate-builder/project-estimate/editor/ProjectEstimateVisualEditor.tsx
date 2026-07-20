// @ts-nocheck
import { useMemo, useState } from "react";
import ProjectEstimateCanvas from "./ProjectEstimateCanvas";
import ProjectEstimateLayersPanel from "./ProjectEstimateLayersPanel";
import ProjectEstimatePropertiesPanel from "./ProjectEstimatePropertiesPanel";
import ProjectEstimateTextEditor from "./ProjectEstimateTextEditor";
import ProjectEstimateToolbar from "./ProjectEstimateToolbar";
import { pageObjectsFromBlocks } from "./projectEstimateObjectModel";

export default function ProjectEstimateVisualEditor({
  page,
  theme,
  linkedFields,
  Brochure,
  editMode,
  selectedBlockId,
  editingBlockId,
  readonly,
  onToggleEditMode,
  onSelectBlock,
  onEditBlock,
  onBlockContent,
  onBlockDesign,
  onSelectedBlockDesign,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlock,
  onAddBlock,
  onUploadLogo,
  onUploadImage,
  onOpenMediaLibrary,
  onReplaceImage,
  onUndo,
  onRedo,
}: any) {
  const [tab, setTab] = useState("properties");
  const [addOpen, setAddOpen] = useState(false);
  const objects = useMemo(() => pageObjectsFromBlocks(page), [page]);
  const selectedObject = objects.find((object: any) => object.id === selectedBlockId) || null;

  const patchFrame = (blockId: string, framePatch: any) => {
    const object = objects.find((item: any) => item.id === blockId);
    if (!object) return;
    onBlockDesign?.(blockId, "frame", { x: object.x, y: object.y, width: object.width, height: object.height, ...framePatch });
  };
  const patchSelectedFrame = (framePatch: any) => selectedObject && patchFrame(selectedObject.id, framePatch);
  const patchSelectedStyle = (stylePatch: any) => {
    if (!selectedObject) return;
    Object.entries(stylePatch || {}).forEach(([key, value]) => onBlockDesign?.(selectedObject.id, key, value));
  };

  return (
    <section style={styles.shell}>
      <ProjectEstimateToolbar
        editMode={editMode}
        selectedObject={selectedObject}
        addOpen={addOpen}
        onToggleAdd={() => setAddOpen((current) => !current)}
        onAdd={(type: string) => {
          setAddOpen(false);
          onAddBlock?.(type);
        }}
        onUndo={onUndo}
        onRedo={onRedo}
        onAlign={(align: string) => selectedObject && onBlockDesign?.(selectedObject.id, "textAlign", align)}
        onArrange={(direction: string) => selectedObject && onMoveBlock?.(selectedObject.id, direction)}
        onLock={() => selectedObject && onBlockDesign?.(selectedObject.id, "locked", !selectedObject.locked)}
        onDelete={() => selectedObject && onDeleteBlock?.(selectedObject.id)}
        onDone={onToggleEditMode}
        onReplaceImage={() => selectedObject && onReplaceImage?.(selectedObject.sourceBlock)}
        onImageFit={(fit: string) => {
          if (!selectedObject) return;
          if (fit === "crop") onBlockDesign?.(selectedObject.id, "objectFit", "cover");
          else onBlockDesign?.(selectedObject.id, "objectFit", fit);
        }}
        onResetImage={() => selectedObject && onBlockContent?.(selectedObject.id, selectedObject.type === "logo" ? "logoUrl" : "imageUrl", selectedObject.sourceBlock?.content?.defaultImageUrl || selectedObject.sourceBlock?.content?.defaultLogoUrl || "")}
      />
      {editMode && selectedObject && editingBlockId === selectedObject.id ? (
        <ProjectEstimateTextEditor object={selectedObject} onStyleChange={patchSelectedStyle} onUndo={onUndo} onRedo={onRedo} />
      ) : null}
      <div style={styles.body}>
        <main style={styles.canvasWrap}>
          <ProjectEstimateCanvas
            page={page}
            theme={theme}
            linkedFields={linkedFields}
            Brochure={Brochure}
            editMode={editMode}
            selectedId={selectedBlockId}
            editingId={editingBlockId}
            onSelect={onSelectBlock}
            onEdit={onEditBlock}
            onCommitText={onBlockContent}
            onPatchFrame={patchFrame}
            onReplaceImage={onReplaceImage}
          />
        </main>
        <aside style={styles.panel}>
          <div style={styles.tabs}>
            <button type="button" style={tab === "properties" ? styles.tabActive : styles.tab} onClick={() => setTab("properties")}>Properties</button>
            <button type="button" style={tab === "layers" ? styles.tabActive : styles.tab} onClick={() => setTab("layers")}>Layers</button>
          </div>
          {tab === "layers" ? (
            <ProjectEstimateLayersPanel
              objects={objects}
              selectedId={selectedBlockId}
              onSelect={onSelectBlock}
              onReorder={onMoveBlock}
              onToggleLock={(id: string) => {
                const object = objects.find((item: any) => item.id === id);
                if (object) onBlockDesign?.(id, "locked", !object.locked);
              }}
              onToggleHide={(id: string) => {
                const object = objects.find((item: any) => item.id === id);
                if (object) onBlockDesign?.(id, "hidden", !object.hidden);
              }}
            />
          ) : (
            <ProjectEstimatePropertiesPanel
              object={selectedObject}
              onPatchFrame={patchSelectedFrame}
              onPatchStyle={patchSelectedStyle}
              onDuplicate={() => selectedObject && onDuplicateBlock?.(selectedObject.id)}
              onDelete={() => selectedObject && onDeleteBlock?.(selectedObject.id)}
              onToggleLock={() => selectedObject && onBlockDesign?.(selectedObject.id, "locked", !selectedObject.locked)}
              onToggleHide={() => selectedObject && onBlockDesign?.(selectedObject.id, "hidden", !selectedObject.hidden)}
              onReplaceImage={() => selectedObject && onReplaceImage?.(selectedObject.sourceBlock)}
              onUploadImage={() => selectedObject?.type === "logo" ? onUploadLogo?.() : onUploadImage?.()}
              onOpenMediaLibrary={onOpenMediaLibrary}
              onRestoreDefaultImage={() => selectedObject && onBlockContent?.(selectedObject.id, selectedObject.type === "logo" ? "logoUrl" : "imageUrl", selectedObject.sourceBlock?.content?.defaultImageUrl || selectedObject.sourceBlock?.content?.defaultLogoUrl || "")}
            />
          )}
        </aside>
      </div>
    </section>
  );
}

const styles = {
  shell: { display: "grid", gap: 10 },
  body: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 12, alignItems: "start" },
  canvasWrap: { overflow: "auto", background: "#e5e7eb", border: "1px solid #cbd5e1", borderRadius: 8, padding: 18, maxHeight: "calc(100vh - 210px)" },
  panel: { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, padding: 10, maxHeight: "calc(100vh - 210px)", overflow: "auto" },
  tabs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 },
  tab: { height: 34, border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: 6, color: "#334155", fontWeight: 850, cursor: "pointer" },
  tabActive: { height: 34, border: "1px solid #0369a1", background: "#e0f2fe", borderRadius: 6, color: "#075985", fontWeight: 900, cursor: "pointer" },
};
