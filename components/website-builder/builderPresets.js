import { nanoid } from "nanoid";

export const DEFAULT_THEME = {
  background: "#0b1220",
  surface: "rgba(255,255,255,0.03)",
  text: "#eaf2ff",
  mutedText: "rgba(234,242,255,0.75)",
  accent: "#2297c5",
  maxWidth: 980,
};

export const PRESETS = [
  { key: "hero", label: "Hero" },
  { key: "text", label: "Text" },
  { key: "features", label: "Features" },
  { key: "image", label: "Image" },
  { key: "cta", label: "CTA" },
  { key: "footer", label: "Footer" },
];

export function createBlockFromPreset(presetKey) {
  const id = `blk_${nanoid(10)}`;

  const base = {
    id,
    preset: presetKey,
    props: {
      paddingY: 48,
      paddingX: 20,
      background: "transparent",
      radius: 14,
      align: "left",
    },
  };

  if (presetKey === "hero") {
    return {
      ...base,
      props: {
        ...base.props,
        paddingY: 64,
        eyebrow: "GR8 RESULT",
        heading: "Build a beautiful website fast",
        subheading:
          "Drag, drop, edit. Simple enough for anyone. Powerful enough to grow.",
        primaryText: "Get Started",
        primaryHref: "#",
      },
    };
  }

  if (presetKey === "text") {
    return {
      ...base,
      props: {
        ...base.props,
        heading: "Section heading",
        body:
          "This is a text section. Click into text and edit it directly, or use the inspector.",
      },
    };
  }

  if (presetKey === "features") {
    return {
      ...base,
      props: {
        ...base.props,
        heading: "Features that matter",
        items: [
          { title: "Drag & Drop", body: "Reorder sections instantly." },
          { title: "Inline Editing", body: "Click text, type, done." },
          { title: "Clean UI", body: "No clutter, no confusion." },
        ],
      },
    };
  }

  if (presetKey === "image") {
    return {
      ...base,
      props: {
        ...base.props,
        heading: "Image block",
        imageUrl: "",
        imageAlt: "Image",
        imageWidth: "100%",
      },
    };
  }

  if (presetKey === "cta") {
    return {
      ...base,
      props: {
        ...base.props,
        heading: "Ready to launch?",
        body: "Add sections, write copy, publish. Keep it simple.",
        primaryText: "Create my site",
        primaryHref: "#",
      },
    };
  }

  if (presetKey === "footer") {
    return {
      ...base,
      props: {
        ...base.props,
        paddingY: 28,
        smallText: "© " + new Date().getFullYear() + " GR8 RESULT",
      },
    };
  }

  return base;
}
