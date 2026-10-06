export const COLOR_PRESETS = [
  "#ffffff",
  "#000000",
  "#1e293b",
  "#64748b",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#2563eb",
  "#7c3aed",
  "#ec4899",
];

export const TEXT_COLOR_OPTIONS = [
  "#111827",
  "#475569",
  "#2563eb",
  "#7c3aed",
  "#16a34a",
  "#ea580c",
  "#dc2626",
  "#ec4899",
];

export const HIGHLIGHT_COLOR_OPTIONS = [
  "transparent",
  "#fff59d",
  "#fed7aa",
  "#bfdbfe",
  "#bbf7d0",
  "#fbcfe8",
  "#ddd6fe",
];

export const TEXT_VARIANT_OPTIONS = [
  { value: "body", label: "Body Text" },
  { value: "headline", label: "Headline" },
  { value: "h1", label: "H1" },
  { value: "h2", label: "H2" },
  { value: "h3", label: "H3" },
  { value: "small", label: "Small Text" },
];

export const TEXT_SIZE_OPTIONS = [
  { value: "12", label: "12 px" },
  { value: "14", label: "14 px" },
  { value: "16", label: "16 px" },
  { value: "18", label: "18 px" },
  { value: "20", label: "20 px" },
  { value: "24", label: "24 px" },
  { value: "28", label: "28 px" },
  { value: "32", label: "32 px" },
  { value: "36", label: "36 px" },
  { value: "40", label: "40 px" },
  { value: "48", label: "48 px" },
  { value: "56", label: "56 px" },
  { value: "64", label: "64 px" },
];

export const BACKGROUND_REPEAT_OPTIONS = [
  { value: "no-repeat", label: "No Repeat" },
  { value: "repeat", label: "Repeat" },
  { value: "repeat-x", label: "Repeat X" },
  { value: "repeat-y", label: "Repeat Y" },
];

