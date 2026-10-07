import { resolveBlockRadius, defaultBlockRadius, normalizeEmailSettings, collapseBlocksForExport, stripEmailMetaBlocks } from "./blockModel.js";
import { esc, rich, clamp, pixelWidthFromPercent, chunkItems } from "./editorUtils.js";
import { toEmailAssetUrl, isEmailRenderableUrl, getSocialIconExportUrl, SOCIAL_ICON_SIZE, getSocialBadge } from "./socialAssets.js";
import { ensureReadableColor, resolvePreferredColor, parseColorToRgb, rgbToHex } from "./colors.js";
import { withDefaultAnchorStyles } from "./richTextCommands.js";

function renderBlockRowsForExport(blocks = [], emailWidth = 600) {
  const normalized = Array.isArray(blocks) ? blocks : [];
  const gapPx = 16;

  return normalized
    .map((block, index) => {
      const isLast = index === normalized.length - 1;
      const bottomPad = block?.type === "spacer" || isLast ? 0 : gapPx;
      const radius = resolveBlockRadius(block?.props || {}, defaultBlockRadius(block?.type));
      const blockHtml = radius > 0 && block?.type !== "divider" && block?.type !== "spacer"
        ? wrapEmailBlockTable(
            `<tr><td style="border-radius:${radius}px;overflow:hidden;">${blockToHtml(block, emailWidth)}</td></tr>`,
            emailWidth
          )
        : blockToHtml(block, emailWidth);
      return `<tr><td align="center" style="padding:0 0 ${bottomPad}px;">${blockHtml}</td></tr>`;
    })
    .join("\n");
}

function wrapEmailBlockTable(innerHtml, width) {
  const safeWidth = Number(width || 600);
  return `<!--[if mso]>
<table role="presentation" width="${safeWidth}" cellpadding="0" cellspacing="0" border="0" align="center" style="width:${safeWidth}px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td>
<![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:${safeWidth}px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
${innerHtml}
</table>
<!--[if mso]></td></tr></table><![endif]-->`;
}

function renderEmailBackgroundTable({
  width,
  bgColor,
  bgImageSrc,
  bgRepeat = "no-repeat",
  borderRadius = 0,
  fixedHeightPx = 0,
  msoInset = "0,0,0,0",
  tdStyle = "",
  innerHtml = "",
}) {
  const safeWidth = Number(width || 600);
  const safeHeight = Math.max(0, Number(fixedHeightPx || 0));
  const safeBgColor = esc(bgColor || "#ffffff");
  const safeImage = esc(bgImageSrc || "");
  const safeRepeat = esc(bgRepeat || "no-repeat");
  const safeMsoInset = esc(msoInset || "0,0,0,0");
  const webBgStyle = bgImageSrc
    ? `background-color:${safeBgColor};background-image:url(${safeImage});background-size:${bgRepeat === "no-repeat" ? "cover" : "auto"};background-position:center;background-repeat:${safeRepeat};`
    : `background-color:${safeBgColor};`;
  const vmlFillAttrs = bgRepeat === "no-repeat"
    ? `type="frame" aspect="atleast" focusposition="0.5,0.5"`
    : `type="tile"`;
  const vmlOpen = bgImageSrc
    ? `<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${safeWidth}px;${safeHeight ? `height:${safeHeight}px;` : ""}"><v:fill ${vmlFillAttrs} src="${safeImage}" color="${safeBgColor}" /><v:textbox inset="${safeMsoInset}" style="${safeHeight ? "mso-fit-shape-to-text:false;v-text-anchor:top;" : "mso-fit-shape-to-text:true;v-text-anchor:top;"}"><div><![endif]-->`
    : "";
  const vmlClose = bgImageSrc ? "<!--[if gte mso 9]></div></v:textbox></v:rect><![endif]-->" : "";

  return wrapEmailBlockTable(
    `<tr><td style="${webBgStyle}${tdStyle}border-radius:${Number(borderRadius || 0)}px;">${vmlOpen}${innerHtml}${vmlClose}</td></tr>`,
    safeWidth
  );
}

