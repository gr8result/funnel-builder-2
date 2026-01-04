// /utils/avatar.js
// 🚀 High-uniqueness universal avatar generator (~200,000+ combos)
// Emoji + HSL colour + Shape variation (circle, square, hex, diamond)

export const AVATAR_EMOJIS = [
  "😀","😁","😂","🤣","😃","😄","😅","😆",
  "😉","😊","😋","😎","😍","😘","😗","😙","😚",
  "🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄",
  "😏","😣","😥","😮","🤐","😯","😪","😫","🥱",
  "😴","😌","😛","😜","😝","🤤","😒","😓","😔",
  "😕","🙃","🤑","😲","☠️","🤧","🤒","🤕","🤢",
  "🤮","🤠","😈","👹","👺","👻","👽","🤖","🎃",
  "😺","😸","😹","😻","😼","😽","🙀","😿","😾",
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨",
  "🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊",
  "🐣","🐤","🐥","🐦","🐧","🦅","🦆","🦉","🦇",
  "🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞",
  "🐜","🪲","🐢","🐍","🦎","🦂","🦀","🐡",
  "🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍",
  "🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬",
];

// Shape variations
export const AVATAR_SHAPES = ["circle", "square", "hex", "diamond"];

// Hash generator (deterministic)
export function hashString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Main avatar resolver
export function getAvatarForLead(lead = {}) {
  const key =
    (lead.email || "").toLowerCase() ||
    String(lead.id || "") ||
    (lead.name || "");

  const h = hashString(key || "gr8");

  const emoji = lead.avatar_icon || AVATAR_EMOJIS[h % AVATAR_EMOJIS.length];

  // Colour variation — 360 hues × 6 intensity ranges ≈ 2160 variations
  const hue = h % 360;
  const lightness = 40 + (h % 6) * 10; // range 40-90
  const saturation = 75;

  const color =
    lead.avatar_color || `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  const shape = AVATAR_SHAPES[h % AVATAR_SHAPES.length];

  return { emoji, color, shape };
}
