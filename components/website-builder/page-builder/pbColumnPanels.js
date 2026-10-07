import { BlockTypes, BlockDefinitions } from "../../../lib/website-builder/pageBlockComponents";
import { applyAssetToProps, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { styles } from "./pbStyles";
import { ColorSelector, NumberField, CompactColorField } from "./pbPropertiesPanels";
import { parsePixelValue, openSharedLibraryAssetPicker } from "./pbEditorUtils";

export function getColumnEditorConfigs(blockType) {
  if (blockType === BlockTypes.COLUMNS_2) {
    return [
      {
        id: "left-column",
        label: "Left Column",
        titleKey: "leftTitle",
        contentKey: "leftContent",
        imageKey: "leftImage",
        prefix: "leftColumn",
      },
      {
        id: "right-column",
        label: "Right Column",
        titleKey: "rightTitle",
        contentKey: "rightContent",
        imageKey: "rightImage",
        prefix: "rightColumn",
      },
    ];
  }

  if (blockType === BlockTypes.COLUMNS_3) {
    return [
      { id: "column-1", label: "Column 1", titleKey: "column1Title", contentKey: "column1", imageKey: "column1Image", prefix: "column1" },
      { id: "column-2", label: "Column 2", titleKey: "column2Title", contentKey: "column2", imageKey: "column2Image", prefix: "column2" },
      { id: "column-3", label: "Column 3", titleKey: "column3Title", contentKey: "column3", imageKey: "column3Image", prefix: "column3" },
    ];
  }

  return [];
}

export function ColumnsPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, onOpenImageEditor }) {
  const props = block?.props || {};
  const columnConfigs = getColumnEditorConfigs(block?.type);
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const update = (patch) => onChange(index, { ...props, ...patch });

  function swapColumns() {
    if (block?.type !== BlockTypes.COLUMNS_2) return;
    onChange(index, {
      ...props,
      ratio: props.ratio === "60-40" ? "40-60" : props.ratio === "40-60" ? "60-40" : props.ratio,
      leftTitle: props.rightTitle,
      leftContent: props.rightContent,
      leftImage: props.rightImage,
      leftImageAssetId: props.rightImageAssetId,
      leftImageHeight: props.rightImageHeight,
      leftImageWidth: props.rightImageWidth,
      leftColumnContentType: props.rightColumnContentType,
      leftColumnNewsletterHeading: props.rightColumnNewsletterHeading,
      leftColumnNewsletterSubtitle: props.rightColumnNewsletterSubtitle,
      leftColumnNewsletterFields: props.rightColumnNewsletterFields,
      leftColumnNewsletterButtonText: props.rightColumnNewsletterButtonText,
      leftColumnNewsletterButtonColor: props.rightColumnNewsletterButtonColor,
      leftColumnNewsletterButtonTextColor: props.rightColumnNewsletterButtonTextColor,
      leftColumnNewsletterImage: props.rightColumnNewsletterImage,
      leftColumnNewsletterImageAssetId: props.rightColumnNewsletterImageAssetId,
      leftColumnNewsletterImageHeight: props.rightColumnNewsletterImageHeight,
      leftColumnNewsletterImageWidth: props.rightColumnNewsletterImageWidth,
      leftColumnWidth: props.rightColumnWidth,
      rightTitle: props.leftTitle,
      rightContent: props.leftContent,
      rightImage: props.leftImage,
      rightImageAssetId: props.leftImageAssetId,
      rightImageHeight: props.leftImageHeight,
      rightImageWidth: props.leftImageWidth,
      rightColumnContentType: props.leftColumnContentType,
      rightColumnNewsletterHeading: props.leftColumnNewsletterHeading,
      rightColumnNewsletterSubtitle: props.leftColumnNewsletterSubtitle,
      rightColumnNewsletterFields: props.leftColumnNewsletterFields,
      rightColumnNewsletterButtonText: props.leftColumnNewsletterButtonText,
      rightColumnNewsletterButtonColor: props.leftColumnNewsletterButtonColor,
      rightColumnNewsletterButtonTextColor: props.leftColumnNewsletterButtonTextColor,
      rightColumnNewsletterImage: props.leftColumnNewsletterImage,
      rightColumnNewsletterImageAssetId: props.leftColumnNewsletterImageAssetId,
      rightColumnNewsletterImageHeight: props.leftColumnNewsletterImageHeight,
      rightColumnNewsletterImageWidth: props.leftColumnNewsletterImageWidth,
      rightColumnWidth: props.leftColumnWidth,
    });
  }

  async function applyUploadedAsset(fieldKey, file) {
    const asset = await Promise.resolve(onUploadImage?.(index, fieldKey, file));
    if (!asset?.src) return;

    const nextProps = applyAssetToProps(props, fieldKey, asset);
    onChange(index, {
      ...nextProps,
      [fieldKey]: String(asset.src || "").startsWith("data:") ? "" : asset.src,
    });
  }

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🧱 Edit: Columns</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Background</label>
          <div style={styles.colorGrid}>
            <ColorSelector label="Background Color" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <ColorSelector label="Border Color" value={props.borderColor || "rgba(148,163,184,0.28)"} fallback="rgba(148,163,184,0.28)" onChange={(value) => update({ borderColor: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Gradient</label>
          <input type="text" value={String(props.backgroundColor || "")} onChange={(e) => update({ backgroundColor: e.target.value })} style={styles.propertyInput} placeholder="e.g. linear-gradient(135deg,#0f172a,#1e3a5f)" />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Layout</label>
          <label style={{ ...styles.propertyLabel, marginTop: 0 }}>Section Heading (leave blank to hide)</label>
          <input type="text" value={props.title || ""} onChange={(e) => update({ title: e.target.value })} style={styles.propertyInput} placeholder="Leave blank for no heading" />
          {block.type === BlockTypes.COLUMNS_2 ? (
            <button type="button" style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%" }} onClick={swapColumns}>Swap Left / Right Columns</button>
          ) : null}
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            {block.type === BlockTypes.COLUMNS_2 ? (
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Column Ratio</label>
                <select value={String(props.ratio || "50-50")} onChange={(e) => update({ ratio: e.target.value })} style={styles.propertyInput}>
                  <option value="50-50">50 / 50</option>
                  <option value="60-40">60 / 40</option>
                  <option value="40-60">40 / 60</option>
                </select>
              </div>
            ) : null}
            <NumberField label="Section Height" value={parsePixelValue(props.minHeight, 280)} min={160} max={1200} onChange={(value) => update({ minHeight: `${value}px` })} />
            <NumberField label="Block Max Width" value={Number(props.blockMaxWidth) || 1200} min={320} max={1800} onChange={(value) => update({ blockMaxWidth: value })} />
            <NumberField label="Columns Gap" value={Number(props.columnGap ?? 18)} min={0} max={120} onChange={(value) => update({ columnGap: value })} />
            <NumberField label="Top Margin" value={Number(props.columnsTopMargin ?? 16)} min={0} max={240} onChange={(value) => update({ columnsTopMargin: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Vertical Alignment</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "top", label: "Top" },
              { value: "center", label: "Center" },
              { value: "bottom", label: "Bottom" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnsVerticalAlign || "top") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnsVerticalAlign: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Shared Column Design</label>
          <div style={styles.colorGrid}>
            <ColorSelector label="Default Background" value={props.columnBackgroundColor || props.cardBackgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ columnBackgroundColor: value })} />
            <ColorSelector label="Border" value={props.columnBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ columnBorderColor: value })} />
          </div>
          <div style={styles.colorGrid}>
            <NumberField label="Padding" value={Number(props.columnPadding ?? 18)} min={0} max={96} onChange={(value) => update({ columnPadding: value })} />
            <NumberField label="Radius" value={Number(props.columnRadius ?? 18)} min={0} max={80} onChange={(value) => update({ columnRadius: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Text Alignment</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnContentAlign || "left") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnContentAlign: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Shadow</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "none", label: "None" },
              { value: "soft", label: "Soft" },
              { value: "medium", label: "Medium" },
              { value: "strong", label: "Strong" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnShadow || "soft") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnShadow: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Gradient / Overlay</label>
          <input type="text" value={String(props.columnGradient || "")} onChange={(e) => update({ columnGradient: e.target.value })} style={styles.propertyInput} placeholder="linear-gradient(...)" />
          <div style={{ marginTop: 8 }}>
            <ColorSelector label="Overlay Color" value={props.columnOverlayColor || "transparent"} fallback="#000000" allowTransparent onChange={(value) => update({ columnOverlayColor: value })} />
          </div>
        </div>

        {columnConfigs.map((column) => {
          const imageValue = resolveAssetField(props, column.imageKey, brandAssets) || props?.[column.imageKey] || "";
          const rawContentType = String(props?.[`${column.prefix}ContentType`] || "text");
          const colContentType = rawContentType === "newsletter" ? "newsletter" : "text";
          const isNewsletter = colContentType === "newsletter";
          const isBlock = false;
          const embeddedBlock = props?.[`${column.prefix}Block`] || null;
          const colBg = props[`${column.prefix}BackgroundColor`] || props.columnBackgroundColor || props.cardBackgroundColor || "#f8fafc";
          return (
            <div key={column.id} style={{ ...styles.sectionCard, borderLeft: `4px solid ${colBg}`, background: "rgba(0,0,0,0.15)" }}>
              <label style={styles.propertyLabel}>{column.label}</label>

              {/* Per-column background */}
              <div style={styles.colorGrid}>
                <ColorSelector label="Card Background" value={colBg} fallback="#f8fafc" onChange={(value) => update({ [`${column.prefix}BackgroundColor`]: value })} />
              </div>

              {/* Card width */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <NumberField label="Card Width (fr)" value={Number(props[`${column.prefix}Width`]) || 1} min={1} max={10} onChange={(value) => update({ [`${column.prefix}Width`]: value })} />
              </div>

              {/* Column type selector */}
              <div style={styles.inlineChipRow}>
                {[{ value: "text", label: "📝 Text / Image" }, { value: "newsletter", label: "📬 Newsletter" }].map((opt) => (
                  <button key={opt.value} type="button"
                    style={{ ...styles.presetChip, ...(colContentType === opt.value ? styles.presetChipActive : {}) }}
                    onClick={() => update({ [`${column.prefix}ContentType`]: opt.value, [`${column.prefix}Block`]: null })}
                  >{opt.label}</button>
                ))}
              </div>

              {isBlock ? (
                <div style={{ marginTop: 8 }}>
                  {embeddedBlock ? (
                    <>
                      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#94a3b8" }}>
                        Embedded: <strong style={{ color: "#e2e8f0" }}>{BlockDefinitions[embeddedBlock.type]?.name || embeddedBlock.type}</strong>
                      </p>
                      <button
                        type="button"
                        style={{ ...styles.secondaryBtn, borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5", marginBottom: 12 }}
                        onClick={() => update({ [`${column.prefix}Block`]: null, [`${column.prefix}ContentType`]: "text" })}
                      >
                        Remove Embedded Block
                      </button>

                      {/* ── Inline editor for embedded competitor-comparison ── */}
                      {embeddedBlock.type === BlockTypes.COMPETITOR_COMPARISON ? (() => {
                        const ebProps = embeddedBlock.props || {};
                        const updateEB = (patch) => update({ [`${column.prefix}Block`]: { ...embeddedBlock, props: { ...ebProps, ...patch } } });
                        const ebRows = Array.isArray(ebProps.rows) ? ebProps.rows : [];
                        return (
                          <div style={{ borderTop: "1px solid rgba(148,163,184,0.18)", paddingTop: 12, display: "grid", gap: 10 }}>
                            <label style={styles.propertyLabel}>💸 Pricing Comparison — Header</label>
                            <input type="text" value={String(ebProps.eyebrow || "")} onChange={(e) => updateEB({ eyebrow: e.target.value })} style={styles.propertyInput} placeholder="our All-in-One Platform" />
                            <input type="text" value={String(ebProps.title || "")} onChange={(e) => updateEB({ title: e.target.value })} style={styles.propertyInput} placeholder="Optional heading" />
                            <input type="text" value={String(ebProps.subtitle || "")} onChange={(e) => updateEB({ subtitle: e.target.value })} style={styles.propertyInput} placeholder="Subtitle (optional)" />

                            <label style={{ ...styles.propertyLabel, marginTop: 4 }}>Your Plan (bottom row)</label>
                            <input type="text" value={String(ebProps.planName || "")} onChange={(e) => updateEB({ planName: e.target.value })} style={styles.propertyInput} placeholder="COMPETITOR ANALYSIS" />
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 60 }}>$/mo</span>
                              <input type="number" value={Number(ebProps.planPrice ?? 299)} min={0} onChange={(e) => updateEB({ planPrice: Number(e.target.value) })} style={{ ...styles.propertyInput, width: 90 }} />
                            </div>
                            <input type="text" value={String(ebProps.planTagline || "")} onChange={(e) => updateEB({ planTagline: e.target.value })} style={styles.propertyInput} placeholder="Everything above, included" />
                            <input type="text" value={String(ebProps.uniqueLabel || "")} onChange={(e) => updateEB({ uniqueLabel: e.target.value })} style={styles.propertyInput} placeholder="Unique to us" />

                            <label style={{ ...styles.propertyLabel, marginTop: 4 }}>Feature Rows</label>
                            {ebRows.map((row, rowIdx) => {
                              const rowLogos = Array.isArray(row.logos) ? row.logos : [];
                              return (
                                <div key={rowIdx} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,0.03)", display: "grid", gap: 6 }}>
                                  {/* Row header: name + price + delete */}
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input
                                      type="text"
                                      value={String(row.category || "")}
                                      onChange={(e) => {
                                        const next = ebRows.map((r, i) => i === rowIdx ? { ...r, category: e.target.value } : r);
                                        updateEB({ rows: next });
                                      }}
                                      style={{ ...styles.propertyInput, flex: 1, margin: 0, fontSize: 12 }}
                                      placeholder="Feature name"
                                    />
                                    <span style={{ color: "#94a3b8", fontSize: 12, flexShrink: 0 }}>$</span>
                                    <input
                                      type="number"
                                      value={Number(row.price ?? 0)}
                                      min={0}
                                      onChange={(e) => {
                                        const next = ebRows.map((r, i) => i === rowIdx ? { ...r, price: Number(e.target.value) } : r);
                                        updateEB({ rows: next });
                                      }}
                                      style={{ ...styles.propertyInput, width: 72, margin: 0 }}
                                    />
                                    <button
                                      type="button"
                                      style={{ padding: "3px 7px", borderRadius: 5, border: "none", background: "#334155", color: "#f87171", cursor: "pointer", flexShrink: 0 }}
                                      onClick={() => updateEB({ rows: ebRows.filter((_, i) => i !== rowIdx) })}
                                    >✕</button>
                                  </div>
                                  {/* Logos */}
                                  <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Competitor logos — upload an image or enter a domain</p>
                                  {rowLogos.map((logo, logoIdx) => (
                                    <div key={logoIdx} style={{ display: "grid", gap: 4 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                        {/* Preview */}
                                        {(logo.src || logo.domain) ? (
                                          <img
                                            src={logo.src || `https://logo.clearbit.com/${logo.domain}`}
                                            alt={logo.name || logo.domain || "logo"}
                                            width={22} height={22}
                                            style={{ borderRadius: "50%", background: "#fff", objectFit: "contain", border: "1px solid rgba(148,163,184,0.3)", flexShrink: 0 }}
                                            onError={(e) => { if (!logo.src) e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${logo.domain}&sz=64`; }}
                                          />
                                        ) : (
                                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(148,163,184,0.2)", flexShrink: 0 }} />
                                        )}
                                        {/* Tool name */}
                                        <input
                                          type="text"
                                          value={String(logo.name || "")}
                                          onChange={(e) => {
                                            const nextLogos = rowLogos.map((l, li) => li === logoIdx ? { ...l, name: e.target.value } : l);
                                            const next = ebRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                                            updateEB({ rows: next });
                                          }}
                                          style={{ ...styles.propertyInput, flex: 1, margin: 0, fontSize: 12 }}
                                          placeholder="Tool name"
                                        />
                                        <button
                                          type="button"
                                          style={{ padding: "2px 6px", borderRadius: 5, border: "none", background: "#334155", color: "#f87171", cursor: "pointer", flexShrink: 0 }}
                                          onClick={() => {
                                            const nextLogos = rowLogos.filter((_, li) => li !== logoIdx);
                                            const next = ebRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                                            updateEB({ rows: next });
                                          }}
                                        >✕</button>
                                      </div>
                                      {/* Upload or domain */}
                                      <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 27 }}>
                                        <label style={{ ...styles.assetUploadCta, fontSize: 11, padding: "2px 8px", margin: 0, cursor: "pointer" }}>
                                          Upload
                                          <input
                                            type="file"
                                            accept="image/*"
                                            style={styles.hiddenInput}
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              e.target.value = "";
                                              if (!file) return;
                                              const asset = await Promise.resolve(onUploadImage?.(index, `cc_logo_${rowIdx}_${logoIdx}`, file));
                                              if (!asset?.src) return;
                                              const nextLogos = rowLogos.map((l, li) => li === logoIdx ? { ...l, src: asset.src, domain: "" } : l);
                                              const next = ebRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                                              updateEB({ rows: next });
                                            }}
                                          />
                                        </label>
                                        <span style={{ color: "#475569", fontSize: 11 }}>or domain:</span>
                                        <input
                                          type="text"
                                          value={String(logo.domain || "")}
                                          onChange={(e) => {
                                            const nextLogos = rowLogos.map((l, li) => li === logoIdx ? { ...l, domain: e.target.value, src: "" } : l);
                                            const next = ebRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                                            updateEB({ rows: next });
                                          }}
                                          style={{ ...styles.propertyInput, flex: 1, margin: 0, fontSize: 11 }}
                                          placeholder="asana.com"
                                        />
                                        {logo.src ? (
                                          <button
                                            type="button"
                                            style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "none", background: "#334155", color: "#94a3b8", cursor: "pointer", flexShrink: 0 }}
                                            onClick={() => {
                                              const nextLogos = rowLogos.map((l, li) => li === logoIdx ? { ...l, src: "" } : l);
                                              const next = ebRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                                              updateEB({ rows: next });
                                            }}
                                          >✕ img</button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    style={{ ...styles.secondaryBtn, fontSize: 12, padding: "3px 10px" }}
                                    onClick={() => {
                                      const nextLogos = [...rowLogos, { domain: "", name: "", src: "" }];
                                      const next = ebRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                                      updateEB({ rows: next });
                                    }}
                                  >+ Add Logo</button>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              style={{ ...styles.secondaryBtn, width: "100%", marginTop: 2 }}
                              onClick={() => updateEB({ rows: [...ebRows, { category: "NEW FEATURE", logos: [], price: 0 }] })}
                            >+ Add Row</button>
                          </div>
                        );
                      })() : null}
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
                      Drag any block from the canvas using its ⠿ drag handle and drop it onto the column slot that appears on this block.
                    </p>
                  )}
                </div>
              ) : null}

              {isNewsletter ? (
                /* Newsletter column config */
                <>
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Image Above Form</label>
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
                          await applyUploadedAsset(`${column.prefix}NewsletterImage`, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      onClick={() => openSharedLibraryAssetPicker((asset) => {
                        const nextProps = applyAssetToProps(props, `${column.prefix}NewsletterImage`, asset);
                        onChange(index, { ...nextProps, [`${column.prefix}NewsletterImage`]: asset.src || "" });
                      })}
                    >
                      Choose From Library
                    </button>
                    {savedImages.map((asset) => (
                      <button
                        key={`nl-img-${column.id}-${asset.id || asset.src}`}
                        type="button"
                        style={styles.assetThumbBtn}
                        title={asset.name || "Image"}
                        onClick={() => {
                          const nextProps = applyAssetToProps(props, `${column.prefix}NewsletterImage`, asset);
                          onChange(index, { ...nextProps, [`${column.prefix}NewsletterImage`]: asset.src || "" });
                        }}
                      >
                        <img src={asset.src} alt={asset.name || "Image"} style={styles.assetThumbPreview} />
                      </button>
                    ))}
                    {resolveAssetField(props, `${column.prefix}NewsletterImage`, brandAssets) ? (
                      <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ [`${column.prefix}NewsletterImage`]: "", [`${column.prefix}NewsletterImageAssetId`]: undefined })}>
                        Remove Image
                      </button>
                    ) : null}
                  </div>
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Heading</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterHeading`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterHeading`]: e.target.value })} style={styles.propertyInput} placeholder="Stay Updated" />
                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subtitle</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterSubtitle`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterSubtitle`]: e.target.value })} style={styles.propertyInput} placeholder="Get the latest news." />

                  {/* Form Fields */}
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Form Fields</label>
                  {(() => {
                    const fields = Array.isArray(props?.[`${column.prefix}NewsletterFields`]) ? props[`${column.prefix}NewsletterFields`] : [{ type: "email", placeholder: "Email address" }];
                    const fieldTypes = [
                      { value: "name", label: "Name" },
                      { value: "firstName", label: "First Name" },
                      { value: "lastName", label: "Last Name" },
                      { value: "email", label: "Email" },
                      { value: "phone", label: "Phone" },
                      { value: "company", label: "Company" },
                      { value: "message", label: "Message" },
                    ];
                    const setFields = (next) => update({ [`${column.prefix}NewsletterFields`]: next });
                    return (
                      <>
                        {fields.map((field, fi) => (
                          <div key={fi} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                            <select
                              value={field.type || "email"}
                              onChange={(e) => { const next = [...fields]; next[fi] = { ...next[fi], type: e.target.value, placeholder: fieldTypes.find(f => f.value === e.target.value)?.label || e.target.value }; setFields(next); }}
                              style={{ ...styles.propertyInput, flex: 1, margin: 0 }}
                            >
                              {fieldTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                            </select>
                            <input
                              type="text"
                              value={field.placeholder || ""}
                              placeholder="Placeholder"
                              onChange={(e) => { const next = [...fields]; next[fi] = { ...next[fi], placeholder: e.target.value }; setFields(next); }}
                              style={{ ...styles.propertyInput, flex: 1, margin: 0 }}
                            />
                            <button
                              type="button"
                              style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca", flexShrink: 0, padding: "4px 8px" }}
                              onClick={() => setFields(fields.filter((_, i) => i !== fi))}
                            >✕</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          style={{ ...styles.secondaryBtn, width: "100%", marginTop: 4 }}
                          onClick={() => setFields([...fields, { type: "email", placeholder: "Email address" }])}
                        >+ Add Field</button>
                      </>
                    );
                  })()}

                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Button Text</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterButtonText`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterButtonText`]: e.target.value })} style={styles.propertyInput} placeholder="Subscribe" />
                  <div style={{ ...styles.colorGrid, marginTop: 8 }}>
                    <CompactColorField label="Button Bg" value={props?.[`${column.prefix}NewsletterButtonColor`] || "#2563eb"} fallback="#2563eb" onChange={(v) => update({ [`${column.prefix}NewsletterButtonColor`]: v })} />
                    <CompactColorField label="Button Text" value={props?.[`${column.prefix}NewsletterButtonTextColor`] || "#ffffff"} fallback="#ffffff" onChange={(v) => update({ [`${column.prefix}NewsletterButtonTextColor`]: v })} />
                  </div>
                </>
              ) : (
                /* Text/Image column config */
                <>
                  <input type="text" value={String(props?.[column.titleKey] || "")} onChange={(e) => update({ [column.titleKey]: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Column title" />
                  <textarea value={String(props?.[column.contentKey] || "")} onChange={(e) => update({ [column.contentKey]: e.target.value })} style={{ ...styles.propertyInput, minHeight: 96 }} placeholder="Column content" />
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
                          await applyUploadedAsset(column.imageKey, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset?.(index, column.imageKey, asset))}
                    >
                      Choose From Library
                    </button>
                    {savedImages.map((asset) => (
                      <button
                        key={`${column.id}-${asset.id || asset.src}`}
                        type="button"
                        style={styles.assetThumbBtn}
                        title={asset.name || column.label}
                        onClick={() => {
                          const nextProps = applyAssetToProps(props, column.imageKey, asset);
                          onChange(index, { ...nextProps, [column.imageKey]: asset.src || "" });
                          onSelectAsset?.(index, column.imageKey, asset);
                        }}
                      >
                        <img src={asset.src} alt={asset.name || column.label} style={styles.assetThumbPreview} />
                      </button>
                    ))}
                    {imageValue ? (
                      <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ [column.imageKey]: "", [`${column.imageKey}AssetId`]: undefined })}>
                        Remove Image
                      </button>
                    ) : null}
                  </div>
                  {imageValue ? (
                    <button
                      type="button"
                      style={{ ...styles.secondaryBtn, marginTop: 8 }}
                      onClick={() => onOpenImageEditor?.(index, column.imageKey, imageValue)}
                    >
                      ✂️ Crop / Edit Image
                    </button>
                  ) : null}
                  {imageValue ? (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={styles.label}>Image Height (px)</label>
                      <input
                        type="number"
                        min={60}
                        max={1200}
                        step={10}
                        value={props?.[`${column.prefix}ImageHeight`] || ""}
                        placeholder="Auto"
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          update({ [`${column.prefix}ImageHeight`]: val });
                        }}
                        style={{ ...styles.input, width: 90 }}
                      />
                      {props?.[`${column.prefix}ImageHeight`] ? (
                        <button type="button" style={{ ...styles.assetChip, fontSize: 16, padding: "2px 8px" }} onClick={() => update({ [`${column.prefix}ImageHeight`]: undefined })}>Auto</button>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Additional stacked images */}
                  {(() => {
                    const extraKey = `${column.prefix}ExtraImages`;
                    const extras = Array.isArray(props?.[extraKey]) ? props[extraKey] : [];
                    const setExtras = (next) => update({ [extraKey]: next });
                    return (
                      <div style={{ marginTop: 12 }}>
                        <label style={styles.propertyLabel}>Additional Images (stacked below)</label>
                        {extras.map((ei, eiIdx) => (
                          <div key={eiIdx} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, minWidth: 20 }}>#{eiIdx + 2}</span>
                              {ei.src ? (
                                <img src={ei.src} alt="" style={{ width: 40, height: 28, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                              ) : null}
                              <div style={{ flex: 1, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                <label style={{ ...styles.assetUploadCta, margin: 0, fontSize: 12 }}>
                                  Upload
                                  <input type="file" accept="image/*" style={styles.hiddenInput} onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (!file) return;
                                    const asset = await Promise.resolve(onUploadImage?.(index, `${extraKey}_${eiIdx}`, file));
                                    if (asset?.src) {
                                      const next = extras.map((e2, i2) => i2 === eiIdx ? { ...e2, src: asset.src } : e2);
                                      setExtras(next);
                                    }
                                  }} />
                                </label>
                                <button type="button" style={{ ...styles.secondaryBtn, margin: 0, fontSize: 12, padding: "3px 8px" }} onClick={() => openSharedLibraryAssetPicker((asset) => {
                                  const next = extras.map((e2, i2) => i2 === eiIdx ? { ...e2, src: asset.src || "" } : e2);
                                  setExtras(next);
                                })}>Library</button>
                              </div>
                              <button type="button" style={{ padding: "2px 7px", borderRadius: 5, border: "none", background: "#334155", color: "#f87171", cursor: "pointer", flexShrink: 0 }} onClick={() => setExtras(extras.filter((_, i2) => i2 !== eiIdx))}>✕</button>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <label style={{ ...styles.label, fontSize: 12 }}>Height (px)</label>
                              <input type="number" min={40} max={1200} step={10} value={ei.height || ""} placeholder="Auto" onChange={(e) => {
                                const val = e.target.value === "" ? undefined : Number(e.target.value);
                                const next = extras.map((e2, i2) => i2 === eiIdx ? { ...e2, height: val } : e2);
                                setExtras(next);
                              }} style={{ ...styles.input, width: 80 }} />
                              <label style={{ ...styles.label, fontSize: 12, marginLeft: 4 }}>Gap (px)</label>
                              <input type="number" min={0} max={120} step={4} value={ei.gap ?? 8} onChange={(e) => {
                                const next = extras.map((e2, i2) => i2 === eiIdx ? { ...e2, gap: Number(e.target.value) } : e2);
                                setExtras(next);
                              }} style={{ ...styles.input, width: 60 }} />
                            </div>
                          </div>
                        ))}
                        <button type="button" style={{ ...styles.secondaryBtn, width: "100%", marginTop: 4 }} onClick={() => setExtras([...extras, { src: "", height: undefined, gap: 8 }])}>
                          + Add Image
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Per-column style options (shared between both types) */}
              <div style={styles.colorGrid}>
                <NumberField label="Top Margin" value={Number(props?.[`${column.prefix}MarginTop`] ?? 0)} min={0} max={240} onChange={(value) => update({ [`${column.prefix}MarginTop`]: value })} />
                <NumberField label="Padding" value={Number(props?.[`${column.prefix}Padding`] ?? props.columnPadding ?? 18)} min={0} max={96} onChange={(value) => update({ [`${column.prefix}Padding`]: value })} />
                <NumberField label="Radius" value={Number(props?.[`${column.prefix}Radius`] ?? props.columnRadius ?? 18)} min={0} max={80} onChange={(value) => update({ [`${column.prefix}Radius`]: value })} />
                <NumberField label="Min Height" value={Number(props?.[`${column.prefix}MinHeight`] ?? 0)} min={0} max={1200} onChange={(value) => update({ [`${column.prefix}MinHeight`]: value })} />
              </div>
              <div style={styles.inlineChipRow}>
                {[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ].map((option) => (
                  <button key={`${column.id}-${option.value}`} type="button" style={{ ...styles.presetChip, ...(String(props?.[`${column.prefix}ContentAlign`] || props.columnContentAlign || "left") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ [`${column.prefix}ContentAlign`]: option.value })}>
                    {option.label}
                  </button>
                ))}
              </div>
              <div style={styles.colorGrid}>
                <ColorSelector label="Background" value={props?.[`${column.prefix}BackgroundColor`] || props.columnBackgroundColor || props.cardBackgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ [`${column.prefix}BackgroundColor`]: value })} />
                <ColorSelector label="Border" value={props?.[`${column.prefix}BorderColor`] || props.columnBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ [`${column.prefix}BorderColor`]: value })} />
                <ColorSelector label="Title" value={props?.[`${column.prefix}TitleColor`] || props.columnTitleColor || props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ [`${column.prefix}TitleColor`]: value })} />
                <ColorSelector label="Body" value={props?.[`${column.prefix}BodyColor`] || props.columnBodyColor || "#334155"} fallback="#334155" onChange={(value) => update({ [`${column.prefix}BodyColor`]: value })} />
              </div>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Shadow</label>
              <div style={styles.inlineChipRow}>
                {[
                  { value: "none", label: "None" },
                  { value: "soft", label: "Soft" },
                  { value: "medium", label: "Medium" },
                  { value: "strong", label: "Strong" },
                ].map((option) => (
                  <button key={`${column.id}-shadow-${option.value}`} type="button" style={{ ...styles.presetChip, ...(String(props?.[`${column.prefix}Shadow`] || props.columnShadow || "soft") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ [`${column.prefix}Shadow`]: option.value })}>
                    {option.label}
                  </button>
                ))}
              </div>
              <input type="text" value={String(props?.[`${column.prefix}Gradient`] || "")} onChange={(e) => update({ [`${column.prefix}Gradient`]: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="linear-gradient(...)" />
              <div style={{ marginTop: 8 }}>
                <ColorSelector label="Overlay" value={props?.[`${column.prefix}OverlayColor`] || "transparent"} fallback="#000000" allowTransparent onChange={(value) => update({ [`${column.prefix}OverlayColor`]: value })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
