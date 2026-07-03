import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Extension } from "@tiptap/core";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";

const ALIGNMENTS = ["left", "center", "right", "justify"];
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72];
const LINE_HEIGHTS = ["1", "1.15", "1.25", "1.35", "1.5", "1.7", "2"];
const LETTER_SPACINGS = ["0px", "0.02em", "0.04em", "0.08em", "0.12em"];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasHtml(value) {
  return /<[a-z][\s\S]*>/i.test(String(value || ""));
}

function normalizeCssUnit(value, fallbackUnit = "px") {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return `${raw}${fallbackUnit}`;
  return raw;
}

function normalizeEditorHtml(value, legacyTextAlign) {
  const raw = String(value || "").trim();
  const html = hasHtml(raw)
    ? raw
    : `<p>${escapeHtml(raw).replace(/\n/g, "<br>")}</p>`;

  const align = ALIGNMENTS.includes(String(legacyTextAlign || "")) ? String(legacyTextAlign) : "";
  if (!align || /text-align\s*:/i.test(html)) return html;
  return html.replace(/<(p|h[1-6])(\s[^>]*)?>/gi, (match, tag, attrs = "") => {
    if (/style\s*=/i.test(attrs)) {
      return match.replace(/style=(["'])(.*?)\1/i, (_style, quote, styleValue) => (
        `style=${quote}${styleValue}; text-align: ${align}${quote}`
      ));
    }
    return `<${tag}${attrs} style="text-align: ${align}">`;
  });
}

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize) => ({ chain }) => chain().setMark("textStyle", { fontSize: normalizeCssUnit(fontSize) }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark("textStyle", { fontSize: null }).run(),
    };
  },
});

