import { ImgField, InlineEditHint, Field, ColIn, SelIn, NumIn, TxtIn, OverlayColorField, SlideIn } from "./inspectorFields.jsx";
import { BACKGROUND_REPEAT_OPTIONS, TEXT_VARIANT_OPTIONS, FONT_FAMILY_OPTIONS, TEXT_SIZE_OPTIONS } from "./editorOptions.js";
import { activeRichTextApi } from "./richTextCanvas.jsx";
import { focusEditableInBlock } from "./richTextCommands.js";
import { deepClone } from "./editorUtils.js";
import { getSocialIconUrl } from "./socialAssets.js";
import { resolveBlockRadius, defaultBlockRadius } from "./blockModel.js";

function HeaderInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Background Image" value={props.bgImageSrc} onUpload={f => upload(f, "bgImageSrc")} onClear={() => patch({ bgImageSrc: "" })} onEdit={props.bgImageSrc ? () => edit("bgImageSrc", null, props.bgImageSrc) : null} onLibrary={() => library("bgImageSrc", null)} onAiImage={() => aiImage("bgImageSrc", null)} />
    <ImgField label="Logo Image" value={props.logoSrc} onUpload={f => upload(f, "logoSrc")} onClear={() => patch({ logoSrc: "" })} onEdit={props.logoSrc ? () => edit("logoSrc", null, props.logoSrc) : null} onLibrary={() => library("logoSrc", null)} onAiImage={() => aiImage("logoSrc", null)} />
    <InlineEditHint>
      Click the header text on the canvas to edit it directly. Use this panel for images and colours.
    </InlineEditHint>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    {!!props.bgImageSrc && <Field label="Background Repeat"><SelIn value={props.bgRepeat || "no-repeat"} onChange={v => patch({ bgRepeat: v })} options={BACKGROUND_REPEAT_OPTIONS} /></Field>}
    <Field label="Title Size"><NumIn value={props.titleSize ?? 28} onChange={v => patch({ titleSize: v })} min={14} max={72} unit="px" /></Field>
    <Field label="Subtitle Size"><NumIn value={props.subtitleSize ?? 16} onChange={v => patch({ subtitleSize: v })} min={10} max={40} unit="px" /></Field>
  </>;
}