export const FONT_FAMILY_OPTIONS = [
  // ── System Sans-serif ──────────────────────────────────────────
  { value: 'Arial, Helvetica, sans-serif',                       label: 'Arial',               cat: 'System' },
  { value: 'Helvetica, Arial, sans-serif',                       label: 'Helvetica',           cat: 'System' },
  { value: 'Verdana, Geneva, sans-serif',                        label: 'Verdana',             cat: 'System' },
  { value: 'Tahoma, Geneva, sans-serif',                         label: 'Tahoma',              cat: 'System' },
  { value: 'Trebuchet MS, Helvetica, sans-serif',                label: 'Trebuchet MS',        cat: 'System' },
  { value: 'Segoe UI, Tahoma, sans-serif',                       label: 'Segoe UI',            cat: 'System' },
  { value: 'Impact, Haettenschweiler, sans-serif',               label: 'Impact',              cat: 'System' },
  { value: 'Lucida Sans Unicode, Lucida Grande, sans-serif',     label: 'Lucida Sans',         cat: 'System' },
  // ── System Serif ───────────────────────────────────────────────
  { value: 'Georgia, serif',                                     label: 'Georgia',             cat: 'System Serif' },
  { value: 'Times New Roman, Times, serif',                      label: 'Times New Roman',     cat: 'System Serif' },
  { value: 'Garamond, serif',                                    label: 'Garamond',            cat: 'System Serif' },
  { value: 'Palatino, URW Palladio L, serif',                    label: 'Palatino',            cat: 'System Serif' },
  // ── Monospace ──────────────────────────────────────────────────
  { value: 'Courier New, Courier, monospace',                    label: 'Courier New',         cat: 'Monospace' },
  { value: 'Roboto Mono, Courier New, monospace',                label: 'Roboto Mono',         cat: 'Monospace', google: 'Roboto+Mono:wght@400;500' },
  { value: 'Source Code Pro, Courier New, monospace',            label: 'Source Code Pro',     cat: 'Monospace', google: 'Source+Code+Pro:wght@400;500' },
  { value: 'JetBrains Mono, Courier New, monospace',             label: 'JetBrains Mono',      cat: 'Monospace', google: 'JetBrains+Mono:wght@400;500' },
  // ── Popular Sans-serif ─────────────────────────────────────────
  { value: 'Inter, Arial, sans-serif',                           label: 'Inter',               cat: 'Sans-serif', google: 'Inter:wght@400;600' },
  { value: 'Roboto, Arial, sans-serif',                          label: 'Roboto',              cat: 'Sans-serif', google: 'Roboto:wght@400;700' },
  { value: 'Open Sans, Arial, sans-serif',                       label: 'Open Sans',           cat: 'Sans-serif', google: 'Open+Sans:wght@400;600' },
  { value: 'Lato, Arial, sans-serif',                            label: 'Lato',                cat: 'Sans-serif', google: 'Lato:wght@400;700' },
  { value: 'Montserrat, Arial, sans-serif',                      label: 'Montserrat',          cat: 'Sans-serif', google: 'Montserrat:wght@400;600' },
  { value: 'Poppins, Arial, sans-serif',                         label: 'Poppins',             cat: 'Sans-serif', google: 'Poppins:wght@400;600' },
  { value: 'Nunito, Arial, sans-serif',                          label: 'Nunito',              cat: 'Sans-serif', google: 'Nunito:wght@400;600' },
  { value: 'Raleway, Arial, sans-serif',                         label: 'Raleway',             cat: 'Sans-serif', google: 'Raleway:wght@400;600' },
  { value: 'Ubuntu, Arial, sans-serif',                          label: 'Ubuntu',              cat: 'Sans-serif', google: 'Ubuntu:wght@400;500' },
  { value: 'Source Sans 3, Arial, sans-serif',                   label: 'Source Sans 3',       cat: 'Sans-serif', google: 'Source+Sans+3:wght@400;600' },
  { value: 'DM Sans, Arial, sans-serif',                         label: 'DM Sans',             cat: 'Sans-serif', google: 'DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500' },
  { value: 'Work Sans, Arial, sans-serif',                       label: 'Work Sans',           cat: 'Sans-serif', google: 'Work+Sans:wght@400;600' },
  { value: 'Outfit, Arial, sans-serif',                          label: 'Outfit',              cat: 'Sans-serif', google: 'Outfit:wght@400;500' },
  { value: 'Plus Jakarta Sans, Arial, sans-serif',               label: 'Plus Jakarta Sans',   cat: 'Sans-serif', google: 'Plus+Jakarta+Sans:wght@400;600' },
  { value: 'Figtree, Arial, sans-serif',                         label: 'Figtree',             cat: 'Sans-serif', google: 'Figtree:wght@400;500' },
  { value: 'Manrope, Arial, sans-serif',                         label: 'Manrope',             cat: 'Sans-serif', google: 'Manrope:wght@400;500' },
  // ── Serif ──────────────────────────────────────────────────────
  { value: 'Merriweather, Georgia, serif',                       label: 'Merriweather',        cat: 'Serif', google: 'Merriweather:wght@400;700' },
  { value: 'Playfair Display, Georgia, serif',                   label: 'Playfair Display',    cat: 'Serif', google: 'Playfair+Display:wght@400;700' },
  { value: 'Lora, Georgia, serif',                               label: 'Lora',                cat: 'Serif', google: 'Lora:wght@400;600' },
  { value: 'Libre Baskerville, Georgia, serif',                  label: 'Libre Baskerville',   cat: 'Serif', google: 'Libre+Baskerville:wght@400;700' },
  { value: 'EB Garamond, Georgia, serif',                        label: 'EB Garamond',         cat: 'Serif', google: 'EB+Garamond:wght@400;600' },
  { value: 'Crimson Text, Georgia, serif',                       label: 'Crimson Text',        cat: 'Serif', google: 'Crimson+Text:wght@400;600' },
  { value: 'Cormorant Garamond, Georgia, serif',                 label: 'Cormorant Garamond',  cat: 'Serif', google: 'Cormorant+Garamond:wght@400;600' },
  // ── Display ────────────────────────────────────────────────────
  { value: 'Oswald, Arial, sans-serif',                          label: 'Oswald',              cat: 'Display', google: 'Oswald:wght@400;500' },
  { value: 'Bebas Neue, Arial, sans-serif',                      label: 'Bebas Neue',          cat: 'Display', google: 'Bebas+Neue' },
  { value: 'Barlow, Arial, sans-serif',                          label: 'Barlow',              cat: 'Display', google: 'Barlow:wght@400;600' },
  { value: 'Exo 2, Arial, sans-serif',                           label: 'Exo 2',               cat: 'Display', google: 'Exo+2:wght@400;600' },
  // ── Handwriting ────────────────────────────────────────────────
  { value: 'Dancing Script, cursive',                            label: 'Dancing Script',      cat: 'Handwriting', google: 'Dancing+Script:wght@400;600' },
  { value: 'Pacifico, cursive',                                  label: 'Pacifico',            cat: 'Handwriting', google: 'Pacifico' },
  { value: 'Caveat, cursive',                                    label: 'Caveat',              cat: 'Handwriting', google: 'Caveat:wght@400;600' },
  { value: 'Satisfy, cursive',                                   label: 'Satisfy',             cat: 'Handwriting', google: 'Satisfy' },
  { value: 'Comic Sans MS, Comic Sans, cursive',                 label: 'Comic Sans MS',       cat: 'Handwriting' },
];

export const CATALOG = [
  { type: "header",  label: "Header",      icon: "🧾" },
  { type: "text",    label: "Text",         icon: "✍️" },
  { type: "image",   label: "Image",        icon: "🖼️" },
  { type: "imageText", label: "Text On Image", icon: "🏞️" },
  { type: "button",  label: "Button",       icon: "🔘" },
  { type: "divider", label: "Divider",      icon: "➖" },
  { type: "spacer",  label: "Spacer",       icon: "↕️" },
  { type: "hero",    label: "Hero Banner",  icon: "🚀" },
  { type: "quote",   label: "Quote",        icon: "💬" },
  { type: "promo",   label: "Promo Box",    icon: "🏷️" },
  { type: "video",   label: "Video CTA",    icon: "🎬" },
  { type: "contact", label: "Contact Card", icon: "📇" },
  { type: "gridCard", label: "Card Grid",   icon: "⊞" },
  { type: "listCard", label: "Card List",   icon: "☰" },
  { type: "social",  label: "Social Bar",   icon: "🌐" },
  { type: "footer",  label: "Footer",       icon: "🏁" },
];
