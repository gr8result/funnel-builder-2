// /components/email/editor/fontLibrary.js
// FULL REPLACEMENT — ~50 fonts + auto-inject Google Fonts <link> once

export const FONT_OPTIONS = [
  { name: "Arial", css: "Arial" },
  { name: "Verdana", css: "Verdana" },
  { name: "Tahoma", css: "Tahoma" },
  { name: "Trebuchet MS", css: "Trebuchet MS" },
  { name: "Georgia", css: "Georgia" },
  { name: "Times New Roman", css: "Times New Roman" },
  { name: "Courier New", css: "Courier New" },

  // Google fonts (common email-safe-ish when rendered in clients that support webfonts)
  { name: "Inter", css: "Inter" },
  { name: "Roboto", css: "Roboto" },
  { name: "Open Sans", css: "Open Sans" },
  { name: "Lato", css: "Lato" },
  { name: "Montserrat", css: "Montserrat" },
  { name: "Poppins", css: "Poppins" },
  { name: "Nunito", css: "Nunito" },
  { name: "Raleway", css: "Raleway" },
  { name: "Merriweather", css: "Merriweather" },
  { name: "Playfair Display", css: "Playfair Display" },
  { name: "Source Sans 3", css: "Source Sans 3" },
  { name: "Work Sans", css: "Work Sans" },
  { name: "PT Sans", css: "PT Sans" },
  { name: "Ubuntu", css: "Ubuntu" },
  { name: "Fira Sans", css: "Fira Sans" },
  { name: "Oswald", css: "Oswald" },
  { name: "Roboto Slab", css: "Roboto Slab" },
  { name: "Mukta", css: "Mukta" },
  { name: "Karla", css: "Karla" },
  { name: "Quicksand", css: "Quicksand" },
  { name: "Manrope", css: "Manrope" },
  { name: "Rubik", css: "Rubik" },
  { name: "DM Sans", css: "DM Sans" },
  { name: "Mulish", css: "Mulish" },
  { name: "Cabin", css: "Cabin" },
  { name: "Archivo", css: "Archivo" },
  { name: "Bebas Neue", css: "Bebas Neue" },
  { name: "Cinzel", css: "Cinzel" },
  { name: "Caveat", css: "Caveat" },
  { name: "Pacifico", css: "Pacifico" },
  { name: "Dancing Script", css: "Dancing Script" },
  { name: "Satisfy", css: "Satisfy" },
  { name: "IBM Plex Sans", css: "IBM Plex Sans" },
  { name: "IBM Plex Serif", css: "IBM Plex Serif" },
  { name: "Noto Sans", css: "Noto Sans" },
  { name: "Noto Serif", css: "Noto Serif" },
  { name: "Space Grotesk", css: "Space Grotesk" },
  { name: "Space Mono", css: "Space Mono" },
  { name: "Inconsolata", css: "Inconsolata" },
  { name: "Josefin Sans", css: "Josefin Sans" },
  { name: "Anton", css: "Anton" },
  { name: "Bitter", css: "Bitter" },
  { name: "Arvo", css: "Arvo" },
  { name: "Libre Baskerville", css: "Libre Baskerville" },
  { name: "Titillium Web", css: "Titillium Web" },
  { name: "Hind", css: "Hind" },
  { name: "Assistant", css: "Assistant" },
];

export function injectGoogleFonts(options) {
  if (typeof document === "undefined") return;

  const id = "gr8-google-fonts-v1";
  if (document.getElementById(id)) return;

  const google = (options || [])
    .map((x) => x?.name)
    .filter((n) => n && !["Arial", "Verdana", "Tahoma", "Trebuchet MS", "Georgia", "Times New Roman", "Courier New"].includes(n));

  // de-dupe
  const uniq = Array.from(new Set(google));

  // keep URL length sane
  const families = uniq.slice(0, 35).map((n) => `family=${encodeURIComponent(n)}:wght@300;400;600;700;800;900`).join("&");
  const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
