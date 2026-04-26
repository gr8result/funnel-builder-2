export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

const UPSTREAM_BASE = process.env.VISUAL_BUILDER_INTERNAL_URL || "http://127.0.0.1:8069";
const PROXY_PREFIX = "/api/website-builder/visual-host";
const SESSION_COOKIE_NAME = "gr8_builder_session";
const EDITOR_DESTINATION = "/modules/website-builder/visual-builder";

function getPathParts(pathValue) {
  return Array.isArray(pathValue) ? pathValue : pathValue ? [pathValue] : [];
}

function buildUpstreamUrl(pathValue, query = {}) {
  const parts = getPathParts(pathValue);
  let pathname = `/${parts.map((part) => {
    const value = String(part);
    return value === "@" ? "@" : encodeURIComponent(value);
  }).join("/")}` || "/";
  if (parts.length === 1 && String(parts[0]) === "@") pathname = "/@/";
  const url = new URL(`${UPSTREAM_BASE}${pathname}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (key === "path") return;
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
    else if (value != null) url.searchParams.set(key, String(value));
  });
  return url;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    String(cookieHeader || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const idx = item.indexOf("=");
        return idx === -1 ? [item, ""] : [item.slice(0, idx), item.slice(idx + 1)];
      })
  );
}

function getBuilderSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || "";
}

function isLoginPath(pathValue) {
  const parts = getPathParts(pathValue).map((part) => String(part || "").toLowerCase());
  return parts[0] === "web" && parts[1] === "login";
}

function rewriteProxyPaths(value = "") {
  return String(value || "")
    .replace(new RegExp(`${UPSTREAM_BASE.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}/`, "gi"), `${PROXY_PREFIX}/`)
    .replace(/\b(href|src|action|data-src|content)=(["'])\/(?!\/|api\/website-builder\/visual-host)/gi, `$1=$2${PROXY_PREFIX}/`)
    .replace(/url\((['"]?)\/(?!\/|api\/website-builder\/visual-host)/gi, `url($1${PROXY_PREFIX}/`);
}

function sanitizeHtml(html = "") {
  let output = String(html || "");
  output = output.replace(/<div class="o_brand_promotion">[\s\S]*?<\/div>/gi, "");
  output = output.replace(/https?:\/\/www\.odoo\.com[^"'\s<]*/gi, "#");
  output = output.replace(/<title>.*?<\/title>/i, "<title>GR8 Visual Block Builder</title>");
  output = output.replace(/Powered by\s*Odoo/gi, "");
  output = output.replace(/<link[^>]+rel=["']manifest["'][^>]*>/gi, "");
  output = output.replace(/"websocket_worker_version"\s*:\s*"[^"]*"/gi, '"websocket_worker_version": null');
  output = output.replace(/"odoobot_initialized"\s*:\s*true/gi, '"odoobot_initialized": false');
  output = rewriteProxyPaths(output);
  if (!/<base\s/i.test(output)) {
    output = output.replace(/<head([^>]*)>/i, `<head$1><meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate" /><meta http-equiv="Pragma" content="no-cache" /><base href="${PROXY_PREFIX}/" /><style>
      #top, header#top, footer#bottom, .o_footer_copyright, .o_brand_promotion { display:none !important; }
      #wrapwrap, main, #wrap { min-height: 100vh !important; background: #fff !important; }
      #wrap { padding-top: 24px !important; }
    </style><script>(function(){if(typeof window!=='undefined'){window.__gr8DisableRealtime=true;if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then((regs)=>regs.forEach((reg)=>reg.unregister())).catch(()=>{});}const hideNoise=()=>{document.querySelectorAll('[role="alert"], .o_notification, .toast').forEach((el)=>{const text=(el.textContent||'').toLowerCase();if(text.includes('connection lost')||text.includes('trying to reconnect')||text.includes('reconnected')) el.remove();});};setInterval(hideNoise,600);}})();</script>`);
  }
  return output;
}

function rewriteLocation(value = "") {
  const url = String(value || "");
  if (!url) return url;
  if (url.startsWith("/")) return url;
  if (url.startsWith(UPSTREAM_BASE)) return url.replace(UPSTREAM_BASE, "");
  return url;
}

async function createSession() {
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      db: process.env.VISUAL_BUILDER_DB || "sitebuilder",
      login: process.env.VISUAL_BUILDER_LOGIN || "admin",
      password: process.env.VISUAL_BUILDER_PASSWORD || "admin",
    },
  };

  const response = await fetch(`${UPSTREAM_BASE}/web/session/authenticate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
    redirect: "manual",
  });

  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/session_id=([^;]+)/i);
  return match?.[1] || "";
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  return res.status(410).json({
    ok: false,
    disabled: true,
    message: "Legacy Odoo visual-host route is disabled. Use the standalone GR8 visual builder.",
  });

  let sessionId = getBuilderSession(req);
  if (!sessionId) {
    try {
      sessionId = await createSession();
      if (sessionId) {
        res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
      }
    } catch {
      // keep going; fallback response will reveal if auth is unavailable
    }
  }

  const upstreamUrl = buildUpstreamUrl(req.query.path, req.query);
  const rawBody = ["GET", "HEAD"].includes(req.method || "GET") ? undefined : await readRawBody(req);

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers: {
      cookie: sessionId ? `session_id=${sessionId}` : "",
      accept: req.headers.accept || "*/*",
      "content-type": req.headers["content-type"] || "",
      "user-agent": req.headers["user-agent"] || "GR8-Visual-Builder",
    },
    body: rawBody,
    redirect: "manual",
  });

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (["content-length", "content-encoding", "transfer-encoding", "connection", "set-cookie", "x-frame-options", "content-security-policy"].includes(lower)) return;
    if (lower === "location") {
      res.setHeader(key, rewriteLocation(value));
      return;
    }
    res.setHeader(key, value);
  });
  res.setHeader("x-frame-options", "SAMEORIGIN");

  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = await upstream.text();
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
    res.send(sanitizeHtml(html));
    return;
  }

  if (contentType.startsWith("text/") || contentType.includes("javascript") || contentType.includes("json")) {
    const text = await upstream.text();
    res.send(rewriteProxyPaths(text.replace(/https?:\/\/www\.odoo\.com/gi, "#")));
    return;
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.send(buffer);
}
