import { createImageStackLayer, createTextStackLayer, parsePixelValue, openSharedLibraryAssetPicker } from "./pbEditorUtils";
import { styles } from "./pbStyles";
import { NumberField, normalizeColorInput } from "./pbPropertiesPanels";

export function ImageStackPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage }) {
  const props = block?.props || {};
  const layers = Array.isArray(props.images) ? props.images : [];
  const savedImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
  const libraryImages = [brandAssets?.logo, ...savedImages].filter(Boolean).slice(0, 12);
  const selectedLayerIndex = Number.isInteger(props.selectedLayerIndex) && props.selectedLayerIndex >= 0 && props.selectedLayerIndex < layers.length
    ? props.selectedLayerIndex
    : null;
  const activeLayer = selectedLayerIndex !== null ? layers[selectedLayerIndex] : null;

  const update = (patch) => onChange(index, { ...props, ...patch });
  const normalizeLayers = (nextLayers) => nextLayers.map((layer, layerIndex) => ({
    ...layer,
    zIndex: layerIndex + 1,
  }));
  const updateLayer = (layerIndex, patch) => {
    update({
      images: layers.map((layer, currentIndex) => (
        currentIndex === layerIndex ? { ...layer, ...patch } : layer
      )),
    });
  };

  const addImageLayer = () => {
    update({ images: [...layers, createImageStackLayer(layers.length)], selectedLayerIndex: layers.length });
  };

  const addTextLayer = () => {
    update({ images: [...layers, createTextStackLayer(layers.length)], selectedLayerIndex: layers.length });
  };

  const addLogoLayer = () => {
    const logo = brandAssets?.logo;
    if (!logo?.src) return;
    update({
      images: [
        ...layers,
        {
          ...createImageStackLayer(layers.length),
          src: logo.src,
          assetId: logo.id || "",
          width: 180,
          height: 90,
          rotation: 0,
        },
      ],
      selectedLayerIndex: layers.length,
    });
  };

  const moveLayerOrder = (layerIndex, direction) => {
    const nextIndex = layerIndex + direction;
    if (nextIndex < 0 || nextIndex >= layers.length) return;
    const nextLayers = [...layers];
    const [moved] = nextLayers.splice(layerIndex, 1);
    nextLayers.splice(nextIndex, 0, moved);
    update({ images: normalizeLayers(nextLayers), selectedLayerIndex: nextIndex });
  };

  const alignLayerToCanvas = (layerIndex, axis, value) => {
    const layer = layers[layerIndex];
    if (!layer) return;

    if (axis === "x") {
      const canvasEl = document.querySelector("[data-image-stack-canvas]");
      const canvasWidth = canvasEl ? Math.round(canvasEl.getBoundingClientRect().width) : 1100;
      const layerWidth = Number(layer.width || 320);
      let nextX = Number(layer.x || 0);
      if (value === "left") nextX = 24;
      if (value === "center") nextX = Math.max(0, Math.round((canvasWidth - layerWidth) / 2));
      if (value === "right") nextX = Math.max(24, canvasWidth - layerWidth - 24);
      updateLayer(layerIndex, { x: nextX, textAlign: value });
      return;
    }

    const canvasHeight = parsePixelValue(props.minHeight, 560);
    const layerHeight = Number(layer.height || 140);
    let nextY = Number(layer.y || 0);
    if (value === "top") nextY = 24;
    if (value === "center") nextY = Math.max(0, Math.round((canvasHeight - layerHeight) / 2));
    if (value === "bottom") nextY = Math.max(24, canvasHeight - layerHeight - 24);
    updateLayer(layerIndex, { y: nextY, verticalAlign: value });
  };

  const removeLayer = (layerIndex) => {
    const nextLayers = normalizeLayers(layers.filter((_, currentIndex) => currentIndex !== layerIndex));
    update({
      images: nextLayers,
      selectedLayerIndex: nextLayers.length ? Math.min(layerIndex, nextLayers.length - 1) : null,
    });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🖼️ Edit: Layered Image Stack</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Canvas Title</label>
          <input
            type="text"
            value={props.title || ""}
            onChange={(e) => update({ title: e.target.value })}
            style={styles.propertyInput}
          />
          <label style={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={props.showGrid !== false}
              onChange={(e) => update({ showGrid: e.target.checked })}
            />
            Show design grid and snap layers to it
          </label>
          <label style={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={(props.fullWidth ?? props.fullWidthBackground) === true}
              onChange={(e) => update({ fullWidth: e.target.checked, fullWidthBackground: e.target.checked })}
            />
            Full Width
          </label>
          <div style={styles.colorGrid}>
            <NumberField
              label="Canvas Height"
              value={parsePixelValue(props.minHeight, 560)}
              min={240}
              max={1400}
              onChange={(value) => update({ minHeight: `${Math.max(240, value)}px` })}
            />
            <NumberField
              label="Canvas Width"
              value={Number(props.baseLayoutWidth || 1100)}
              min={720}
              max={2400}
              onChange={(value) => update({ baseLayoutWidth: Math.max(720, value) })}
            />
            <div style={styles.colorField}>
              <span style={styles.colorLabel}>Background</span>
              <input
                type="color"
                value={normalizeColorInput(props.backgroundColor, "#f8fafc")}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                style={styles.colorInput}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" style={styles.formatBtn} onClick={() => update({ backgroundColor: "transparent" })}>
              Transparent Canvas
            </button>
          </div>
          <div style={styles.assetPicker}>
            <button type="button" style={styles.secondaryBtn} onClick={addImageLayer}>
              + Add Image Layer
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={addTextLayer}>
              + Add Text Layer
            </button>
            {brandAssets?.logo?.src ? (
              <button type="button" style={styles.secondaryBtn} onClick={addLogoLayer}>
                + Add Logo Layer
              </button>
            ) : null}
          </div>
          {layers.length ? (
            <div style={styles.assetPicker}>
              {layers.map((layer, layerIndex) => (
                <button
                  key={layer.id || `select-layer-${layerIndex}`}
                  type="button"
                  style={{
                    ...styles.assetChip,
                    ...(selectedLayerIndex === layerIndex ? { background: "#7df9a1", borderColor: "#7df9a1", color: "#04202e" } : {}),
                  }}
                  onClick={() => update({ selectedLayerIndex: layerIndex })}
                >
                  {layer.kind === "text" ? `Text ${layerIndex + 1}` : `Image ${layerIndex + 1}`}
                </button>
              ))}
              {selectedLayerIndex !== null ? (
                <button
                  type="button"
                  style={{ ...styles.assetChip, background: "transparent", borderColor: "#475569", color: "#cbd5e1" }}
                  onClick={() => update({ selectedLayerIndex: null })}
                >
                  Clear Selection
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {activeLayer ? (
          <div key={activeLayer.id || `layer-${selectedLayerIndex}`} style={styles.linkRowCard}>
            <div style={styles.linkRowHeader}>
              <span style={styles.linkRowTitle}>{activeLayer.kind === "text" ? `Text Layer ${selectedLayerIndex + 1}` : `Image Layer ${selectedLayerIndex + 1}`}</span>
              <div style={styles.linkActions}>
                <button type="button" style={styles.linkMoveBtn} onClick={() => moveLayerOrder(selectedLayerIndex, -1)} title="Send back">←</button>
                <button type="button" style={styles.linkMoveBtn} onClick={() => moveLayerOrder(selectedLayerIndex, 1)} title="Bring forward">→</button>
                <button type="button" style={styles.linkRowDelete} onClick={() => removeLayer(selectedLayerIndex)}>
                  Remove
                </button>
              </div>
            </div>
            {activeLayer.kind === "text" ? (
              <div style={styles.sectionCard}>
                <p style={{ margin: 0, color: "#9fb0c5", fontSize: 16 }}>
                  Edit, resize, and move this text directly on the canvas. Use the top text bar when the text is selected.
                </p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={activeLayer.src || ""}
                  onChange={(e) => updateLayer(selectedLayerIndex, { src: e.target.value, assetId: "", kind: "image" })}
                  style={styles.propertyInput}
                  placeholder="Paste image URL or upload one"
                />
                <div style={styles.colorGrid}>
                  <NumberField label="X" value={Number(activeLayer.x || 0)} min={0} max={2000} onChange={(value) => updateLayer(selectedLayerIndex, { x: value })} />
                  <NumberField label="Y" value={Number(activeLayer.y || 0)} min={0} max={2000} onChange={(value) => updateLayer(selectedLayerIndex, { y: value })} />
                  <NumberField label="Width" value={Number(activeLayer.width || 260)} min={80} max={1600} onChange={(value) => updateLayer(selectedLayerIndex, { width: value })} />
                  <NumberField label="Height" value={Number(activeLayer.height || 180)} min={80} max={1600} onChange={(value) => updateLayer(selectedLayerIndex, { height: value })} />
                </div>
                <div style={styles.colorGrid}>
                  <NumberField label="Rotate" value={Number(activeLayer.rotation || 0)} min={-45} max={45} onChange={(value) => updateLayer(selectedLayerIndex, { rotation: value })} />
                  <NumberField label="Radius" value={Number(activeLayer.radius || 18)} min={0} max={100} onChange={(value) => updateLayer(selectedLayerIndex, { radius: value })} />
                </div>
                <div style={styles.assetPicker}>
                  <label style={styles.assetUploadCta}>
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      style={styles.hiddenInput}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const asset = await Promise.resolve(onUploadImage?.(index, "__image_stack_layer__", file));
                        if (asset?.src) {
                          updateLayer(selectedLayerIndex, {
                            kind: "image",
                            src: String(asset.src || "").startsWith("data:") ? "" : asset.src,
                            assetId: asset.id || "",
                          });
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={() => openSharedLibraryAssetPicker((asset) => updateLayer(selectedLayerIndex, {
                      kind: "image",
                      src: String(asset.src || "").startsWith("data:") ? "" : (asset.src || ""),
                      assetId: asset.id || "",
                    }))}
                  >
                    Choose From Library
                  </button>
                  {libraryImages.map((image, imageIndex) => (
                    <button
                      key={`${image.id || image.name || "asset"}-${imageIndex}`}
                      type="button"
                      style={styles.assetThumbBtn}
                      onClick={() => updateLayer(selectedLayerIndex, { kind: "image", src: image.src || "", assetId: image.id || "" })}
                      title={image.name || `Asset ${imageIndex + 1}`}
                    >
                      <img src={image.src} alt={image.name || `Asset ${imageIndex + 1}`} style={styles.assetThumbPreview} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={styles.sectionCard}>
            <p style={{ margin: 0, color: "#9fb0c5", fontSize: 16 }}>
              Click one image or text layer on the canvas to edit only that layer here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