function blockToHtml(block, emailWidth = 600) {
  const { type, props: p } = block;
  const W = emailWidth;

  switch (type) {
    case "header": {
      const logoSrc = toEmailAssetUrl(p.logoSrc);
      const exportLogoHeight = Math.min(Number(p.logoHeightPx || 84), 52);
      const exportLogoWidth = Math.min(160, Math.max(96, Math.round((Math.min(Number(p.logoWidthPct || 28), 26) / 100) * W)));
      const logo = logoSrc
        ? `<tr><td style="padding:18px 24px 8px;text-align:center;">
            <img src="${esc(logoSrc)}" alt="Logo" width="${exportLogoWidth}" style="width:${exportLogoWidth}px;max-width:100%;height:${exportLogoHeight}px;object-fit:contain;display:block;margin:0 auto;" />
           </td></tr>`
        : "";
      const pt = logoSrc ? "8px" : "20px";
      return renderEmailBackgroundTable({
        width: W,
        bgColor: p.bgColor,
        bgImageSrc: toEmailAssetUrl(p.bgImageSrc),
        bgRepeat: p.bgRepeat,
        borderRadius: 8,
        tdStyle: "padding:0;text-align:center;",
        innerHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;border-collapse:collapse;">
    ${logo}<tr><td style="padding:${pt} 24px 28px;text-align:center;">
  <h1 style="margin:0 0 8px;font-size:${Number(p.titleSize || 28)}px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:${esc(ensureReadableColor(p.titleColor || p.textColor, p.bgColor || "#1d4ed8", "#ffffff", "#0f172a"))};line-height:1.15;text-shadow:0 2px 8px rgba(15,23,42,0.22);">${rich(p.title)}</h1>
  <p style="margin:0;font-size:${Number(p.subtitleSize || 16)}px;font-family:Arial,Helvetica,sans-serif;color:${esc(ensureReadableColor(p.subtitleColor || p.textColor, p.bgColor || "#1d4ed8", "#dbeafe", "#334155"))};opacity:0.96;line-height:1.55;">${rich(p.subtitle)}</p>
    </td></tr></table>`,
      });
    }

    case "text":
      const textColor = ensureReadableColor(p.textColor || "#1e293b", p.bgColor || "#ffffff", "#ffffff", "#0f172a");
      const htmlWithStyledLinks = withDefaultAnchorStyles(p.html || "", { color: textColor, textDecoration: "inherit" });
      return renderEmailBackgroundTable({
        width: W,
        bgColor: p.bgColor,
        bgImageSrc: toEmailAssetUrl(p.bgImageSrc),
        bgRepeat: p.bgRepeat,
        tdStyle: "padding:16px 24px;",
        innerHtml: `
  <div style="width:${clamp(Number(p.widthPct || 100), 20, 100)}%;max-width:100%;min-height:${Number(p.boxHeightPx || 120)}px;margin:0 auto;font-family:${esc(p.fontFamily || "Arial, Helvetica, sans-serif")};font-size:${p.fontSize || 18}px;color:${esc(textColor)};text-align:${p.align || "left"};box-sizing:border-box;">${htmlWithStyledLinks}</div>
`,
      });

    case "image": {
      const imageSrc = toEmailAssetUrl(p.src);
      const overlayImageSrc = toEmailAssetUrl(p.overlayImageSrc);
      const imageWidthPx = pixelWidthFromPercent(W, p.widthPct || 100, 32);
      const imageHeightPx = clamp(Number(p.heightPx || 220), 60, 900);
      const overlayTitleColor = ensureReadableColor(p.overlayTitleColor || p.textColor, p.overlayBgColor || "rgba(15,23,42,0.38)", "#ffffff", "#0f172a");
      const overlayTextColor = ensureReadableColor(p.overlayTextColor || p.textColor, p.overlayBgColor || "rgba(15,23,42,0.38)", "#f8fafc", "#334155");
      if (imageSrc && p.overlayEnabled) {
        const contentAlign = Number(p.overlayX ?? 50) <= 38 ? "left" : Number(p.overlayX ?? 50) >= 62 ? "right" : "center";
        const tableAlignAttr = (align) => (align === "right" ? "right" : align === "left" ? "left" : "center");
        const overlayImageWidth = Math.min(180, Math.max(56, Math.round((Number(p.overlayImageWidthPct || 24) / 100) * Math.max(220, imageWidthPx - 48))));
        const topSpacer = Math.max(14, Math.round(imageHeightPx * 0.14));
        const contentWidth = Math.max(220, Math.min(imageWidthPx - 48, Math.round((imageWidthPx - 48) * 0.82)));
        const overlayImageHtml = overlayImageSrc
          ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 18px;text-align:${contentAlign};"><img src="${esc(overlayImageSrc)}" alt="" width="${overlayImageWidth}" height="${Number(p.overlayImageHeightPx || 72)}" style="width:${overlayImageWidth}px;max-width:100%;height:${Number(p.overlayImageHeightPx || 72)}px;object-fit:contain;display:block;margin:${contentAlign === "left" ? "0 auto 0 0" : contentAlign === "right" ? "0 0 0 auto" : "0 auto"};border-radius:${Number(p.overlayImageRadius || 8)}px;" /></td></tr>`
          : "";
        const titleHtml = String(p.overlayTitle || "").trim()
          ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 ${String(p.overlayText || "").trim() ? 10 : 0}px;text-align:${contentAlign};"><div style="font-size:${Number(p.overlayTitleSize || 24)}px;font-weight:800;line-height:1.15;color:${esc(overlayTitleColor)};text-shadow:0 2px 8px rgba(15,23,42,0.4);">${rich(p.overlayTitle || "")}</div></td></tr>`
          : "";
        const textHtml = String(p.overlayText || "").trim()
          ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0;text-align:${contentAlign};"><div style="font-size:${Number(p.overlayTextSize || 14)}px;font-weight:600;line-height:1.5;color:${esc(overlayTextColor)};text-shadow:0 2px 8px rgba(15,23,42,0.35);">${rich(p.overlayText || "")}</div></td></tr>`
          : "";
        const innerHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;height:${imageHeightPx}px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td valign="middle" style="padding:24px;background:${esc(p.overlayBgColor || "rgba(15,23,42,0.38)")};vertical-align:middle;">
      <table role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0" align="${tableAlignAttr(contentAlign)}" style="width:${contentWidth}px;max-width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr><td height="${topSpacer}" style="height:${topSpacer}px;font-size:0;line-height:0;">&nbsp;</td></tr>
        ${overlayImageHtml}
        ${titleHtml}
        ${textHtml}
      </table>
    </td>
  </tr>
</table>`;
        const blockHtml = renderEmailBackgroundTable({
          width: imageWidthPx,
          bgColor: p.bgColor || "#0f172a",
          bgImageSrc: imageSrc,
          bgRepeat: "no-repeat",
          borderRadius: p.borderRadius || 0,
          fixedHeightPx: imageHeightPx,
          msoInset: "0,0,0,0",
          tdStyle: `padding:0;background-color:transparent;color:${esc(p.textColor || "#ffffff")};font-family:Arial,Helvetica,sans-serif;`,
          innerHtml,
        });
        const linkedBlock = p.linkHref ? `<a href="${esc(p.linkHref)}" style="display:block;text-decoration:none;">${blockHtml}</a>` : blockHtml;
        return wrapEmailBlockTable(`<tr><td style="padding:12px 16px;text-align:${p.align || "center"};">${linkedBlock}</td></tr>`, W);
      }

      const imgTag = imageSrc
        ? `<img src="${esc(imageSrc)}" alt="${esc(p.alt)}" width="${imageWidthPx}" height="${imageHeightPx}" style="width:${imageWidthPx}px;max-width:100%;height:${imageHeightPx}px;object-fit:${esc(p.fitMode || "cover")};object-position:${Number(p.imageX ?? 50)}% ${Number(p.imageY ?? 50)}%;display:block;margin:0 auto;border-radius:${p.borderRadius || 0}px;" />`
        : "";
      const wrapped = `<div style="position:relative;display:block;width:${imageWidthPx}px;max-width:100%;margin:0 auto;">${imgTag}</div>`;
      const inner = p.linkHref
        ? `<a href="${esc(p.linkHref)}" style="display:block;text-align:${p.align || "center"};">${wrapped}</a>`
        : `<div style="text-align:${p.align || "center"};">${wrapped}</div>`;
      const imageBlockBg = p.bgColor || "transparent";
      return wrapEmailBlockTable(
        `<tr><td style="padding:12px 16px;background:${esc(imageBlockBg)};">${inner}</td></tr>`,
        W
      );
    }

    case "button":
      const buttonTextColor = resolvePreferredColor(p.textColor || "#ffffff", p.bgColor || "#2563eb", "#ffffff", "#0f172a");
      return wrapEmailBlockTable(
        `<tr><td style="padding:16px 24px;text-align:${p.align || "center"};background:${esc(p.blockBgColor || "transparent")};">
  <a href="${esc(p.href)}" style="display:inline-block;padding:12px 28px;background-color:${esc(p.bgColor || "#2563eb")};color:${esc(buttonTextColor)};text-decoration:none;border-radius:${p.borderRadius || 8}px;font-size:15px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${rich(p.text || "Button")}</a>
</td></tr>`,
        W
      );

    case "divider": {
      const side = Math.round((100 - (p.widthPct || 100)) / 2);
      return wrapEmailBlockTable(
        `<tr><td style="padding:8px ${side}%;"><hr style="border:0;border-top:${p.thickness || 1}px ${p.style || "solid"} ${esc(p.color)};margin:0;" /></td></tr>`,
        W
      );
    }

    case "hero": {
      const heroImageWidthPx = pixelWidthFromPercent(W, p.imageWidthPct || 100, 56);
      const heroImageSrc = toEmailAssetUrl(p.imageSrc);
      const img = heroImageSrc
        ? `<img src="${esc(heroImageSrc)}" alt="Hero" width="${heroImageWidthPx}" style="width:${heroImageWidthPx}px;max-width:100%;height:${Number(p.imageHeightPx || 220)}px;object-fit:cover;object-position:${Number(p.imageX ?? 50)}% ${Number(p.imageY ?? 50)}%;display:block;border-radius:8px;margin:0 auto 20px;" />`
        : "";
      const py = p.paddingY ?? 36;
      const ctaTextColor = resolvePreferredColor(p.ctaTextColor || "#ffffff", p.ctaBgColor || "#2563eb", "#ffffff", "#0f172a");
      return renderEmailBackgroundTable({
        width: W,
        bgColor: p.bgColor,
        bgImageSrc: toEmailAssetUrl(p.bgImageSrc),
        bgRepeat: p.bgRepeat,
        borderRadius: 12,
        fixedHeightPx: Number(p.height || 320),
        tdStyle: `padding:${py}px 28px;text-align:center;`,
        innerHtml: `${img}
  <h2 style="margin:0 0 12px;font-size:${Number(p.headlineSize || 30)}px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:${esc(ensureReadableColor(p.headlineColor || p.textColor, p.bgColor || "#0f172a", "#ffffff", "#0f172a"))};line-height:1.15;text-shadow:0 2px 8px rgba(15,23,42,0.28);">${rich(p.headline)}</h2>
  <p style="margin:0 0 24px;font-size:${Number(p.subtextSize || 15)}px;font-family:Arial,Helvetica,sans-serif;color:${esc(ensureReadableColor(p.subtextColor || p.textColor, p.bgColor || "#0f172a", "#e5e7eb", "#334155"))};opacity:0.96;line-height:1.55;">${rich(p.subtext)}</p>
  <a href="${esc(p.ctaHref)}" style="display:inline-block;padding:12px 28px;background-color:${esc(p.ctaBgColor)};color:${esc(ctaTextColor)};text-decoration:none;border-radius:999px;font-size:15px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${rich(p.ctaText)}</a>
    `,
      });
    }

    case "grid": {
      const perRow = clamp(p.columnsPerRow || 2, 1, 4);
      const width = `${Math.floor(100 / perRow)}%`;
      const cardWidthPx = Math.max(120, Math.floor((W - perRow * 16) / perRow));
      const uniformGridImageHeightPx = clamp(
        Math.max(...(Array.isArray(p.columns) && p.columns.length
          ? p.columns.map((col) => Number(col?.imageHeightPx || 160))
          : [160])),
        60,
        420
      );
      const sectionTitleColor = ensureReadableColor("", p.bgColor || "#ffffff", "#ffffff", "#0f172a");
      const sectionSubtextColor = ensureReadableColor("", p.bgColor || "#ffffff", "#e5e7eb", "#475569");
      const intro = (p.sectionHeadline || p.sectionSubtext)
        ? `<tr><td colspan="${perRow}" style="padding:20px 18px 6px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            ${p.sectionHeadline ? `<div style="font-size:24px;font-weight:800;line-height:1.2;color:${esc(sectionTitleColor)};margin-bottom:${p.sectionSubtext ? 6 : 0}px;">${rich(p.sectionHeadline)}</div>` : ""}
            ${p.sectionSubtext ? `<div style="font-size:14px;font-weight:600;line-height:1.5;color:${esc(sectionSubtextColor)};">${rich(p.sectionSubtext)}</div>` : ""}
          </td></tr>`
        : "";
      const rows = chunkItems(p.columns || [], perRow).map((row) => {
        const cells = row.map((col) => {
          const cardTitleColor = ensureReadableColor("", col.bgColor || "#ffffff", "#ffffff", "#1e293b");
          const cardTextColor = ensureReadableColor("", col.bgColor || "#ffffff", "#e5e7eb", "#475569");
          const overlayTextColor = ensureReadableColor("", col.overlayBgColor || "rgba(15,23,42,0.38)", "#ffffff", "#0f172a");
          const overlay = col.overlayEnabled
            ? `<div style="position:absolute;inset:0;border-radius:8px;overflow:hidden;">
                <div style="position:absolute;inset:0;background:${esc(col.overlayBgColor || "rgba(15,23,42,0.38)")};"></div>
                <div style="position:absolute;left:${Number(col.overlayX || 50)}%;top:${Number(col.overlayY || 50)}%;transform:translate(-50%,-50%);width:84%;text-align:center;color:${esc(overlayTextColor)};font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-size:18px;font-weight:800;line-height:1.2;margin-bottom:${col.text ? 6 : 0}px;">${rich(col.title)}</div>
                  <div style="font-size:13px;font-weight:600;line-height:1.5;">${rich(col.text)}</div>
                </div>
              </div>`
            : "";
          const colImageSrc = toEmailAssetUrl(col.imageSrc);
          const gridImageWidthPx = Math.max(96, cardWidthPx - 24);
          const img = colImageSrc
            ? `<div style="position:relative;width:${gridImageWidthPx}px;max-width:100%;margin:0 auto 10px;"><img src="${esc(colImageSrc)}" alt="${esc(col.title)}" width="${gridImageWidthPx}" height="${uniformGridImageHeightPx}" style="width:${gridImageWidthPx}px;max-width:100%;height:${uniformGridImageHeightPx}px;object-fit:cover;display:block;border-radius:8px;" />${overlay}</div>`
            : "";
          const body = col.overlayEnabled ? "" : `<h3 style="margin:0 0 6px;font-size:16px;font-weight:600;font-family:Arial,Helvetica,sans-serif;color:${esc(cardTitleColor)};">${rich(col.title)}</h3><p style="margin:0;font-size:14px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;color:${esc(cardTextColor)};">${rich(col.text)}</p>`;
          return `<td style="width:${width};vertical-align:top;padding:8px;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${esc(col.bgColor || "#ffffff")};border-collapse:separate;border-spacing:0;border-radius:12px;"><tr><td style="padding:12px;border-radius:12px;overflow:hidden;">${img}${body}</td></tr></table></td>`;
        });
        return `<tr>${cells.join("")}</tr>`;
      });
      return wrapEmailBlockTable(
        `${intro}${rows.join("")}`,
        W
      ).replace('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:' + W + 'px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:${W}px;background-color:${esc(p.bgColor || "#ffffff")};border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`);
    }

    case "list": {
      const perRow = clamp(p.itemsPerRow || 1, 1, 4);
      const width = `${Math.floor(100 / perRow)}%`;
      const listCardWidthPx = Math.max(140, Math.floor((W - perRow * 16) / perRow));
      const sectionTitleColor = ensureReadableColor("", p.bgColor || "#ffffff", "#ffffff", "#0f172a");
      const sectionSubtextColor = ensureReadableColor("", p.bgColor || "#ffffff", "#e5e7eb", "#475569");
      const intro = (p.sectionHeadline || p.sectionSubtext)
        ? `<tr><td colspan="${perRow}" style="padding:20px 18px 6px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            ${p.sectionHeadline ? `<div style="font-size:24px;font-weight:800;line-height:1.2;color:${esc(sectionTitleColor)};margin-bottom:${p.sectionSubtext ? 6 : 0}px;">${rich(p.sectionHeadline)}</div>` : ""}
            ${p.sectionSubtext ? `<div style="font-size:14px;font-weight:600;line-height:1.5;color:${esc(sectionSubtextColor)};">${rich(p.sectionSubtext)}</div>` : ""}
          </td></tr>`
        : "";
      const rows = chunkItems(p.items || [], perRow).map((row) => {
        const cells = row.map((item) => {
          const cardTitleColor = ensureReadableColor("", item.bgColor || "#ffffff", "#ffffff", "#1e293b");
          const cardTextColor = ensureReadableColor("", item.bgColor || "#ffffff", "#e5e7eb", "#475569");
          const overlayTextColor = ensureReadableColor("", item.overlayBgColor || "rgba(15,23,42,0.38)", "#ffffff", "#0f172a");
          const stackedListItem = perRow <= 1;
          const inlineImageWidthPx = Math.min(220, Number(item.imageHeightPx || 110));
          const overlay = item.overlayEnabled
            ? `<div style="position:absolute;inset:0;border-radius:8px;overflow:hidden;">
                <div style="position:absolute;inset:0;background:${esc(item.overlayBgColor || "rgba(15,23,42,0.38)")};"></div>
                <div style="position:absolute;left:${Number(item.overlayX || 50)}%;top:${Number(item.overlayY || 50)}%;transform:translate(-50%,-50%);width:84%;text-align:center;color:${esc(overlayTextColor)};font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-size:18px;font-weight:800;line-height:1.2;margin-bottom:${item.text ? 6 : 0}px;">${rich(item.title)}</div>
                  <div style="font-size:13px;font-weight:600;line-height:1.5;">${rich(item.text)}</div>
                </div>
              </div>`
            : "";
          const itemImageSrc = toEmailAssetUrl(item.imageSrc);
          const img = itemImageSrc
            ? `<div style="position:relative;width:${stackedListItem ? inlineImageWidthPx : pixelWidthFromPercent(listCardWidthPx, item.imageWidthPct || 100)}px;max-width:100%;margin:${stackedListItem ? "0" : "0 auto 10px"};"><img src="${esc(itemImageSrc)}" alt="${esc(item.title)}" width="${stackedListItem ? inlineImageWidthPx : pixelWidthFromPercent(listCardWidthPx, item.imageWidthPct || 100)}" style="width:${stackedListItem ? inlineImageWidthPx : pixelWidthFromPercent(listCardWidthPx, item.imageWidthPct || 100)}px;max-width:100%;height:${item.imageHeightPx || 110}px;object-fit:cover;display:block;border-radius:8px;" />${overlay}</div>`
            : "";
          const body = item.overlayEnabled ? "" : `<h3 style="margin:0 0 6px;font-size:17px;font-weight:600;font-family:Arial,Helvetica,sans-serif;color:${esc(cardTitleColor)};">${rich(item.title)}</h3><p style="margin:0;font-size:14px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;color:${esc(cardTextColor)};">${rich(item.text)}</p>`;
          const content = stackedListItem
            ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>${img ? `<td style="width:${inlineImageWidthPx}px;vertical-align:top;padding-right:12px;" valign="top">${img}</td>` : ""}<td style="vertical-align:top;" valign="top">${body}</td></tr></table>`
            : `${img}${body}`;
          return `<td style="width:${width};vertical-align:top;padding:8px;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${esc(item.bgColor || "#ffffff")};border-collapse:separate;border-spacing:0;border-radius:12px;"><tr><td style="padding:12px;text-align:${stackedListItem ? "left" : "center"};border-radius:12px;overflow:hidden;">${content}</td></tr></table></td>`;
        });
        return `<tr>${cells.join("")}</tr>`;
      });
      return wrapEmailBlockTable(
        `<tr><td style="padding:8px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${intro}${rows.join("")}</table></td></tr>`,
        W
      ).replace('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:' + W + 'px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:${W}px;background-color:${esc(p.bgColor || "#ffffff")};border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`);
    }

    case "spacer": {
      return wrapEmailBlockTable(
        `<tr><td style="height:${Number(p.height || 36)}px;font-size:0;line-height:0;background-color:${esc(p.bgColor || "transparent")};">&nbsp;</td></tr>`,
        W
      );
    }

    case "imageText": {
      const imageTextBgImage = toEmailAssetUrl(p.imageSrc);
      const imageTextOverlayImage = toEmailAssetUrl(p.overlayImageSrc);
      const stagePadding = 28;
      const stageHeight = Math.max(220, Number(p.height || 320));
      const stageContentWidth = Math.max(220, W - (stagePadding * 2));
      const overlayImageWidth = Math.min(180, Math.max(56, Math.round((Number(p.overlayImageWidthPct || 24) / 100) * stageContentWidth)));
      const imageButtonTextColor = resolvePreferredColor(p.buttonTextColor || "#ffffff", p.buttonBgColor || "#2563eb", "#ffffff", "#0f172a");
      const msoOverlayRgb = parseColorToRgb(p.overlayShade || "rgba(15,23,42,0.45)") || { r: 15, g: 23, b: 42 };
      const msoOverlayColor = rgbToHex(msoOverlayRgb);
      const contentAlign = p.align === "left" || p.align === "right" ? p.align : "center";
      const tableAlignAttr = (align) => (align === "right" ? "right" : align === "left" ? "left" : "center");
      const contentWidth = Math.max(240, Math.min(stageContentWidth, Math.round(stageContentWidth * 0.86)));
      const topSpacer = Math.max(16, Math.round(stageHeight * 0.1));
      const headlineColor = ensureReadableColor(p.headlineColor || p.textColor, p.overlayShade || "rgba(15,23,42,0.45)", "#ffffff", "#0f172a");
      const subtextColor = ensureReadableColor(p.subtextColor || p.textColor, p.overlayShade || "rgba(15,23,42,0.45)", "#e5e7eb", "#334155");
      const buttonPillHeightPx = 44;
      const buttonHtml = (align) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${tableAlignAttr(align)}" style="border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td bgcolor="${esc(p.buttonBgColor || "#2563eb")}" height="${buttonPillHeightPx}" style="border-radius:999px;height:${buttonPillHeightPx}px;padding:0 24px;text-align:center;mso-padding-alt:0 24px 0 24px;">
      <a href="${esc(p.href || "#")}" style="display:inline-block;color:${esc(imageButtonTextColor)};text-decoration:none;font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:${buttonPillHeightPx}px;height:${buttonPillHeightPx}px;mso-line-height-rule:exactly;white-space:nowrap;">${rich(p.buttonText || "Learn More")}</a>
    </td>
  </tr>
</table>`;
      const overlayImageHtml = isEmailRenderableUrl(imageTextOverlayImage)
        ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 18px;text-align:${contentAlign};"><img src="${esc(imageTextOverlayImage)}" alt="" width="${overlayImageWidth}" height="${Number(p.overlayImageHeightPx || 72)}" style="width:${overlayImageWidth}px;max-width:100%;height:${Number(p.overlayImageHeightPx || 72)}px;object-fit:contain;display:block;margin:${contentAlign === "left" ? "0 auto 0 0" : contentAlign === "right" ? "0 0 0 auto" : "0 auto"};border-radius:${Number(p.overlayImageRadius || 8)}px;" /></td></tr>`
        : "";
      const headlineHtml = String(p.headline || "").trim()
        ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 ${String(p.subtext || "").trim() ? 12 : 0}px;text-align:${contentAlign};"><div style="font-size:${Number(p.headlineSize || 30)}px;font-weight:800;line-height:1.15;margin:0;color:${esc(headlineColor)};text-shadow:0 2px 8px rgba(15,23,42,0.35);">${rich(p.headline)}</div></td></tr>`
        : "";
      const subtextHtml = String(p.subtext || "").trim()
        ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 ${String(p.buttonText || "").trim() ? 20 : 0}px;text-align:${contentAlign};"><div style="font-size:${Number(p.subtextSize || 15)}px;line-height:1.6;margin:0;color:${esc(subtextColor)};">${rich(p.subtext)}</div></td></tr>`
        : "";
      const buttonRowHtml = String(p.buttonText || "").trim()
        ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0;text-align:${contentAlign};font-size:0;line-height:0;">${buttonHtml(contentAlign)}</td></tr>`
        : "";
      const flowTableHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;height:${stageHeight}px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td valign="middle" style="padding:${stagePadding}px;background:${esc(imageTextBgImage ? (p.overlayShade || "rgba(15,23,42,0.45)") : msoOverlayColor)};vertical-align:middle;">
      <table role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0" align="${tableAlignAttr(contentAlign)}" style="width:${contentWidth}px;max-width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr><td height="${topSpacer}" style="height:${topSpacer}px;font-size:0;line-height:0;">&nbsp;</td></tr>
        ${overlayImageHtml}
        ${headlineHtml}
        ${subtextHtml}
        ${buttonRowHtml}
      </table>
    </td>
  </tr>
</table>`;
      return renderEmailBackgroundTable({
        width: W,
        bgColor: imageTextBgImage ? (p.bgColor || "#334155") : msoOverlayColor,
        bgImageSrc: imageTextBgImage,
        bgRepeat: "no-repeat",
        borderRadius: 12,
        fixedHeightPx: stageHeight,
        msoInset: "0,0,0,0",
        tdStyle: `padding:0;background-color:${esc(imageTextBgImage ? "transparent" : msoOverlayColor)};color:${esc(p.textColor || "#ffffff")};font-family:Arial,Helvetica,sans-serif;`,
        innerHtml: flowTableHtml,
      });
    }

    case "quote": {
      const quoteTextColor = ensureReadableColor(p.textColor || "#0f172a", p.bgColor || "#eff6ff", "#ffffff", "#0f172a");
      const avatar = p.avatarSrc
        ? `<img src="${esc(p.avatarSrc)}" alt="${esc(p.author)}" width="68" height="68" style="width:68px;height:68px;border-radius:999px;display:block;margin:0 auto 12px;object-fit:cover;" />`
        : "";
      return wrapEmailBlockTable(
        `<tr><td style="padding:24px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:${esc(quoteTextColor)};background-color:${esc(p.bgColor)};border-radius:12px;overflow:hidden;">${avatar}
  <div style="font-size:22px;line-height:1.5;font-style:italic;margin-bottom:12px;">“${rich(p.quote)}”</div>
  <div style="font-size:15px;font-weight:700;">${rich(p.author)}</div>
  <div style="font-size:13px;opacity:0.8;">${rich(p.role)}</div>
</td></tr>`,
        W
      );
    }

    case "promo": {
      const promoTextColor = ensureReadableColor(p.textColor || "#ffffff", p.bgColor || "#111827", "#ffffff", "#0f172a");
      const promoAccentTextColor = ensureReadableColor("#111827", p.accentColor || "#f59e0b", "#ffffff", "#111827");
      return wrapEmailBlockTable(
        `<tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:${esc(promoTextColor)};text-align:center;background-color:${esc(p.bgColor)};border-radius:14px;overflow:hidden;">
  <div style="display:inline-block;background:${esc(p.accentColor)};color:${esc(promoAccentTextColor)};font-size:12px;font-weight:800;padding:6px 10px;border-radius:999px;margin-bottom:12px;">${rich(p.badge)}</div>
  <div style="font-size:28px;font-weight:800;line-height:1.2;margin-bottom:8px;">${rich(p.headline)}</div>
  <div style="font-size:15px;line-height:1.6;opacity:0.9;margin-bottom:14px;">${rich(p.details)}</div>
  <div style="display:inline-block;border:2px dashed ${esc(p.accentColor)};padding:10px 16px;border-radius:10px;font-size:22px;font-weight:800;letter-spacing:0.08em;margin-bottom:16px;">${rich(p.code)}</div><br/>
  <a href="${esc(p.href)}" style="display:inline-block;padding:12px 24px;background:${esc(p.accentColor)};color:${esc(promoAccentTextColor)};text-decoration:none;border-radius:999px;font-size:15px;font-weight:700;">${rich(p.buttonText)}</a>
</td></tr>`,
        W
      );
    }

    case "video": {
      const videoTextColor = ensureReadableColor(p.textColor || "#ffffff", p.bgColor || "#0f172a", "#ffffff", "#0f172a");
      const videoThumbWidth = Math.max(120, W - 40);
      const thumb = p.thumbnailSrc
        ? `<a href="${esc(p.href)}" style="display:block;text-decoration:none;margin-bottom:14px;"><img src="${esc(p.thumbnailSrc)}" alt="${esc(p.title)}" width="${videoThumbWidth}" style="width:${videoThumbWidth}px;max-width:100%;height:auto;display:block;border-radius:12px;" /></a>`
        : "";
      return wrapEmailBlockTable(
        `<tr><td style="padding:20px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:${esc(videoTextColor)};background-color:${esc(p.bgColor)};border-radius:12px;overflow:hidden;">${thumb}
  <div style="font-size:24px;font-weight:700;line-height:1.3;margin-bottom:8px;">${rich(p.title)}</div>
  <div style="font-size:14px;line-height:1.6;opacity:0.9;margin-bottom:16px;">${rich(p.caption)}</div>
  <a href="${esc(p.href)}" style="display:inline-block;padding:11px 22px;background:#ef4444;color:#ffffff;text-decoration:none;border-radius:999px;font-size:15px;font-weight:700;">▶ ${rich(p.buttonText)}</a>
</td></tr>`,
        W
      );
    }

    case "contact": {
      const contactTextColor = ensureReadableColor(p.textColor || "#0f172a", p.bgColor || "#f8fafc", "#ffffff", "#0f172a");
      return wrapEmailBlockTable(
        `<tr><td style="padding:22px 24px;font-family:Arial,Helvetica,sans-serif;color:${esc(contactTextColor)};background-color:${esc(p.bgColor)};border-radius:12px;overflow:hidden;">
  <div style="font-size:22px;font-weight:800;margin-bottom:8px;">${rich(p.heading)}</div>
  <div style="font-size:16px;font-weight:700;margin-bottom:2px;">${rich(p.name)}</div>
  <div style="font-size:13px;opacity:0.8;margin-bottom:12px;">${rich(p.role)}</div>
  <div style="font-size:14px;line-height:1.8;">📧 ${rich(p.email)}<br/>📞 ${rich(p.phone)}<br/>📍 ${rich(p.address)}</div>
  <div style="margin-top:16px;"><a href="${esc(p.href)}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:700;">${rich(p.buttonText)}</a></div>
</td></tr>`,
        W
      );
    }

    case "social": {
      const icons = (p.platforms || []).map(pl => {
        const iconUrl = getSocialIconExportUrl(pl.name);
        if (isEmailRenderableUrl(iconUrl)) {
          return `<td style="padding:0 10px;" valign="middle"><a href="${esc(pl.href)}" target="_blank" rel="noopener" aria-label="${esc(pl.name)}" style="display:inline-block;text-decoration:none;"><img src="${esc(iconUrl)}" alt="${esc(pl.name)}" width="${SOCIAL_ICON_SIZE}" height="${SOCIAL_ICON_SIZE}" style="width:${SOCIAL_ICON_SIZE}px;height:${SOCIAL_ICON_SIZE}px;display:block;border:0;outline:none;text-decoration:none;" /></a></td>`;
        }
        const badge = getSocialBadge(pl.name);
        return `<td style="padding:0 10px;" valign="middle"><a href="${esc(pl.href)}" target="_blank" rel="noopener" aria-label="${esc(pl.name)}" style="display:inline-block;width:${SOCIAL_ICON_SIZE}px;height:${SOCIAL_ICON_SIZE}px;line-height:${SOCIAL_ICON_SIZE}px;text-align:center;text-decoration:none;border-radius:${Math.round(SOCIAL_ICON_SIZE / 2)}px;background:${esc(badge.bg)};color:${esc(badge.color)};font-family:Arial,Helvetica,sans-serif;font-size:${Math.max(14, Number(badge.fontSize || 14))}px;font-weight:700;overflow:hidden;">${esc(badge.label)}</a></td>`;
      });
      return wrapEmailBlockTable(
        `<tr><td style="padding:20px;text-align:center;background-color:${esc(p.bgColor)};border-radius:10px;overflow:hidden;">
  <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>${icons.join("")}</tr></table>
</td></tr>`,
        W
      );
    }

    case "footer":
      const footerTextColor = ensureReadableColor(p.textColor || "#64748b", p.bgColor || "#f1f5f9", "#ffffff", "#0f172a");
      const footerCompanyHtml = withDefaultAnchorStyles(rich(p.company), { color: footerTextColor, textDecoration: "underline" });
      const footerAddressHtml = withDefaultAnchorStyles(rich(p.address), { color: footerTextColor, textDecoration: "underline" });
      const footerLegalSource = String(p.unsubscribeText || "Unsubscribe");
      const footerLegalHtml = /<a\b/i.test(footerLegalSource)
        ? withDefaultAnchorStyles(footerLegalSource, { color: footerTextColor, textDecoration: "underline" })
        : `<a href="${esc(p.unsubscribeHref)}" style="color:${esc(footerTextColor)};text-decoration:underline;font-size:11px;">${rich(footerLegalSource)}</a>`;
      return wrapEmailBlockTable(
        `<tr><td style="padding:20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${esc(footerTextColor)};background-color:${esc(p.bgColor)};border-radius:8px;overflow:hidden;">
  <p style="margin:0 0 6px;">&copy; ${new Date().getFullYear()} ${footerCompanyHtml}</p>
  <p style="margin:0 0 8px;">${footerAddressHtml}</p>
  <div style="font-size:11px;line-height:1.6;">${footerLegalHtml}</div>
</td></tr>`,
        W
      );

    default:
      return "";
  }
}

export function exportFullHtml(blocks, name = "Email", emailSettings = {}) {
  const settings = normalizeEmailSettings(emailSettings);
  const pageBgColor = esc(settings.outerBgColor);
  const pageBgImage = esc(settings.outerBgImageSrc || "");
  const effectiveCanvasBgColor = settings.outerBgImageSrc && String(settings.canvasBgColor || "").toLowerCase() === "#ffffff"
    ? "transparent"
    : settings.canvasBgColor;
  const bodyBgStyle = settings.outerBgImageSrc
    ? `background-color:${pageBgColor};background-image:url(${pageBgImage});background-position:center top;background-size:${settings.outerBgRepeat === "no-repeat" ? "cover" : "auto"};background-repeat:${esc(settings.outerBgRepeat || "no-repeat")};`
    : `background-color:${pageBgColor};`;
  const preheader = esc(settings.preheaderText || "");
  const exportedBlocks = renderBlockRowsForExport(
    collapseBlocksForExport(stripEmailMetaBlocks(blocks)),
    settings.canvasWidth
  );
  const msoBackground = settings.outerBgImageSrc
    ? `<!--[if gte mso 9]>
<xml>
  <o:OfficeDocumentSettings>
    <o:AllowPNG/>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
</xml>
<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
  <v:fill ${settings.outerBgRepeat === "no-repeat" ? 'type="frame" aspect="atleast" focusposition="0.5,0.5"' : 'type="tile"'} src="${pageBgImage}" color="${pageBgColor}" />
</v:background>
<![endif]-->`
    : "<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(name)}</title>
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
${msoBackground}
</head>
<body bgcolor="${pageBgColor}" style="margin:0;padding:0;${bodyBgStyle}font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${pageBgColor}" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;${bodyBgStyle}">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso]>
<table role="presentation" width="${settings.canvasWidth}" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${esc(effectiveCanvasBgColor)}" style="width:${settings.canvasWidth}px;background-color:${esc(effectiveCanvasBgColor)};border-collapse:separate;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;border-radius:${settings.canvasRadius}px;"><tr><td style="padding:0;">
<![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${esc(effectiveCanvasBgColor)}" style="width:100%;max-width:${settings.canvasWidth}px;background-color:${esc(effectiveCanvasBgColor)};border-collapse:separate;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;border-radius:${settings.canvasRadius}px;">
<tr><td style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
${exportedBlocks}
</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