function TextInspector({ blockId, props, patch, upload, edit, library, aiImage }) {
  const ensureActiveEditor = () => {
    if (activeRichTextApi?.focus) {
      activeRichTextApi.focus();
      return true;
    }
    return !!focusEditableInBlock(blockId);
  };

  const runWithEditor = (callback) => {
    ensureActiveEditor();
    const run = () => callback?.();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  };

  const runCommand = (command, value = null) => {
    runWithEditor(() => {
      const html = activeRichTextApi?.exec?.(command, value);
      if (typeof html === "string") {
        patch({ html });
      }
    });
  };

  const applyTextSize = (value) => {
    const size = Number(value) || 18;
    runWithEditor(() => {
      const html = activeRichTextApi?.applyStyle?.({ fontSize: `${size}px` });
      patch(typeof html === "string" ? { fontSize: size, html } : { fontSize: size });
    });
  };

  const applyFontFamily = (value) => {
    runWithEditor(() => {
      const html = activeRichTextApi?.applyStyle?.({ fontFamily: value });
      patch(typeof html === "string" ? { fontFamily: value, html } : { fontFamily: value });
    });
  };

  const runListCommand = (ordered = false) => {
    runWithEditor(() => {
      const html = activeRichTextApi?.toggleList?.(ordered);
      if (typeof html === "string") {
        patch({ html });
      }
    });
  };

  const applyLink = () => {
    ensureActiveEditor();
    const url = window.prompt("Enter link URL:", "https://");
    if (!url) return;
    runWithEditor(() => {
      const html = activeRichTextApi?.exec?.("createLink", url);
      if (typeof html === "string") {
        patch({ html });
      }
    });
  };

  const clearLink = () => {
    runWithEditor(() => {
      const html = activeRichTextApi?.exec?.("unlink");
      if (typeof html === "string") {
        patch({ html });
      }
    });
  };

  const actionBtnStyle = {
    minWidth: 40,
    height: 34,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  };
  const press = (action) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    activeRichTextApi?.focus?.();
    action();
  };

  const alignBtn = (label, value) => (
    <button
      type="button"
      onMouseDown={press(() => {
        runCommand(value === "center" ? "justifyCenter" : value === "right" ? "justifyRight" : "justifyLeft");
        patch({ align: value });
      })}
      style={{
        ...actionBtnStyle,
        minWidth: 48,
        background: props.align === value ? "#dbeafe" : "#ffffff",
        borderColor: props.align === value ? "#60a5fa" : "#cbd5e1",
      }}
    >
      {label}
    </button>
  );

  return <>
    {props.rawHtml ? (
      <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>
        This imported HTML layout has limited editing. Use the editable template themes for full colour and image controls.
      </div>
    ) : (
      <ImgField label="Background Image" value={props.bgImageSrc} onUpload={f => upload(f, "bgImageSrc")} onClear={() => patch({ bgImageSrc: "" })} onEdit={props.bgImageSrc ? () => edit("bgImageSrc", null, props.bgImageSrc) : null} onLibrary={() => library("bgImageSrc", null)} onAiImage={() => aiImage("bgImageSrc", null)} />
    )}
    <InlineEditHint>
      Click the text on the canvas to edit the wording directly. Use the controls below for styling.
    </InlineEditHint>
    <Field label="Formatting">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onMouseDown={press(() => runCommand("bold"))} style={actionBtnStyle}>B</button>
        <button type="button" onMouseDown={press(() => runCommand("italic"))} style={actionBtnStyle}>I</button>
        <button type="button" onMouseDown={press(() => runCommand("underline"))} style={actionBtnStyle}>U</button>
        <button type="button" onMouseDown={press(() => runListCommand(false))} style={{ ...actionBtnStyle, minWidth: 70 }}>• List</button>
        <button type="button" onMouseDown={press(() => runListCommand(true))} style={{ ...actionBtnStyle, minWidth: 78 }}>1. List</button>
        <button type="button" onMouseDown={press(() => applyLink())} style={{ ...actionBtnStyle, minWidth: 72 }}>🔗 Link</button>
        <button type="button" onMouseDown={press(() => clearLink())} style={{ ...actionBtnStyle, minWidth: 82 }}>✕ Link</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 84px", gap: 8, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Style</div>
          <SelIn value={props.variant || "body"} onChange={v => patch({ variant: v })} options={TEXT_VARIANT_OPTIONS} />
        </div>

        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Font</div>
          <SelIn value={props.fontFamily || "Arial, Helvetica, sans-serif"} onChange={applyFontFamily} options={FONT_FAMILY_OPTIONS} />
        </div>

        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Size</div>
          <SelIn value={String(props.fontSize || 18)} onChange={applyTextSize} options={TEXT_SIZE_OPTIONS} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Alignment</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {alignBtn("Left", "left")}
          {alignBtn("Center", "center")}
          {alignBtn("Right", "right")}
        </div>
      </div>
    </Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} /></Field>
    {!!props.bgImageSrc && <Field label="Background Repeat"><SelIn value={props.bgRepeat || "no-repeat"} onChange={v => patch({ bgRepeat: v })} options={BACKGROUND_REPEAT_OPTIONS} /></Field>}
  </>;
}