const LetterSpacing = Extension.create({
  name: "letterSpacing",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        letterSpacing: {
          default: null,
          parseHTML: (element) => element.style.letterSpacing || null,
          renderHTML: (attributes) => attributes.letterSpacing ? { style: `letter-spacing: ${attributes.letterSpacing}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setLetterSpacing: (letterSpacing) => ({ chain }) => (
        chain().setMark("textStyle", { letterSpacing: normalizeCssUnit(letterSpacing, "em") }).run()
      ),
      unsetLetterSpacing: () => ({ chain }) => chain().setMark("textStyle", { letterSpacing: null }).run(),
    };
  },
});

const LineHeight = Extension.create({
  name: "lineHeight",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (element) => element.style.lineHeight || null,
          renderHTML: (attributes) => attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (lineHeight) => ({ chain }) => (
        chain()
          .updateAttributes("paragraph", { lineHeight: String(lineHeight || "").trim() || null })
          .updateAttributes("heading", { lineHeight: String(lineHeight || "").trim() || null })
          .run()
      ),
      unsetLineHeight: () => ({ chain }) => (
        chain().updateAttributes("paragraph", { lineHeight: null }).updateAttributes("heading", { lineHeight: null }).run()
      ),
    };
  },
});

const TextAlign = Extension.create({
  name: "textAlign",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: (element) => element.style.textAlign || null,
          renderHTML: (attributes) => attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setTextAlign: (textAlign) => ({ chain }) => {
        const value = ALIGNMENTS.includes(String(textAlign || "")) ? String(textAlign) : null;
        return chain()
          .updateAttributes("paragraph", { textAlign: value })
          .updateAttributes("heading", { textAlign: value })
          .run();
      },
      unsetTextAlign: () => ({ chain }) => (
        chain().updateAttributes("paragraph", { textAlign: null }).updateAttributes("heading", { textAlign: null }).run()
      ),
    };
  },
});

function ToolbarButton({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      style={{
        minWidth: 30,
        height: 30,
        border: `1px solid ${active ? "rgba(14,165,233,0.65)" : "rgba(148,163,184,0.22)"}`,
        borderRadius: 6,
        background: active ? "rgba(14,165,233,0.18)" : "rgba(15,23,42,0.94)",
        color: active ? "#38bdf8" : "#e2e8f0",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

function ToolbarSelect({ title, value, onChange, children, width = 112 }) {
  return (
    <select
      title={title}
      value={value}
      onMouseDown={(event) => event.preventDefault()}
      onChange={(event) => onChange(event.target.value)}
      style={{
        width,
        height: 30,
        border: "1px solid rgba(148,163,184,0.22)",
        borderRadius: 6,
        background: "rgba(15,23,42,0.94)",
        color: "#e2e8f0",
        fontSize: 12,
        outline: "none",
      }}
    >
      {children}
    </select>
  );
}

function WbTiptapToolbar({ editor }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!editor) return undefined;
    const refresh = () => forceUpdate((value) => value + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter link URL", previousUrl);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const activeHeading = [1, 2, 3, 4, 5, 6].find((level) => editor.isActive("heading", { level }));
  const activeAlign = ALIGNMENTS.find((alignment) => editor.isActive({ textAlign: alignment })) || "left";

  return (
    <div className="wb-tiptap-toolbar" data-wb-tiptap-toolbar="true" contentEditable={false}>
      <ToolbarSelect
        title="Text format"
        value={activeHeading ? `h${activeHeading}` : "paragraph"}
        onChange={(value) => {
          if (value === "paragraph") editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(value.replace("h", "")) }).run();
        }}
        width={118}
      >
        <option value="paragraph">Paragraph</option>
        {[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={`h${level}`}>Heading {level}</option>)}
      </ToolbarSelect>

      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolbarButton>
      <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolbarButton>

      <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarButton>
      <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton>
      <ToolbarButton title="Link" active={editor.isActive("link")} onClick={setLink}>Link</ToolbarButton>

      <ToolbarSelect title="Alignment" value={activeAlign} onChange={(value) => editor.chain().focus().setTextAlign(value).run()} width={96}>
        <option value="left">Left</option>
        <option value="center">Centre</option>
        <option value="right">Right</option>
        <option value="justify">Justify</option>
      </ToolbarSelect>

      <ToolbarSelect title="Font size" value={editor.getAttributes("textStyle").fontSize || ""} onChange={(value) => value ? editor.chain().focus().setFontSize(value).run() : editor.chain().focus().unsetFontSize().run()} width={82}>
        <option value="">Size</option>
        {FONT_SIZES.map((size) => <option key={size} value={`${size}px`}>{size}px</option>)}
      </ToolbarSelect>

      <ToolbarSelect title="Line height" value={editor.getAttributes("paragraph").lineHeight || editor.getAttributes("heading").lineHeight || ""} onChange={(value) => value ? editor.chain().focus().setLineHeight(value).run() : editor.chain().focus().unsetLineHeight().run()} width={92}>
        <option value="">Line</option>
        {LINE_HEIGHTS.map((value) => <option key={value} value={value}>{value}</option>)}
      </ToolbarSelect>

      <ToolbarSelect title="Letter spacing" value={editor.getAttributes("textStyle").letterSpacing || ""} onChange={(value) => value ? editor.chain().focus().setLetterSpacing(value).run() : editor.chain().focus().unsetLetterSpacing().run()} width={104}>
        <option value="">Spacing</option>
        {LETTER_SPACINGS.map((value) => <option key={value} value={value}>{value}</option>)}
      </ToolbarSelect>

      <label className="wb-tiptap-color" title="Text colour" onMouseDown={(event) => event.preventDefault()}>
        <span>A</span>
        <input type="color" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
      </label>
      <label className="wb-tiptap-color" title="Background highlight" onMouseDown={(event) => event.preventDefault()}>
        <span>HL</span>
        <input type="color" onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()} />
      </label>

      <ToolbarButton title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Clear</ToolbarButton>
    </div>
  );
}

export default function WbRichTextEditor({
  html,
  onChange,
  blockStyle = {},
  placeholder = "Click to edit text...",
  editable = true,
  legacyTextAlign = "",
}) {
  const lastHtmlRef = useRef("");
  const initialHtml = useMemo(() => normalizeEditorHtml(html, legacyTextAlign), [html, legacyTextAlign]);

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    TextStyle,
    FontSize,
    LetterSpacing,
    LineHeight,
    Color,
    Highlight.configure({ multicolor: true }),
    Underline,
    Link.configure({
      autolink: true,
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
  ], []);

  const editor = useEditor({
    extensions,
    content: initialHtml,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "wb-tiptap-prosemirror",
        "data-placeholder": placeholder,
        spellcheck: "true",
      },
    },
    onCreate: ({ editor: createdEditor }) => {
      lastHtmlRef.current = createdEditor.getHTML();
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const nextHtml = updatedEditor.getHTML();
      lastHtmlRef.current = nextHtml;
      if (typeof onChange === "function") onChange(nextHtml);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!!editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const nextHtml = normalizeEditorHtml(html, legacyTextAlign);
    if (nextHtml !== lastHtmlRef.current && nextHtml !== editor.getHTML()) {
      editor.commands.setContent(nextHtml, false);
      lastHtmlRef.current = editor.getHTML();
    }
  }, [editor, html, legacyTextAlign]);

  if (!editable) {
    return (
      <div className="wb-rich-text-rendered" style={blockStyle} dangerouslySetInnerHTML={{ __html: initialHtml }} />
    );
  }

  return (
    <div className="wb-tiptap-shell" style={{ position: "relative", width: "100%" }}>
      <WbTiptapToolbar editor={editor} />
      <EditorContent editor={editor} style={blockStyle} data-placeholder={placeholder} />
      <style jsx global>{`
        .wb-tiptap-shell {
          --wb-editor-border: rgba(14, 165, 233, 0.38);
        }
        .wb-tiptap-toolbar {
          position: sticky;
          top: 8px;
          z-index: 20;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
          width: min(100%, 980px);
          margin: 0 0 8px;
          padding: 6px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.96);
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.22);
        }
        .wb-tiptap-color {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          min-width: 34px;
          padding: 0 7px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.94);
          color: #e2e8f0;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .wb-tiptap-color input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }
        .wb-tiptap-prosemirror {
          min-height: 42px;
          width: 100%;
          padding: 8px 10px;
          border: 1px solid var(--wb-editor-border);
          border-radius: 8px;
          outline: none;
          cursor: text;
          box-sizing: border-box;
        }
        .wb-tiptap-prosemirror:focus {
          border-color: rgba(14, 165, 233, 0.85);
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
        }
        .wb-tiptap-prosemirror p,
        .wb-rich-text-rendered p {
          margin: 0 0 0.75em;
        }
        .wb-tiptap-prosemirror p:last-child,
        .wb-rich-text-rendered p:last-child,
        .wb-tiptap-prosemirror h1:last-child,
        .wb-tiptap-prosemirror h2:last-child,
        .wb-tiptap-prosemirror h3:last-child,
        .wb-tiptap-prosemirror h4:last-child,
        .wb-tiptap-prosemirror h5:last-child,
        .wb-tiptap-prosemirror h6:last-child,
        .wb-rich-text-rendered h1:last-child,
        .wb-rich-text-rendered h2:last-child,
        .wb-rich-text-rendered h3:last-child,
        .wb-rich-text-rendered h4:last-child,
        .wb-rich-text-rendered h5:last-child,
        .wb-rich-text-rendered h6:last-child {
          margin-bottom: 0;
        }
        .wb-tiptap-prosemirror h1,
        .wb-rich-text-rendered h1 {
          font-size: 2.4em;
          line-height: 1.08;
          margin: 0 0 0.45em;
        }
        .wb-tiptap-prosemirror h2,
        .wb-rich-text-rendered h2 {
          font-size: 2em;
          line-height: 1.12;
          margin: 0 0 0.5em;
        }
        .wb-tiptap-prosemirror h3,
        .wb-rich-text-rendered h3 {
          font-size: 1.65em;
          line-height: 1.18;
          margin: 0 0 0.55em;
        }
        .wb-tiptap-prosemirror h4,
        .wb-rich-text-rendered h4 {
          font-size: 1.35em;
          line-height: 1.22;
          margin: 0 0 0.6em;
        }
        .wb-tiptap-prosemirror h5,
        .wb-rich-text-rendered h5,
        .wb-tiptap-prosemirror h6,
        .wb-rich-text-rendered h6 {
          font-size: 1.1em;
          line-height: 1.3;
          margin: 0 0 0.65em;
        }
        .wb-tiptap-prosemirror ul,
        .wb-tiptap-prosemirror ol,
        .wb-rich-text-rendered ul,
        .wb-rich-text-rendered ol {
          margin: 0.6em 0 0.8em;
          padding-left: 1.45em;
        }
        .wb-tiptap-prosemirror li,
        .wb-rich-text-rendered li {
          margin: 0.2em 0;
        }
        .wb-tiptap-prosemirror a,
        .wb-rich-text-rendered a {
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 0.18em;
        }
        .wb-tiptap-prosemirror:empty::before {
          content: attr(data-placeholder);
          color: rgba(148, 163, 184, 0.62);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
