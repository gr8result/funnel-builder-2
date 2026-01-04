// utils/emailEditorStore.js

const COLOR_KEY = "gr8:email:colors:v1";
const BLOCK_KEY = "gr8:email:blocks:v2";

export function loadSavedColors() {
  try {
    return JSON.parse(localStorage.getItem(COLOR_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveColor(color) {
  const colors = loadSavedColors();
  if (!colors.includes(color)) {
    colors.push(color);
    localStorage.setItem(COLOR_KEY, JSON.stringify(colors));
  }
}

export function loadSavedBlocks() {
  try {
    return JSON.parse(localStorage.getItem(BLOCK_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveBlock(block) {
  const blocks = loadSavedBlocks();
  const idx = blocks.findIndex(b => b.name === block.name);
  if (idx >= 0) blocks[idx] = block;
  else blocks.push(block);
  localStorage.setItem(BLOCK_KEY, JSON.stringify(blocks));
}
