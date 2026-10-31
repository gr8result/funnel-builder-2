// TEMPORARY navigation diagnostics (TEMP-NAVDIAG). Paths only: no queries, tokens or customer data.
// Capture: in DevTools console run  copy(sessionStorage["gr8:navlog"])  and paste the result.
const KEY = "gr8:navlog";
const MAX = 600;

export function installNavDiagnostics(router) {
  if (typeof window === "undefined" || window.__navDiagInstalled) return;
  window.__navDiagInstalled = true;

  let log = [];
  try { log = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { log = []; }
  const t0 = Date.now();
  const strip = (u) => String(u || "").split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(log.slice(-MAX))); } catch { /* ignore */ } };
  const add = (type, detail) => {
    log.push({ ts: new Date().toISOString().slice(11, 23), type, ...detail });
    if (log.length > MAX) log.shift();
    save();
  };
  const caller = () => String(new Error().stack || "").split("\n").slice(3, 8)
    .map((l) => l.trim().replace(/\(?https?:\/\/[^/]+/, "(").replace(/webpack-internal:\/\/\/\([^)]*\)\/\.\//, "").slice(0, 120)).join(" | ");

  window.__navLog = log;
  window.__navDiag = { add };
  add("pageload", { at: location.pathname, navType: performance.getEntriesByType("navigation")[0]?.type, sinceStartMs: Date.now() - t0 });

  for (const m of ["pushState", "replaceState"]) {
    const orig = window.history[m];
    window.history[m] = function (state, title, url) {
      add(`history.${m}`, { from: location.pathname, to: strip(url), by: caller() });
      return orig.apply(this, arguments);
    };
  }
  window.addEventListener("popstate", () => add("popstate", { at: location.pathname }));
  window.addEventListener("pagehide", () => add("pagehide(hard-nav/refresh)", { at: location.pathname }));
  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a[href]");
    if (a) add("click", { href: strip(a.getAttribute("href")), at: location.pathname, text: String(a.textContent || "").trim().slice(0, 30), defaultPrevented: e.defaultPrevented });
  }, true);
  window.navigation?.addEventListener?.("navigate", (e) =>
    add("navigation.navigate", { to: strip(e.destination?.url), at: location.pathname, kind: e.navigationType, userInitiated: e.userInitiated }));
  for (const ev of ["routeChangeStart", "routeChangeComplete", "routeChangeError", "beforeHistoryChange"]) {
    router.events.on(ev, (url, info) => add(ev, { url: strip(url), at: location.pathname, shallow: info?.shallow }));
  }
}
