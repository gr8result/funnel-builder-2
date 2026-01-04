// ============================================
// /lib/email/blockSchema.js
// GR8 RESULT — Email Builder (stable schema + rich text + image focal)
// FULL REPLACEMENT
// ============================================

export const DEFAULT_BRAND_BG = "#3b82f6";
export const DEFAULT_CANVAS_BG = "#0b1220";

export function uid(prefix = "blk") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function makeBlock(type) {
  const base = {
    id: uid(type),
    type,
    content: {},
    style: {
      padding: 18,
      radius: 0,
      align: "center", // left|center|right
      background: "none", // none|brand|dark|light
      textColor: "#ffffff",
    },
  };

  if (type === "header") {
    base.content = { title: "GR8 RESULT", subtitle: "Your next campaigns starts here" };
    base.style.background = "brand";
  }

  if (type === "hero") {
    base.content = {
      title: "Big headline",
      subtitle: "Write your main message here. Keep it clear and short.",
      image: null,
      fit: "cover", // cover|contain
      focalX: 50,
      focalY: 50,
    };
  }

  if (type === "text") {
    // IMPORTANT: store as HTML so formatting persists
    base.content = {
      html:
        'Double click to edit this text.<br/><br/>Use the toolbar to style it (bold, lists, links, etc).',
    };
    base.style.align = "left";
    base.style.textColor = "#e5e7eb";
  }

  if (type === "image") {
    base.content = {
      image: null,
      alt: "",
      fit: "cover",
      focalX: 50,
      focalY: 50,
    };
  }

  if (type === "button") {
    base.content = { label: "Click here", url: "#" };
    base.style.align = "center";
  }

  if (type === "social") {
    base.content = {
      facebook: "https://facebook.com",
      instagram: "https://instagram.com",
      linkedin: "https://linkedin.com",
      youtube: "https://youtube.com",
    };
    base.style.align = "center";
  }

  if (type === "divider") {
    base.content = { thickness: 1 };
  }

  if (type === "spacer") {
    base.content = { height: 24 };
  }

  if (type === "footer") {
    base.content = { text: "© GR8 RESULT — All rights reserved." };
    base.style.align = "center";
    base.style.textColor = "#9ca3af";
  }

  return base;
}

export function normalizeBlocks(input) {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .filter(Boolean)
    .map((b) => {
      const safe = {
        id: String(b.id || uid("blk")),
        type: String(b.type || "text"),
        content: typeof b.content === "object" && b.content ? b.content : {},
        style: typeof b.style === "object" && b.style ? b.style : {},
      };

      safe.style = {
        padding: Number.isFinite(+safe.style.padding) ? +safe.style.padding : 18,
        radius: Number.isFinite(+safe.style.radius) ? +safe.style.radius : 0,
        align: ["left", "center", "right"].includes(safe.style.align) ? safe.style.align : "center",
        background: ["none", "brand", "dark", "light"].includes(safe.style.background) ? safe.style.background : "none",
        textColor: typeof safe.style.textColor === "string" ? safe.style.textColor : "#ffffff",
      };

      // normalise image options if present
      if (safe.type === "image" || safe.type === "hero") {
        safe.content.fit = ["cover", "contain"].includes(safe.content.fit) ? safe.content.fit : "cover";
        safe.content.focalX = Number.isFinite(+safe.content.focalX) ? Math.max(0, Math.min(100, +safe.content.focalX)) : 50;
        safe.content.focalY = Number.isFinite(+safe.content.focalY) ? Math.max(0, Math.min(100, +safe.content.focalY)) : 50;
      }

      // text html fallback
      if (safe.type === "text") {
        if (typeof safe.content.html !== "string") safe.content.html = "";
      }

      return safe;
    });
}

export function backgroundToColor(bg) {
  if (bg === "brand") return DEFAULT_BRAND_BG;
  if (bg === "dark") return "#0b1220";
  if (bg === "light") return "#ffffff";
  return "transparent";
}

