import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthGate from "../../../components/AuthGate";
import { useApiFetch, useWorkspace } from "../../../hooks/useWorkspace";
import LandingPageRenderer from "../../../components/landing-pages/renderer/LandingPageRenderer";
import { fontHref } from "../../../components/landing-pages/renderer/styles";

export default function FunnelTemplates() {
  return <AuthGate><TemplateCatalogue /></AuthGate>;
}

function TemplateCatalogue() {
  const router = useRouter();
  const apiFetch = useApiFetch();
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState(null);
  const [previewStep, setPreviewStep] = useState(0);
  const [viewport, setViewport] = useState("desktop");
  const [copyName, setCopyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState("");
  const [brokenThumbnails, setBrokenThumbnails] = useState([]);
  const cloneRequestRef = useRef(null);
  useEffect(() => { cloneRequestRef.current = null; }, [workspaceId, selectedId]);

  useEffect(() => {
    if (workspaceLoading || !workspaceId) return undefined;
    let active = true;
    setLoading(true);
    apiFetch("/api/funnels/templates")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load master templates");
        if (active) setTemplates(body.templates || []);
      })
      .catch((cause) => { if (active) setError(cause.message || "Could not load master templates"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiFetch, workspaceId, workspaceLoading]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return undefined;
    }
    let active = true;
    setLoadingPreview(true);
    setError("");
    apiFetch(`/api/funnels/templates?id=${encodeURIComponent(selectedId)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load this template preview");
        if (active) {
          setSelected(body.template);
          setPreviewStep(0);
          setCopyName(`${body.template.name} copy`);
        }
      })
      .catch((cause) => { if (active) setError(cause.message || "Could not load this template preview"); })
      .finally(() => { if (active) setLoadingPreview(false); });
    return () => { active = false; };
  }, [apiFetch, selectedId]);

  const currentStep = selected?.steps?.[previewStep] || selected?.steps?.[0] || null;
  const previewDocument = useMemo(() => {
    if (!currentStep) return "";
    const content = currentStep.document
      ? renderToStaticMarkup(<LandingPageRenderer doc={currentStep.document} runtime={{ mode: "preview" }} />)
      : currentStep.content || "";
    const fonts = currentStep.document ? `<link rel="stylesheet" href="${fontHref(currentStep.document.theme)}">` : "";
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${fonts}<style>html,body{margin:0;padding:0;min-height:100%;}body{overflow-x:hidden;}img{max-width:100%;height:auto;}</style></head><body>${content}</body></html>`;
  }, [currentStep]);

  async function createCopy() {
    if (!selected || cloning) return;
    setCloning(true);
    setError("");
    try {
      if (selected.kind === "campaign" && !cloneRequestRef.current) cloneRequestRef.current = crypto.randomUUID();
      const response = await apiFetch("/api/funnels/templates", {
        method: "POST",
        body: JSON.stringify({ action: "clone", templateId: selected.id, name: copyName, requestId: cloneRequestRef.current }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create a copy");
      if (body?.campaign?.id && body.pageIds?.[0]) await router.push(`/modules/landing-pages/editor/${body.pageIds[0]}`);
      else if (body?.funnel?.id) await router.push(`/modules/funnels/edit/${body.funnel.id}`);
      else throw new Error("The template copy did not return an editor address");
    } catch (cause) {
      setError(cause.message || "Could not create a copy");
      setCloning(false);
    }
  }

  return (
    <>
      <Head><title>GR8 Result Master Templates | Funnel Builder</title></Head>
      <main style={{ minHeight: "100vh", padding: "28px 20px", background: "#0c121a", color: "#e6eef5", fontFamily: "system-ui,-apple-system,sans-serif" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 36 }}>GR8 Result Master Templates</h1>
              <p style={{ color: "#94a3b8" }}>Preview a professionally designed funnel, then create an independent copy in your workspace.</p>
            </div>
            <Link href="/modules/funnels" style={{ color: "#bfdbfe" }}>Back to Funnel Builder</Link>
          </div>

          {error ? <div role="alert" style={{ padding: 14, margin: "16px 0", border: "1px solid #ef4444", borderRadius: 10, background: "#35151b", color: "#fecaca" }}>{error}</div> : null}
          {loading ? <p role="status">Loading templates…</p> : null}
          {!loading && templates.length === 0 ? <p>No master templates are available yet.</p> : null}

          <section aria-label="Master template catalogue" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginTop: 20 }}>
            {templates.map((template) => {
              const thumbnailFailed = brokenThumbnails.includes(template.id);
              return (
                <button key={template.id} type="button" onClick={() => setSelectedId(template.id)} aria-pressed={selectedId === template.id}
                  style={{ textAlign: "left", padding: 0, overflow: "hidden", borderRadius: 14, color: "inherit", cursor: "pointer", border: selectedId === template.id ? "2px solid #60a5fa" : "1px solid #334155", background: "#111827" }}>
                  {template.thumbnail && !thumbnailFailed
                    ? <img src={template.thumbnail} alt="" onError={() => setBrokenThumbnails((old) => old.includes(template.id) ? old : [...old, template.id])} style={{ display: "block", width: "100%", height: 160, objectFit: "cover", background: "#1e293b" }} />
                    : <div aria-hidden="true" style={{ height: 160, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#12344a,#243c65)", color: "#bfdbfe", fontSize: 28 }}>GR8 RESULT</div>}
                  <div style={{ padding: 16 }}>
                    <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>{template.name}</h2>
                    <p style={{ minHeight: 44, margin: "0 0 12px", color: "#cbd5e1", lineHeight: 1.45 }}>{template.description || "A ready-to-edit GR8 Result funnel template."}</p>
                    <span style={{ color: "#93c5fd" }}>{template.stepCount} page{template.stepCount === 1 ? "" : "s"} · Preview</span>
                  </div>
                </button>
              );
            })}
          </section>

          {selectedId ? (
            <section aria-label="Template preview" style={{ marginTop: 28, padding: 18, border: "1px solid #334155", borderRadius: 14, background: "#111827" }}>
              {loadingPreview ? <p role="status">Loading preview…</p> : selected ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <h2 style={{ margin: 0 }}>{selected.name}</h2>
                      <p style={{ color: "#cbd5e1" }}>{selected.description || "A ready-to-edit GR8 Result funnel template."}</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {selected.steps.map((step, index) => <button key={`${step.order_index}-${step.title}`} type="button" onClick={() => setPreviewStep(index)} aria-pressed={previewStep === index} style={{ padding: "8px 12px", borderRadius: 8, color: "#fff", border: "1px solid #475569", background: previewStep === index ? "#1d4ed8" : "#1e293b" }}>{step.title}</button>)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => setViewport("desktop")} aria-pressed={viewport === "desktop"}>Desktop</button>
                      <button type="button" onClick={() => setViewport("mobile")} aria-pressed={viewport === "mobile"}>Mobile</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: viewport === "mobile" ? "center" : "stretch", marginTop: 16, padding: 12, background: "#020617", borderRadius: 10, overflow: "auto" }}>
                    {previewDocument ? <iframe title={`${selected.name} ${currentStep?.title || "preview"}`} sandbox="" srcDoc={previewDocument} style={{ display: "block", width: viewport === "mobile" ? 390 : "100%", maxWidth: "100%", height: 560, border: "1px solid #475569", borderRadius: 6, background: "#fff" }} /> : <p>No page preview is available.</p>}
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginTop: 16 }}>
                    <label style={{ display: "grid", gap: 6, flex: "1 1 280px" }}>Name for your copy
                      <input value={copyName} onChange={(event) => setCopyName(event.target.value)} maxLength={160} style={{ padding: 10, borderRadius: 8 }} />
                    </label>
                    <button type="button" onClick={createCopy} disabled={cloning || !copyName.trim()} style={{ padding: "12px 18px", color: "#fff", border: 0, borderRadius: 8, background: cloning ? "#475569" : "#2563eb", cursor: cloning ? "wait" : "pointer" }}>
                      {cloning ? "Creating copy…" : "Create from Template"}
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}
