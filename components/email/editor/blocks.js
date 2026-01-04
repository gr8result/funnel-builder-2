// /components/email/editor/blocks.js
// FULL REPLACEMENT — block creation + correct insertion point calculation + template HTML normalization

export function makeBlock(type) {
  const t = String(type || "").trim();

  if (t === "text") {
    const wrap = blockWrap("text");
    wrap.innerHTML = `<p style="margin:0; font-size:16px; line-height:1.6;">Double-click and type…</p>`;
    return wrap;
  }

  if (t === "button") {
    const wrap = blockWrap("button");
    wrap.innerHTML = `
      <div style="text-align:left;">
        <a href="#" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:900;border-radius:12px;padding:12px 16px;">
          Button
        </a>
      </div>`;
    return wrap;
  }

  if (t === "divider") {
    const wrap = blockWrap("divider");
    wrap.innerHTML = `<div style="height:1px;background:#e5e7eb;width:100%;margin:10px 0;"></div>`;
    return wrap;
  }

  if (t === "spacer") {
    const wrap = blockWrap("spacer");
    wrap.innerHTML = `<div style="height:24px;"></div>`;
    return wrap;
  }

  if (t === "columns2" || t === "columns3") {
    const cols = t === "columns3" ? 3 : 2;
    const wrap = blockWrap("columns");
    wrap.setAttribute("data-cols", String(cols));

    // email-safe-ish: table layout
    const td = new Array(cols)
      .fill(0)
      .map(
        () => `<td style="vertical-align:top;padding:10px;border:1px dashed #e5e7eb;">
                <p style="margin:0;font-size:16px;line-height:1.6;">Column</p>
              </td>`
      )
      .join("");

    wrap.innerHTML = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>${td}</tr>
      </table>
    `;
    return wrap;
  }

  if (t === "image") {
    const wrap = blockWrap("image");
    wrap.innerHTML = `
      <div class="imgHint" style="border:2px dashed #94a3b8;border-radius:14px;padding:18px;text-align:center;color:#64748b;font-weight:900;">
        Image block<br/><span style="font-weight:800;font-size:12px;">Open library → click an image to insert</span>
      </div>
      <img src="" alt="" style="display:none;max-width:100%;border-radius:14px;" />
    `;
    return wrap;
  }

  if (t === "social") {
    const wrap = blockWrap("social");
    wrap.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;">
        ${icon("Facebook")}
        ${icon("Instagram")}
        ${icon("LinkedIn")}
        ${icon("YouTube")}
      </div>
    `;
    return wrap;
  }

  if (t === "html") {
    const wrap = blockWrap("html");
    wrap.innerHTML = `<div style="font-family:monospace;font-size:13px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:12px;color:#111827;">
      Paste HTML here…
    </div>`;
    return wrap;
  }

  // fallback
  const wrap = blockWrap("text");
  wrap.innerHTML = `<p style="margin:0;font-size:16px;line-height:1.6;">Block</p>`;
  return wrap;
}

function blockWrap(name) {
  const wrap = document.createElement("div");
  wrap.setAttribute("data-block", name);
  wrap.style.margin = "10px 0";
  wrap.style.padding = "10px 12px";
  wrap.style.border = "1px solid rgba(148,163,184,0.25)";
  wrap.style.borderRadius = "14px";
  wrap.style.background = "rgba(255,255,255,0.02)";
  return wrap;
}

function icon(label) {
  return `<a href="#" style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:#111827;color:#fff;text-decoration:none;font-weight:900;">
    ${label[0]}
  </a>`;
}

export function findInsertionPoint(canvasEl, clientY) {
  const blocks = Array.from(canvasEl.querySelectorAll(":scope > [data-block]"));
  if (!blocks.length) return { ref: null, before: true, lineY: 22 };

  // find nearest block center
  let best = null;
  for (const b of blocks) {
    const r = b.getBoundingClientRect();
    const center = r.top + r.height / 2;
    const dist = Math.abs(clientY - center);
    if (!best || dist < best.dist) {
      best = { ref: b, rect: r, center, dist };
    }
  }

  if (!best) return { ref: null, before: true, lineY: 22 };
  const before = clientY < best.center;
  const lineY = before ? best.rect.top - canvasEl.getBoundingClientRect().top + canvasEl.parentElement.scrollTop : best.rect.bottom - canvasEl.getBoundingClientRect().top + canvasEl.parentElement.scrollTop;
  return { ref: best.ref, before, lineY };
}

export function normalizeCanvasHtml(html) {
  const s = String(html || "").trim();
  if (!s) return "";
  // If full HTML doc, extract body
  if (/<html[\s>]/i.test(s) || /<body[\s>]/i.test(s)) {
    const bodyMatch = s.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : s;
    return wrapImportedHtml(body);
  }
  return wrapImportedHtml(s);
}

function wrapImportedHtml(inner) {
  // wrap imported html into a single block so drag/drop keeps working
  const safe = String(inner || "").trim();
  if (!safe) return "";

  // If it already uses our data-block wrappers, keep as-is
  if (safe.includes('data-block="')) return safe;

  return `
    <div data-block="import" style="margin:10px 0;padding:10px 12px;border:1px solid rgba(148,163,184,0.25);border-radius:14px;">
      ${safe}
    </div>
  `;
}

export function ensureCanvasHasRoot(canvasEl) {
  // make sure top-level blocks are selectable targets
  // if someone typed plain text at root, wrap it
  const childNodes = Array.from(canvasEl.childNodes || []);
  for (const n of childNodes) {
    if (n.nodeType === 3 && String(n.textContent || "").trim()) {
      const w = document.createElement("div");
      w.setAttribute("data-block", "text");
      w.style.margin = "10px 0";
      w.style.padding = "10px 12px";
      w.style.border = "1px solid rgba(148,163,184,0.25)";
      w.style.borderRadius = "14px";
      const p = document.createElement("p");
      p.textContent = n.textContent;
      p.style.margin = "0";
      p.style.fontSize = "16px";
      p.style.lineHeight = "1.6";
      w.appendChild(p);
      canvasEl.replaceChild(w, n);
    }
  }

  // wrap any non-block element at root
  const rootEls = Array.from(canvasEl.children || []);
  for (const el of rootEls) {
    if (!el.getAttribute("data-block")) {
      const w = document.createElement("div");
      w.setAttribute("data-block", "import");
      w.style.margin = "10px 0";
      w.style.padding = "10px 12px";
      w.style.border = "1px solid rgba(148,163,184,0.25)";
      w.style.borderRadius = "14px";
      while (el.firstChild) w.appendChild(el.firstChild);
      canvasEl.replaceChild(w, el);
    }
  }
}
