import { GroupedSectionInspector, TextOnlyInspector, INSPECTORS, CommonBlockInspector, EmailCanvasInspector } from "./blockInspectors.jsx";
import { CATALOG } from "./editorOptions.js";
import { normalizeEmailSettings } from "./blockModel.js";

export function EditorInspector({ selectedSectionBlock, panelMode, selectedBlock, blocks, patchCommonCardProps, addSiblingCardBlock, patchBlock, duplicateBlock, deleteBlock, uploadImage, openImageEdit, openLibrary, openAiImage, docSettings, setDocSettings }) {
  return (<div className="email-editor-inspector" style={{ width: 296, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden", color: "#0f172a" }}>
        {selectedSectionBlock && panelMode === "section" ? (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>🧩</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: "#0f172a" }}>{selectedSectionBlock.type === "gridCard" ? "Grid Section" : "List Section"}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
              <GroupedSectionInspector
                type={selectedSectionBlock.type}
                props={selectedSectionBlock.props}
                patchCommon={partial => patchCommonCardProps(selectedSectionBlock.props?.groupId, selectedSectionBlock.type, partial)}
                addSibling={() => addSiblingCardBlock(selectedSectionBlock.type, selectedSectionBlock.id)}
              />
            </div>
          </>
        ) : selectedBlock && panelMode === "text" ? (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>✍️</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: "#0f172a" }}>Text Editor</span>
              <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 600, color: "#64748b" }}>Focused text only</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
              <TextOnlyInspector
                block={selectedBlock}
                patch={partial => patchBlock(selectedBlock.id, partial)}
                patchCommon={partial => patchCommonCardProps(selectedBlock.props?.groupId, selectedBlock.type, partial)}
              />
            </div>
          </>
        ) : selectedBlock && panelMode === "block" ? (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>{CATALOG.find(c => c.type === selectedBlock.type)?.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: "#0f172a", textTransform: "capitalize" }}>{selectedBlock.type}</span>
              <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>Block {blocks.indexOf(selectedBlock) + 1} of {blocks.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
              {(() => {
                const Panel = INSPECTORS[selectedBlock.type];
                if (!Panel) return <div style={{ color: "#ef4444", fontSize: 16, fontWeight: 600 }}>No inspector for {selectedBlock.type}</div>;
                return (
                  <>
                    <CommonBlockInspector
                      block={selectedBlock}
                      patch={partial => patchBlock(selectedBlock.id, partial)}
                    />
                    <Panel
                      blockId={selectedBlock.id}
                      props={selectedBlock.props}
                      patch={partial => patchBlock(selectedBlock.id, partial)}
                      patchCommon={partial => patchCommonCardProps(selectedBlock.props?.groupId, selectedBlock.type, partial)}
                      addSibling={() => addSiblingCardBlock(selectedBlock.type, selectedBlock.id)}
                      duplicateCurrent={() => duplicateBlock(selectedBlock.id)}
                      removeCurrent={() => deleteBlock(selectedBlock.id)}
                      upload={(file, field, idx) => uploadImage(file, selectedBlock.id, field, idx)}
                      edit={(field, idx, src) => openImageEdit(selectedBlock.id, field, idx, src)}
                      library={(field, idx) => openLibrary(selectedBlock.id, field, idx)}
                      aiImage={(field, idx) => openAiImage(selectedBlock.id, field, idx)}
                    />
                  </>
                );
              })()}
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>🎨</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: "#0f172a" }}>Email Canvas</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
              <div style={{ color: "#64748b", fontSize: 16, fontWeight: 600, marginBottom: 12, lineHeight: 1.5 }}>
                Click empty space or use Email Style to edit the whole email background and canvas look.
              </div>
              <EmailCanvasInspector
                props={docSettings}
                patch={partial => setDocSettings(prev => normalizeEmailSettings({ ...prev, ...partial }))}
                upload={(file, field, idx) => uploadImage(file, "__emailSettings", field, idx)}
                edit={(field, idx, src) => openImageEdit("__emailSettings", field, idx, src)}
                library={(field, idx) => openLibrary("__emailSettings", field, idx)}
                aiImage={(field, idx) => openAiImage("__emailSettings", field, idx)}
              />
            </div>
          </>
        )}
      </div>);
}
