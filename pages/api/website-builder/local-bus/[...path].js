export default function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path || "");

  res.setHeader("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("x-frame-options", "SAMEORIGIN");

  if (path.includes("websocket_worker_bundle")) {
    res.setHeader("content-type", "application/javascript; charset=utf-8");
    return res.status(200).send("window.__gr8DisableRealtime=true;window.__WOWL_DEBUG__=false;");
  }

  if ((req.method || "GET").toUpperCase() === "POST") {
    return res.status(200).json({ jsonrpc: "2.0", id: null, result: [] });
  }

  return res.status(200).json({ ok: true, disabled: true });
}