export function alignToJustify(align) {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

function escAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function blocksToHtml(blocks) {
  const safe = normalizeBlocks(blocks);

  const wrapStyle =
    "margin:0;padding:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;color:#ffffff;";
  const containerStyle = "max-width:720px;margin:0 auto;padding:18px;";

  const row = (inner, bg, pad, radius, align) => {
    const bgc = backgroundToColor(bg);
    const justify = alignToJustify(align);
    return `
      <div style="display:flex;justify-content:${justify};">
        <div style="width:100%;background:${bgc};padding:${pad}px;border-radius:${radius}px;box-sizing:border-box;margin:10px 0;">
          ${inner}
        </div>
      </div>
    `;
  };

  const htmlBlocks = safe
    .map((b) => {
      const pad = b.style.padding;
      const radius = b.style.radius;
      const align = b.style.align;
      const bg = b.style.background;
      const tc = b.style.textColor || "#ffffff";

      if (b.type === "header") {
        const t = escAttr(b.content.title || "GR8 RESULT");
        const st = escAttr(b.content.subtitle || "");
        return row(
          `<div style="text-align:center;">
            <div style="font-size:18px;font-weight:700;color:${tc};">${t}</div>
            <div style="font-size:13px;margin-top:4px;color:${tc};opacity:.95;">${st}</div>
          </div>`,
          bg,
          pad,
          radius,
          "center"
        );
      }

      if (b.type === "hero") {
        const title = escAttr(b.content.title || "");
        const sub = escAttr(b.content.subtitle || "");
        const fit = b.content.fit || "cover";
        const fx = Number.isFinite(+b.content.focalX) ? +b.content.focalX : 50;
        const fy = Number.isFinite(+b.content.focalY) ? +b.content.focalY : 50;

        const img = b.content.image
          ? `<img src="${escAttr(b.content.image)}" style="width:100%;height:320px;object-fit:${fit};object-position:${fx}% ${fy}%;border-radius:12px;display:block;margin-bottom:12px;" />`
          : "";

        return row(
          `<div style="text-align:left;color:${tc};">
            ${img}
            <div style="font-size:26px;font-weight:800;line-height:1.2;">${title}</div>
            <div style="font-size:14px;line-height:1.5;margin-top:8px;opacity:.95;">${sub}</div>
          </div>`,
          bg,
          pad,
          radius,
          "center"
        );
      }

      if (b.type === "text") {
        const textAlign = b.style.align || "left";
        // stored as HTML
        const html = String(b.content.html || "");
        return row(
          `<div style="font-size:14px;line-height:1.6;color:${tc};text-align:${textAlign};">
            ${html}
          </div>`,
          bg,
          pad,
          radius,
          b.style.align
        );
      }

      if (b.type === "image") {
        const fit = b.content.fit || "cover";
        const fx = Number.isFinite(+b.content.focalX) ? +b.content.focalX : 50;
        const fy = Number.isFinite(+b.content.focalY) ? +b.content.focalY : 50;

        const img = b.content.image
          ? `<img src="${escAttr(b.content.image)}" style="width:100%;height:360px;object-fit:${fit};object-position:${fx}% ${fy}%;border-radius:12px;display:block;" alt="${escAttr(b.content.alt || "")}" />`
          : `<div style="border:1px dashed rgba(255,255,255,.25);border-radius:12px;padding:18px;text-align:center;opacity:.8;">No image selected</div>`;

        return row(img, bg, pad, radius, "center");
      }

      if (b.type === "button") {
        const label = escAttr(b.content.label || "Click here");
        const url = escAttr(b.content.url || "#");
        const justify = alignToJustify(b.style.align);
        return row(
          `<div style="display:flex;justify-content:${justify};">
            <a href="${url}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">
              ${label}
            </a>
          </div>`,
          bg,
          pad,
          radius,
          b.style.align
        );
      }

      if (b.type === "social") {
        const mk = (name, url) =>
          `<a href="${escAttr(url)}" style="display:inline-block;margin:0 6px;text-decoration:none;color:#60a5fa;font-weight:700;">${name}</a>`;
        return row(
          `<div style="text-align:center;">
            ${mk("Facebook", b.content.facebook)}
            ${mk("Instagram", b.content.instagram)}
            ${mk("LinkedIn", b.content.linkedin)}
            ${mk("YouTube", b.content.youtube)}
          </div>`,
          bg,
          pad,
          radius,
          "center"
        );
      }

      if (b.type === "divider") {
        const t = Number.isFinite(+b.content.thickness) ? +b.content.thickness : 1;
        return row(`<div style="height:${t}px;background:rgba(255,255,255,.18);border-radius:999px;"></div>`, "none", 8, 0, "center");
      }

      if (b.type === "spacer") {
        const h = Number.isFinite(+b.content.height) ? +b.content.height : 24;
        return `<div style="height:${h}px;"></div>`;
      }

      if (b.type === "footer") {
        const text = escAttr(b.content.text || "");
        return row(`<div style="text-align:center;font-size:12px;opacity:.85;color:${tc};">${text}</div>`, bg, pad, radius, "center");
      }

      return row(`<div style="opacity:.8;">Unsupported block</div>`, bg, pad, radius, "center");
    })
    .join("");

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${wrapStyle}">
  <div style="${containerStyle}">
    ${htmlBlocks}
  </div>
</body>
</html>`;
}
