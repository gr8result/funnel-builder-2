// /components/email/editor/blocks.js
// FULL REPLACEMENT — deterministic insertion

export function makeBlock(type) {
  const el = document.createElement("div");
  el.setAttribute("data-gr8-block","1");
  el.style.padding = "18px";

  if (type === "text") el.innerHTML = `<p style="font-size:18px">Text…</p>`;
  if (type === "button") el.innerHTML = `<a style="display:inline-block;padding:12px 20px;background:#22c55e;color:#000;border-radius:999px">Button</a>`;
  if (type === "divider") el.innerHTML = `<hr />`;
  if (type === "spacer") el.innerHTML = `<div style="height:32px"></div>`;
  if (type === "columns") el.innerHTML = `<div style="display:flex;gap:12px"><div>Col 1</div><div>Col 2</div></div>`;
  if (type === "social") el.innerHTML = `<div>FB • IG • IN</div>`;
  if (type === "form") el.innerHTML = `<input placeholder="Email" />`;
  if (type === "html") el.innerHTML = `<div>Paste HTML</div>`;

  return el;
}

export function findInsertionPoint(canvas, mouseY) {
  const blocks = [...canvas.querySelectorAll('[data-gr8-block]')];
  if (!blocks.length) return null;

  for (const block of blocks) {
    const r = block.getBoundingClientRect();
    if (mouseY < r.top + r.height / 2) {
      return { ref:block, before:true, lineY:r.top };
    }
  }

  const last = blocks[blocks.length - 1];
  return { ref:last, before:false, lineY:last.getBoundingClientRect().bottom };
}
