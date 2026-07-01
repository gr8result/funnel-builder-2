// Central font registry used by GlobalTextEditor across all platform editors.
// Every Google Font entry carries a `google` field (the URL family string) so
// useFontLoader can inject the right <link> tag on demand.

export const FONT_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "sans-serif", label: "Sans-serif" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "monospace", label: "Monospace" },
  { id: "handwriting", label: "Handwriting" },
];

// weights that the font actually ships (used to build weight pickers per font)
export const FONT_REGISTRY = [
  // ── System / safe ────────────────────────────────────────────────────────
  { family: "Arial",          stack: "Arial, Helvetica, sans-serif",                   category: "sans-serif",  system: true, weights: [400, 700] },
  { family: "Helvetica",      stack: "Helvetica, Arial, sans-serif",                   category: "sans-serif",  system: true, weights: [400, 700] },
  { family: "Verdana",        stack: "Verdana, Geneva, sans-serif",                    category: "sans-serif",  system: true, weights: [400, 700] },
  { family: "Tahoma",         stack: "Tahoma, Verdana, sans-serif",                    category: "sans-serif",  system: true, weights: [400, 700] },
  { family: "Trebuchet MS",   stack: "'Trebuchet MS', Arial, sans-serif",              category: "sans-serif",  system: true, weights: [400, 700] },
  { family: "Segoe UI",       stack: "'Segoe UI', Tahoma, Geneva, sans-serif",         category: "sans-serif",  system: true, weights: [300, 400, 600, 700] },
  { family: "Impact",         stack: "Impact, Haettenschweiler, sans-serif",           category: "display",     system: true, weights: [400] },
  { family: "Lucida Sans",    stack: "'Lucida Sans', 'Lucida Grande', sans-serif",     category: "sans-serif",  system: true, weights: [400] },
  { family: "Georgia",        stack: "Georgia, 'Times New Roman', serif",              category: "serif",       system: true, weights: [400, 700] },
  { family: "Times New Roman",stack: "'Times New Roman', Times, serif",               category: "serif",       system: true, weights: [400, 700] },
  { family: "Garamond",       stack: "Garamond, 'Times New Roman', serif",            category: "serif",       system: true, weights: [400, 700] },
  { family: "Palatino",       stack: "'Palatino Linotype', Palatino, serif",          category: "serif",       system: true, weights: [400, 700] },
  { family: "Courier New",    stack: "'Courier New', Courier, monospace",              category: "monospace",   system: true, weights: [400, 700] },
  { family: "Comic Sans MS",  stack: "'Comic Sans MS', cursive, sans-serif",           category: "handwriting", system: true, weights: [400, 700] },

  // ── Google — Sans-serif ───────────────────────────────────────────────────
  { family: "Inter",              stack: "Inter, sans-serif",                  category: "sans-serif",  google: "Inter:wght@100;200;300;400;500;600;700;800;900",              weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Roboto",             stack: "Roboto, sans-serif",                 category: "sans-serif",  google: "Roboto:wght@100;300;400;500;700;900",                         weights: [100,300,400,500,700,900] },
  { family: "Open Sans",          stack: "'Open Sans', sans-serif",            category: "sans-serif",  google: "Open+Sans:wght@300;400;500;600;700;800",                      weights: [300,400,500,600,700,800] },
  { family: "Lato",               stack: "Lato, sans-serif",                   category: "sans-serif",  google: "Lato:wght@100;300;400;700;900",                              weights: [100,300,400,700,900] },
  { family: "Montserrat",         stack: "Montserrat, sans-serif",             category: "sans-serif",  google: "Montserrat:wght@100;200;300;400;500;600;700;800;900",         weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Poppins",            stack: "Poppins, sans-serif",                category: "sans-serif",  google: "Poppins:wght@100;200;300;400;500;600;700;800;900",            weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Nunito",             stack: "Nunito, sans-serif",                 category: "sans-serif",  google: "Nunito:wght@200;300;400;500;600;700;800;900",                 weights: [200,300,400,500,600,700,800,900] },
  { family: "Raleway",            stack: "Raleway, sans-serif",                category: "sans-serif",  google: "Raleway:wght@100;200;300;400;500;600;700;800;900",            weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Ubuntu",             stack: "Ubuntu, sans-serif",                 category: "sans-serif",  google: "Ubuntu:wght@300;400;500;700",                                weights: [300,400,500,700] },
  { family: "Source Sans 3",      stack: "'Source Sans 3', sans-serif",        category: "sans-serif",  google: "Source+Sans+3:wght@200;300;400;500;600;700;800;900",          weights: [200,300,400,500,600,700,800,900] },
  { family: "DM Sans",            stack: "'DM Sans', sans-serif",              category: "sans-serif",  google: "DM+Sans:wght@100;200;300;400;500;600;700;800;900",            weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Work Sans",          stack: "'Work Sans', sans-serif",            category: "sans-serif",  google: "Work+Sans:wght@100;200;300;400;500;600;700;800;900",          weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Outfit",             stack: "Outfit, sans-serif",                 category: "sans-serif",  google: "Outfit:wght@100;200;300;400;500;600;700;800;900",             weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Plus Jakarta Sans",  stack: "'Plus Jakarta Sans', sans-serif",    category: "sans-serif",  google: "Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800",          weights: [200,300,400,500,600,700,800] },
  { family: "Figtree",            stack: "Figtree, sans-serif",                category: "sans-serif",  google: "Figtree:wght@300;400;500;600;700;800;900",                    weights: [300,400,500,600,700,800,900] },
  { family: "Manrope",            stack: "Manrope, sans-serif",                category: "sans-serif",  google: "Manrope:wght@200;300;400;500;600;700;800",                    weights: [200,300,400,500,600,700,800] },
  { family: "Noto Sans",          stack: "'Noto Sans', sans-serif",            category: "sans-serif",  google: "Noto+Sans:wght@100;200;300;400;500;600;700;800;900",          weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Mulish",             stack: "Mulish, sans-serif",                 category: "sans-serif",  google: "Mulish:wght@200;300;400;500;600;700;800;900",                 weights: [200,300,400,500,600,700,800,900] },
  { family: "Quicksand",          stack: "Quicksand, sans-serif",              category: "sans-serif",  google: "Quicksand:wght@300;400;500;600;700",                          weights: [300,400,500,600,700] },

  // ── Google — Serif ────────────────────────────────────────────────────────
  { family: "Merriweather",        stack: "Merriweather, serif",               category: "serif",       google: "Merriweather:wght@300;400;700;900",                           weights: [300,400,700,900] },
  { family: "Playfair Display",    stack: "'Playfair Display', serif",         category: "serif",       google: "Playfair+Display:wght@400;500;600;700;800;900",               weights: [400,500,600,700,800,900] },
  { family: "Lora",                stack: "Lora, serif",                       category: "serif",       google: "Lora:wght@400;500;600;700",                                   weights: [400,500,600,700] },
  { family: "Libre Baskerville",   stack: "'Libre Baskerville', serif",        category: "serif",       google: "Libre+Baskerville:wght@400;700",                              weights: [400,700] },
  { family: "EB Garamond",         stack: "'EB Garamond', serif",              category: "serif",       google: "EB+Garamond:wght@400;500;600;700;800",                        weights: [400,500,600,700,800] },
  { family: "Crimson Text",        stack: "'Crimson Text', serif",             category: "serif",       google: "Crimson+Text:wght@400;600;700",                               weights: [400,600,700] },
  { family: "Cormorant Garamond",  stack: "'Cormorant Garamond', serif",       category: "serif",       google: "Cormorant+Garamond:wght@300;400;500;600;700",                 weights: [300,400,500,600,700] },
  { family: "Bitter",              stack: "Bitter, serif",                     category: "serif",       google: "Bitter:wght@100;200;300;400;500;600;700;800;900",             weights: [100,200,300,400,500,600,700,800,900] },

  // ── Google — Display ──────────────────────────────────────────────────────
  { family: "Oswald",       stack: "Oswald, sans-serif",         category: "display",  google: "Oswald:wght@200;300;400;500;600;700",                   weights: [200,300,400,500,600,700] },
  { family: "Bebas Neue",   stack: "'Bebas Neue', sans-serif",   category: "display",  google: "Bebas+Neue",                                            weights: [400] },
  { family: "Barlow",       stack: "Barlow, sans-serif",         category: "display",  google: "Barlow:wght@100;200;300;400;500;600;700;800;900",       weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Exo 2",        stack: "'Exo 2', sans-serif",        category: "display",  google: "Exo+2:wght@100;200;300;400;500;600;700;800;900",        weights: [100,200,300,400,500,600,700,800,900] },
  { family: "Anton",        stack: "Anton, sans-serif",           category: "display",  google: "Anton",                                                  weights: [400] },
  { family: "Abril Fatface",stack: "'Abril Fatface', cursive",   category: "display",  google: "Abril+Fatface",                                          weights: [400] },

  // ── Google — Monospace ────────────────────────────────────────────────────
  { family: "Roboto Mono",     stack: "'Roboto Mono', monospace",   category: "monospace", google: "Roboto+Mono:wght@100;200;300;400;500;600;700",          weights: [100,200,300,400,500,600,700] },
  { family: "Source Code Pro", stack: "'Source Code Pro', monospace",category: "monospace", google: "Source+Code+Pro:wght@200;300;400;500;600;700;800;900", weights: [200,300,400,500,600,700,800,900] },
  { family: "JetBrains Mono",  stack: "'JetBrains Mono', monospace",category: "monospace", google: "JetBrains+Mono:wght@100;200;300;400;500;600;700;800",  weights: [100,200,300,400,500,600,700,800] },
  { family: "Fira Code",       stack: "'Fira Code', monospace",     category: "monospace", google: "Fira+Code:wght@300;400;500;600;700",                    weights: [300,400,500,600,700] },

  // ── Google — Handwriting ──────────────────────────────────────────────────
  { family: "Dancing Script", stack: "'Dancing Script', cursive", category: "handwriting", google: "Dancing+Script:wght@400;500;600;700", weights: [400,500,600,700] },
  { family: "Pacifico",       stack: "Pacifico, cursive",          category: "handwriting", google: "Pacifico",                            weights: [400] },
  { family: "Caveat",         stack: "Caveat, cursive",             category: "handwriting", google: "Caveat:wght@400;500;600;700",         weights: [400,500,600,700] },
  { family: "Satisfy",        stack: "Satisfy, cursive",            category: "handwriting", google: "Satisfy",                             weights: [400] },
  { family: "Indie Flower",   stack: "'Indie Flower', cursive",    category: "handwriting", google: "Indie+Flower",                        weights: [400] },
  { family: "Permanent Marker",stack: "'Permanent Marker', cursive",category: "handwriting", google: "Permanent+Marker",                   weights: [400] },
];

// ── Look-up helpers ──────────────────────────────────────────────────────────

export function getFontEntry(family) {
  if (!family) return null;
  const q = String(family).split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
  return FONT_REGISTRY.find(f => f.family.toLowerCase() === q) || null;
}

export function getFontStack(family) {
  const entry = getFontEntry(family);
  return entry ? entry.stack : family;
}

export function getFontsByCategory(category) {
  if (!category || category === "all") return FONT_REGISTRY;
  return FONT_REGISTRY.filter(f => f.category === category);
}

export function searchFonts(query) {
  if (!query) return FONT_REGISTRY;
  const q = String(query).toLowerCase();
  return FONT_REGISTRY.filter(f =>
    f.family.toLowerCase().includes(q) || f.category.includes(q)
  );
}

export function getAvailableWeights(family) {
  const entry = getFontEntry(family);
  return entry ? entry.weights : [400, 700];
}

// Build a single Google Fonts URL for a list of font families
export function buildGoogleFontsUrl(families) {
  const seen = new Set();
  const params = families
    .map(f => getFontEntry(f))
    .filter(e => e && e.google && !seen.has(e.google) && seen.add(e.google))
    .map(e => `family=${e.google}`);
  if (!params.length) return null;
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

export const DEFAULT_FONT_FAMILY = "Manrope";
export const DEFAULT_FONT_STACK  = "Manrope, 'Segoe UI', system-ui, -apple-system, sans-serif";