function ImageInspector({ props, patch, upload, edit, library, aiImage }) {
  const enableTextLayer = () => patch({
    overlayEnabled: true,
    overlayTitle: String(props.overlayTitle || "").trim() || "Click to edit headline",
    overlayText: String(props.overlayText || "").trim() || "Click to edit supporting text",
    overlayBgColor: props.overlayBgColor || "rgba(15,23,42,0.38)",
    overlayX: props.overlayX ?? 50,
    overlayY: props.overlayY ?? 50,
  });

  return <>
    <ImgField label="Image" value={props.src} onUpload={f => upload(f, "src")} onClear={() => patch({ src: "" })} onEdit={props.src ? () => edit("src", null, props.src) : null} onLibrary={() => library("src", null)} onAiImage={() => aiImage("src", null)} />
    <InlineEditHint>
      This image block now has layers: background image, text layer, and top logo or image layer.
    </InlineEditHint>
    <Field label="Layer Options">
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={enableTextLayer} style={{ flex: 1, height: 36, border: props.overlayEnabled ? "2px solid #2563eb" : "1px solid #cbd5e1", borderRadius: 8, background: props.overlayEnabled ? "#eff6ff" : "#fff", color: "#0f172a", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Text Layer On</button>
          <button type="button" onClick={() => patch({ overlayEnabled: false })} style={{ flex: 1, height: 36, border: !props.overlayEnabled ? "2px solid #2563eb" : "1px solid #cbd5e1", borderRadius: 8, background: !props.overlayEnabled ? "#eff6ff" : "#fff", color: "#0f172a", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Text Layer Off</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => { if (props.overlayImageSrc) patch({ overlayImageSrc: "" }); else library("overlayImageSrc", null); }} style={{ flex: 1, height: 36, border: props.overlayImageSrc ? "2px solid #7c3aed" : "1px solid #cbd5e1", borderRadius: 8, background: props.overlayImageSrc ? "#f5f3ff" : "#fff", color: "#0f172a", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>{props.overlayImageSrc ? "Remove Top Layer" : "Add Top Layer"}</button>
        </div>
      </div>
    </Field>
    <ImgField label="Top Layer Image / Logo" value={props.overlayImageSrc} onUpload={f => upload(f, "overlayImageSrc")} onClear={() => patch({ overlayImageSrc: "" })} onEdit={props.overlayImageSrc ? () => edit("overlayImageSrc", null, props.overlayImageSrc) : null} onLibrary={() => library("overlayImageSrc", null)} onAiImage={() => aiImage("overlayImageSrc", null)} />
    <Field label="Link URL"><TxtIn value={props.linkHref} onChange={v => patch({ linkHref: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor || "transparent"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Image Fit">
      <SelIn value={props.fitMode || "cover"} onChange={v => patch({ fitMode: v })} options={[{ value: "cover", label: "Full Fill" }, { value: "contain", label: "Contain" }]} />
    </Field>
    <InlineEditHint>
      Use the on-canvas drag handles to resize this image directly.
    </InlineEditHint>
    <Field label="Border Radius"><NumIn value={props.borderRadius || 0} onChange={v => patch({ borderRadius: v })} min={0} max={120} unit="px" /></Field>
    {props.overlayEnabled && (
      <>
        <Field label="Overlay Color"><OverlayColorField value={props.overlayBgColor || "rgba(15,23,42,0.38)"} onChange={v => patch({ overlayBgColor: v })} /></Field>
        <Field label="Title Size"><NumIn value={props.overlayTitleSize ?? 24} onChange={v => patch({ overlayTitleSize: v })} min={12} max={72} unit="px" /></Field>
        <Field label="Subtitle Size"><NumIn value={props.overlayTextSize ?? 14} onChange={v => patch({ overlayTextSize: v })} min={10} max={40} unit="px" /></Field>
      </>
    )}
    {!!props.overlayImageSrc && <Field label="Layer Radius"><NumIn value={props.overlayImageRadius ?? 8} onChange={v => patch({ overlayImageRadius: v })} min={0} max={80} unit="px" /></Field>}
    <Field label="Alignment">
      <SelIn value={props.align} onChange={v => patch({ align: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
    </Field>
  </>;
}

function ButtonInspector({ props, patch }) {
  return <>
    <InlineEditHint>
      Click the button on the canvas to edit its wording directly. Use the color controls below for the button styling.
    </InlineEditHint>
    <Field label="Link URL"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => patch({ bgColor: "transparent" })}
        style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
      >
        Transparent Button
      </button>
      <button
        type="button"
        onClick={() => patch({ blockBgColor: "transparent" })}
        style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
      >
        Transparent Block
      </button>
    </div>
    <Field label="Button Background"><ColIn value={props.bgColor || "#2563eb"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Block Background"><ColIn value={props.blockBgColor || "transparent"} onChange={v => patch({ blockBgColor: v })} allowTransparent /></Field>
    <Field label="Border Radius"><NumIn value={props.borderRadius ?? 8} onChange={v => patch({ borderRadius: v })} min={0} max={50} unit="px" /></Field>
    <Field label="Vertical Padding"><NumIn value={props.paddingY ?? 12} onChange={v => patch({ paddingY: v })} min={4} max={40} unit="px" /></Field>
    <Field label="Width">
      <SelIn value={props.widthMode || "auto"} onChange={v => patch({ widthMode: v })} options={[
        { value: "auto", label: "Auto (shrink to text)" },
        { value: "px", label: "Fixed width (px)" },
        { value: "full", label: "Full width" },
      ]} />
    </Field>
    {(props.widthMode === "px") && (
      <Field label="Button Width"><SlideIn value={props.widthPx ?? 200} onChange={v => patch({ widthPx: v })} min={80} max={580} unit="px" /></Field>
    )}
    <Field label="Alignment">
      <SelIn value={props.align} onChange={v => patch({ align: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
    </Field>
  </>;
}

function DividerInspector({ props, patch }) {
  return <>
    <Field label="Color"><ColIn value={props.color} onChange={v => patch({ color: v })} /></Field>
    <Field label="Line Style">
      <SelIn value={props.style} onChange={v => patch({ style: v })} options={[{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }, { value: "dotted", label: "Dotted" }]} />
    </Field>
    <Field label="Thickness"><SlideIn value={props.thickness} onChange={v => patch({ thickness: v })} min={1} max={12} unit="px" /></Field>
    <Field label="Width"><SlideIn value={props.widthPct} onChange={v => patch({ widthPct: v })} min={10} max={100} unit="%" /></Field>
  </>;
}

function SpacerInspector({ props, patch }) {
  return <>
    <Field label="Spacer Height"><SelIn value={String(props.height || 36)} onChange={v => patch({ height: Number(v) })} options={TEXT_SIZE_OPTIONS} /></Field>
    <Field label="Background"><ColIn value={props.bgColor || "transparent"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

function HeroInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Background Image" value={props.bgImageSrc} onUpload={f => upload(f, "bgImageSrc")} onClear={() => patch({ bgImageSrc: "" })} onEdit={props.bgImageSrc ? () => edit("bgImageSrc", null, props.bgImageSrc) : null} onLibrary={() => library("bgImageSrc", null)} onAiImage={() => aiImage("bgImageSrc", null)} />
    <ImgField label="Hero Image" value={props.imageSrc} onUpload={f => upload(f, "imageSrc")} onClear={() => patch({ imageSrc: "" })} onEdit={props.imageSrc ? () => edit("imageSrc", null, props.imageSrc) : null} onLibrary={() => library("imageSrc", null)} onAiImage={() => aiImage("imageSrc", null)} />
    <InlineEditHint>
      Edit the headline, supporting copy, and button label directly on the canvas. Keep this panel for images, links, spacing, and colours.
    </InlineEditHint>
    <Field label="Button Link"><TxtIn value={props.ctaHref} onChange={v => patch({ ctaHref: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    {!!props.bgImageSrc && <Field label="Background Repeat"><SelIn value={props.bgRepeat || "no-repeat"} onChange={v => patch({ bgRepeat: v })} options={BACKGROUND_REPEAT_OPTIONS} /></Field>}
    <Field label="Headline Size"><NumIn value={props.headlineSize ?? 30} onChange={v => patch({ headlineSize: v })} min={14} max={72} unit="px" /></Field>
    <Field label="Sub-text Size"><NumIn value={props.subtextSize ?? 15} onChange={v => patch({ subtextSize: v })} min={10} max={40} unit="px" /></Field>
    <Field label="Button Color"><ColIn value={props.ctaBgColor} onChange={v => patch({ ctaBgColor: v })} allowTransparent /></Field>
    <Field label="Vertical Padding"><NumIn value={props.paddingY ?? 36} onChange={v => patch({ paddingY: v })} min={8} max={100} unit="px" /></Field>
  </>;
}

function ImageTextInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Background Image" value={props.imageSrc} onUpload={f => upload(f, "imageSrc")} onClear={() => patch({ imageSrc: "" })} onEdit={props.imageSrc ? () => edit("imageSrc", null, props.imageSrc) : null} onLibrary={() => library("imageSrc", null)} onAiImage={() => aiImage("imageSrc", null)} />
    <InlineEditHint>
      This section uses layers so you can stack text and a logo or image on top of the background.
    </InlineEditHint>
    <Field label="Layer Options">
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => library("overlayImageSrc", null)} style={{ flex: 1, height: 36, border: props.overlayImageSrc ? "2px solid #7c3aed" : "1px solid #cbd5e1", borderRadius: 8, background: props.overlayImageSrc ? "#f5f3ff" : "#fff", color: "#0f172a", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>{props.overlayImageSrc ? "Change Top Layer" : "Add Top Layer"}</button>
          {props.overlayImageSrc && <button type="button" onClick={() => patch({ overlayImageSrc: "" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#0f172a", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Remove Top Layer</button>}
        </div>
      </div>
    </Field>
    <ImgField label="Top Layer Image / Logo" value={props.overlayImageSrc} onUpload={f => upload(f, "overlayImageSrc")} onClear={() => patch({ overlayImageSrc: "" })} onEdit={props.overlayImageSrc ? () => edit("overlayImageSrc", null, props.overlayImageSrc) : null} onLibrary={() => library("overlayImageSrc", null)} onAiImage={() => aiImage("overlayImageSrc", null)} />
    <Field label="Link"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <Field label="Headline Size"><NumIn value={props.headlineSize ?? 30} onChange={v => patch({ headlineSize: v })} min={14} max={72} unit="px" /></Field>
    <Field label="Subtitle Size"><NumIn value={props.subtextSize ?? 15} onChange={v => patch({ subtextSize: v })} min={10} max={40} unit="px" /></Field>
    <Field label="Button Color"><ColIn value={props.buttonBgColor || "#2563eb"} onChange={v => patch({ buttonBgColor: v })} allowTransparent /></Field>
    <Field label="Overlay Shade"><TxtIn value={props.overlayShade || "rgba(15,23,42,0.45)"} onChange={v => patch({ overlayShade: v })} /></Field>
    {!!props.overlayImageSrc && <Field label="Layer Radius"><NumIn value={props.overlayImageRadius ?? 8} onChange={v => patch({ overlayImageRadius: v })} min={0} max={80} unit="px" /></Field>}
    <Field label="Height"><NumIn value={props.height || 320} onChange={v => patch({ height: v })} min={180} max={600} unit="px" /></Field>
    <Field label="Alignment">
      <SelIn value={props.align || "center"} onChange={v => patch({ align: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
    </Field>
  </>;
}

function QuoteInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Avatar" value={props.avatarSrc} onUpload={f => upload(f, "avatarSrc")} onClear={() => patch({ avatarSrc: "" })} onEdit={props.avatarSrc ? () => edit("avatarSrc", null, props.avatarSrc) : null} onLibrary={() => library("avatarSrc", null)} onAiImage={() => aiImage("avatarSrc", null)} />
    <InlineEditHint>
      Edit the quote, author, and role directly on the canvas. Use this panel for the avatar and visual styling.
    </InlineEditHint>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

function PromoInspector({ props, patch }) {
  return <>
    <InlineEditHint>
      Edit the badge, headline, details, offer code, and button label directly on the canvas. Use this panel for colours and the link.
    </InlineEditHint>
    <Field label="Link"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Accent"><ColIn value={props.accentColor} onChange={v => patch({ accentColor: v })} /></Field>
  </>;
}

function VideoInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Thumbnail" value={props.thumbnailSrc} onUpload={f => upload(f, "thumbnailSrc")} onClear={() => patch({ thumbnailSrc: "" })} onEdit={props.thumbnailSrc ? () => edit("thumbnailSrc", null, props.thumbnailSrc) : null} onLibrary={() => library("thumbnailSrc", null)} onAiImage={() => aiImage("thumbnailSrc", null)} />
    <InlineEditHint>
      Edit the title, caption, and button label directly on the canvas. Use this panel for the thumbnail, link, and colours.
    </InlineEditHint>
    <Field label="Video Link"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

function ContactInspector({ props, patch }) {
  return <>
    <InlineEditHint>
      Edit the contact text and button label directly on the canvas. Use this panel for the button link and visual styling.
    </InlineEditHint>
    <Field label="Button Link"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

function GridInspector({ props, patch, upload, edit, library, aiImage }) {
  const cols = props.columns || [];
  const setCol = (i, field, value) => {
    const next = cols.map((c, j) => j === i ? { ...c, [field]: value } : c);
    patch({ columns: next });
  };
  const addCol = () => patch({ columns: [...cols, { imageSrc: "", title: "New Card", text: "Description text goes here.", linkHref: "", bgColor: "transparent" }] });
  const duplicateCol = (i) => patch({ columns: [...cols.slice(0, i + 1), deepClone(cols[i]), ...cols.slice(i + 1)] });
  const removeCol = (i) => patch({ columns: cols.filter((_, j) => j !== i) });
  const makeAllCardsTransparent = () => patch({ columns: cols.map((col) => ({ ...col, bgColor: "transparent" })) });
  return <>
    <InlineEditHint>
      Edit each card title and description directly on the canvas. Use this panel for images, links, layout, and backgrounds.
    </InlineEditHint>
    <Field label="Section Background"><ColIn value={props.bgColor || "#ffffff"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => patch({ bgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Transparent Section</button>
          <button onClick={makeAllCardsTransparent} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>All Cards Transparent</button>
        </div>
    <Field label="Cards Per Row">
      <SelIn value={String(props.columnsPerRow || 2)} onChange={v => patch({ columnsPerRow: Number(v) })} options={[{ value: "1", label: "1 wide" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} />
    </Field>
    {cols.map((col, i) => (
      <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#334155" }}>CARD {i + 1}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => duplicateCol(i)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 16, fontWeight: 600 }}>Copy</button>
            {cols.length > 1 && <button onClick={() => removeCol(i)} style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 16, fontWeight: 600 }}>Remove</button>}
          </div>
        </div>
        <ImgField label="Image" value={col.imageSrc} onUpload={f => upload(f, "imageSrc_col", i)} onClear={() => setCol(i, "imageSrc", "")} onEdit={col.imageSrc ? () => edit("imageSrc_col", i, col.imageSrc) : null} onLibrary={() => library("imageSrc_col", i)} onAiImage={() => aiImage("imageSrc_col", i)} />
        <Field label="Card Background"><ColIn value={col.bgColor || "#ffffff"} onChange={v => setCol(i, "bgColor", v)} allowTransparent /></Field>
        <Field label="Link"><TxtIn value={col.linkHref} onChange={v => setCol(i, "linkHref", v)} placeholder="https://…" /></Field>
      </div>
    ))}
    <button onClick={addCol} style={{ width: "100%", height: 40, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>+ Add Card</button>
  </>;
}

function ListInspector({ props, patch, upload, edit, library, aiImage }) {
  const items = props.items || [];
  const setItem = (i, field, value) => {
    const next = items.map((it, j) => j === i ? { ...it, [field]: value } : it);
    patch({ items: next });
  };
  const addItem = () => patch({ items: [...items, { imageSrc: "", title: "New Item", text: "Description.", linkHref: "", bgColor: "transparent" }] });
  const duplicateItem = (i) => patch({ items: [...items.slice(0, i + 1), deepClone(items[i]), ...items.slice(i + 1)] });
  const removeItem = i => patch({ items: items.filter((_, j) => j !== i) });
  const makeAllCardsTransparent = () => patch({ items: items.map((item) => ({ ...item, bgColor: "transparent" })) });
  return <>
    <InlineEditHint>
      Edit each item title and description directly on the canvas. Use this panel for images, links, layout, and backgrounds.
    </InlineEditHint>
    <Field label="Section Background"><ColIn value={props.bgColor || "#ffffff"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={() => patch({ bgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Transparent Section</button>
      <button onClick={makeAllCardsTransparent} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>All Cards Transparent</button>
    </div>
    <Field label="Items Per Row">
      <SelIn value={String(props.itemsPerRow || 1)} onChange={v => patch({ itemsPerRow: Number(v) })} options={[{ value: "1", label: "1 deep" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} />
    </Field>
    {items.map((item, i) => (
      <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#334155" }}>ITEM {i + 1}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => duplicateItem(i)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 16, fontWeight: 600 }}>Copy</button>
            {items.length > 1 && <button onClick={() => removeItem(i)} style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 16, fontWeight: 600 }}>Remove</button>}
          </div>
        </div>
        <ImgField label="Image" value={item.imageSrc} onUpload={f => upload(f, "imageSrc_item", i)} onClear={() => setItem(i, "imageSrc", "")} onEdit={item.imageSrc ? () => edit("imageSrc_item", i, item.imageSrc) : null} onLibrary={() => library("imageSrc_item", i)} onAiImage={() => aiImage("imageSrc_item", i)} />
        <Field label="Card Background"><ColIn value={item.bgColor || "#ffffff"} onChange={v => setItem(i, "bgColor", v)} allowTransparent /></Field>
        <Field label="Link"><TxtIn value={item.linkHref} onChange={v => setItem(i, "linkHref", v)} placeholder="https://…" /></Field>
      </div>
    ))}
    <button onClick={addItem} style={{ width: "100%", height: 40, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>+ Add Item</button>
  </>;
}

function GridCardInspector({ props, patch, upload, edit, library, aiImage, patchCommon, addSibling, duplicateCurrent, removeCurrent }) {
  return <>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={addSibling} style={{ flex: 1, height: 36, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>+ Add Card</button>
      <button onClick={duplicateCurrent} style={{ height: 36, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer", padding: "0 10px" }}>Copy</button>
      <button onClick={removeCurrent} style={{ height: 36, border: "1px solid #fecaca", borderRadius: 6, background: "#fff1f2", color: "#b91c1c", fontSize: 16, fontWeight: 600, cursor: "pointer", padding: "0 10px" }}>Delete</button>
    </div>
    <InlineEditHint>
      Edit the card title and description directly on the canvas. Use this panel for image, link, layout, and background controls.
    </InlineEditHint>
    <Field label="Section Background"><ColIn value={props.sectionBgColor || "#ffffff"} onChange={v => patchCommon?.({ sectionBgColor: v })} allowTransparent /></Field>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={() => patchCommon?.({ sectionBgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Transparent Section</button>
      <button onClick={() => patch({ bgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Transparent Card</button>
    </div>
    <Field label="Cards Per Row"><SelIn value={String(props.perRow || 2)} onChange={v => patchCommon?.({ perRow: Number(v) })} options={[{ value: "1", label: "1 wide" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} /></Field>
    <ImgField label="Image" value={props.imageSrc} onUpload={f => upload(f, "imageSrc")} onClear={() => patch({ imageSrc: "" })} onEdit={props.imageSrc ? () => edit("imageSrc", null, props.imageSrc) : null} onLibrary={() => library("imageSrc", null)} onAiImage={() => aiImage("imageSrc", null)} />
    <InlineEditHint>Use the drag handles on the selected image to resize it.</InlineEditHint>
    <Field label="Card Background"><ColIn value={props.bgColor || "#ffffff"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Link"><TxtIn value={props.linkHref} onChange={v => patch({ linkHref: v })} placeholder="https://…" /></Field>
  </>;
}

function ListCardInspector({ props, patch, upload, edit, library, aiImage, patchCommon, addSibling, duplicateCurrent, removeCurrent }) {
  return <>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={addSibling} style={{ flex: 1, height: 36, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>+ Add Item</button>
      <button onClick={duplicateCurrent} style={{ height: 36, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer", padding: "0 10px" }}>Copy</button>
      <button onClick={removeCurrent} style={{ height: 36, border: "1px solid #fecaca", borderRadius: 6, background: "#fff1f2", color: "#b91c1c", fontSize: 16, fontWeight: 600, cursor: "pointer", padding: "0 10px" }}>Delete</button>
    </div>
    <InlineEditHint>
      Edit the item title and description directly on the canvas. Use this panel for image, link, layout, and background controls.
    </InlineEditHint>
    <Field label="Section Background"><ColIn value={props.sectionBgColor || "#ffffff"} onChange={v => patchCommon?.({ sectionBgColor: v })} allowTransparent /></Field>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={() => patchCommon?.({ sectionBgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Transparent Section</button>
      <button onClick={() => patch({ bgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Transparent Card</button>
    </div>
    <Field label="Items Per Row"><SelIn value={String(props.perRow || 1)} onChange={v => patchCommon?.({ perRow: Number(v) })} options={[{ value: "1", label: "1 deep" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} /></Field>
    <ImgField label="Image" value={props.imageSrc} onUpload={f => upload(f, "imageSrc")} onClear={() => patch({ imageSrc: "" })} onEdit={props.imageSrc ? () => edit("imageSrc", null, props.imageSrc) : null} onLibrary={() => library("imageSrc", null)} onAiImage={() => aiImage("imageSrc", null)} />
    <InlineEditHint>Use the drag handles on the selected image to resize it.</InlineEditHint>
    <Field label="Card Background"><ColIn value={props.bgColor || "#ffffff"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Link"><TxtIn value={props.linkHref} onChange={v => patch({ linkHref: v })} placeholder="https://…" /></Field>
  </>;
}

export function GroupedSectionInspector({ type, props, patchCommon, addSibling }) {
  const isGrid = type === "gridCard";
  return <>
    <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 600, color: "#64748b", lineHeight: 1.5 }}>
      You are editing the whole {isGrid ? "grid" : "list"} section. Click the headline on the canvas to edit its wording directly.
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={addSibling} style={{ flex: 1, height: 36, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>{isGrid ? "+ Add Card" : "+ Add Item"}</button>
    </div>
    <Field label="Section Background"><ColIn value={props.sectionBgColor || "#ffffff"} onChange={v => patchCommon?.({ sectionBgColor: v })} allowTransparent /></Field>
    <div style={{ marginBottom: 14 }}>
      <button onClick={() => patchCommon?.({ sectionBgColor: "transparent" })} style={{ width: "100%", height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Transparent Section</button>
    </div>
    <Field label={isGrid ? "Cards Per Row" : "Items Per Row"}>
      <SelIn value={String(props.perRow || (isGrid ? 2 : 1))} onChange={v => patchCommon?.({ perRow: Number(v) })} options={[{ value: "1", label: isGrid ? "1 wide" : "1 deep" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} />
    </Field>
  </>;
}

function SocialInspector({ props, patch }) {
  const plats = props.platforms || [];
  return <>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Platform Links</div>
      {plats.map((pl, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <img src={getSocialIconUrl(pl.name)} alt={pl.name} style={{ width: 22, height: 22, flexShrink: 0 }} />
          <span style={{ width: 80, fontSize: 16, color: "#334155", fontWeight: 600, textTransform: "capitalize" }}>{pl.name}</span>
          <input
            type="text" value={pl.href}
            onChange={e => {
              const next = plats.map((p, j) => j === i ? { ...p, href: e.target.value } : p);
              patch({ platforms: next });
            }}
            placeholder="https://…"
            style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 10px", fontSize: 16, fontWeight: 600, background: "#ffffff", color: "#0f172a" }}
          />
        </div>
      ))}
    </div>
  </>;
}

function FooterInspector({ props, patch }) {
  return <>
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>
      Edit the company name, address, and footer legal line directly on the canvas, then use the text toolbar to add separate links for items like Privacy Policy and Terms of Use.
    </div>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

export function CommonBlockInspector({ block, patch }) {
  if (!block) return null;

  return (
    <Field label="Block Corner Radius">
      <NumIn
        value={resolveBlockRadius(block.props || {}, defaultBlockRadius(block.type))}
        onChange={v => patch({ blockRadius: v })}
        min={0}
        max={120}
        unit="px"
      />
    </Field>
  );
}

export function TextOnlyInspector({ block, patch }) {
  const props = block?.props || {};
  const linkField = block?.type === "footer"
    ? null
    : props.linkHref !== undefined
    ? "linkHref"
    : props.href !== undefined
      ? "href"
      : props.ctaHref !== undefined
        ? "ctaHref"
        : props.unsubscribeHref !== undefined
          ? "unsubscribeHref"
          : null;

  return <>
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>
      Use the horizontal toolbar above the canvas for full Word-style text editing.
    </div>
    {linkField && (
      <Field label="Link URL">
        <TxtIn value={props[linkField] || ""} onChange={v => patch({ [linkField]: v })} placeholder="https://…" />
      </Field>
    )}
  </>;
}

export function EmailCanvasInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>
      These tools style the whole email canvas and outer page background.
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => patch({ outerBgColor: "transparent" })}
        style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
      >
        Transparent Page
      </button>
      <button
        type="button"
        onClick={() => patch({ canvasBgColor: "transparent" })}
        style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
      >
        Transparent Canvas
      </button>
    </div>
    <Field label="Inbox Preview Text"><TxtIn value={props.preheaderText} onChange={v => patch({ preheaderText: v })} placeholder="Short preview text shown beside the subject line" /></Field>
    <ImgField label="Page Background Image" value={props.outerBgImageSrc} onUpload={f => upload(f, "outerBgImageSrc")} onClear={() => patch({ outerBgImageSrc: "" })} onEdit={props.outerBgImageSrc ? () => edit("outerBgImageSrc", null, props.outerBgImageSrc) : null} onLibrary={() => library("outerBgImageSrc", null)} onAiImage={() => aiImage("outerBgImageSrc", null)} />
    <Field label="Page Background"><ColIn value={props.outerBgColor} onChange={v => patch({ outerBgColor: v })} allowTransparent /></Field>
    {!!props.outerBgImageSrc && <Field label="Page Background Repeat"><SelIn value={props.outerBgRepeat || "no-repeat"} onChange={v => patch({ outerBgRepeat: v })} options={BACKGROUND_REPEAT_OPTIONS} /></Field>}
    <Field label="Canvas Background"><ColIn value={props.canvasBgColor} onChange={v => patch({ canvasBgColor: v })} allowTransparent /></Field>
    <Field label="Canvas Width"><NumIn value={props.canvasWidth} onChange={v => patch({ canvasWidth: v })} min={420} max={900} unit="px" /></Field>
    <Field label="Corner Radius"><NumIn value={props.canvasRadius} onChange={v => patch({ canvasRadius: v })} min={0} max={32} unit="px" /></Field>
  </>;
}

export const INSPECTORS = {
  imageText: ImageTextInspector,
  quote: QuoteInspector,
  promo: PromoInspector,
  video: VideoInspector,
  contact: ContactInspector,
  header: HeaderInspector,
  text: TextInspector,
  image: ImageInspector,
  button: ButtonInspector,
  divider: DividerInspector,
  spacer: SpacerInspector,
  hero: HeroInspector,
  grid: GridInspector,
  list: ListInspector,
  gridCard: GridCardInspector,
  listCard: ListCardInspector,
  social: SocialInspector,
  footer: FooterInspector,
};
