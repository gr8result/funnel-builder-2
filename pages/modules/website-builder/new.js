import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { TEMPLATES, getTemplate } from "../../../lib/website-builder/templates";
import { openSelfHostedBuilder } from "../../../lib/website-builder/launchSelfHostedBuilder";
import { useAuth } from "../../../context/AuthContext";
import VoiceInput from "../../../components/VoiceInput";

const modeMeta = {
  ai: {
    title: "AI Guided Build",
    subtitle: "Answer a few prompts, then generate your site plan and starter copy.",
    accent: "#00d4ff",
    icon: "✨",
    gradient: "linear-gradient(135deg, rgba(0,212,255,0.30) 0%, #173459 45%, #0f2e2b 100%)",
  },
  blank: {
    title: "Blank Canvas",
    subtitle: "Start clean and add only the pages and sections you need.",
    accent: "#ffc857",
    icon: "🧱",
    gradient: "linear-gradient(135deg, rgba(255,200,87,0.30) 0%, #3a2a11 45%, #1f2a33 100%)",
  },
  import: {
    title: "Theme Import",
    subtitle: "Choose a starter template or import from an external page URL (including many WordPress front pages).",
    accent: "#7df9a1",
    icon: "🎨",
    gradient: "linear-gradient(135deg, rgba(125,249,161,0.30) 0%, #143825 45%, #143056 100%)",
  },
};

function safeMode(mode) {
  const m = String(mode || "ai").toLowerCase();
  if (m === "ai" || m === "blank" || m === "import") return m;
  return "ai";
}

function safeBuildType(value) {
  const v = String(value || "website").toLowerCase();
  return v === "landing" ? "landing" : "website";
}

function normalizePageName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function inferBusinessNameFromUser(user) {
  const meta = user?.user_metadata || {};
  const raw =
    meta.business_name ||
    meta.company_name ||
    meta.organization_name ||
    meta.org_name ||
    meta.brand_name ||
    meta.full_name ||
    meta.name ||
    "";

  if (String(raw || "").trim()) return String(raw).trim();

  const emailName = String(user?.email || "").split("@")[0] || "";
  return emailName.replace(/[._-]+/g, " ").trim();
}

function makePlan(form, buildType = "website") {
  const pages = buildType === "landing" ? ["Landing"] : ["Home", "About", "Contact"];
  const goalText = String(form.goal || "").toLowerCase();

  if (buildType !== "landing") {
    if (goalText.includes("lead") || goalText.includes("book") || goalText.includes("call")) {
      pages.splice(1, 0, "Services", "Book Call", "Testimonials");
    } else if (goalText.includes("sell") || goalText.includes("checkout") || goalText.includes("product")) {
      pages.splice(1, 0, "Products", "Pricing", "FAQ");
    } else {
      pages.splice(1, 0, "Services", "Case Studies");
    }
  }

  const uniquePages = [...new Set(pages)];
  const chosenTemplate = TEMPLATES.find((t) => {
    const n = String(t.name || "").toLowerCase();
    return (goalText.includes("lead") && n.includes("lead")) || (goalText.includes("sell") && n.includes("sales"));
  }) || TEMPLATES[0];

  return {
    headline: `${form.businessName || "Your Brand"} Website Plan`,
    strap: `Built for ${form.targetAudience || "your audience"} to ${form.goal || "drive conversions"}`,
    templateSlug: chosenTemplate?.slug || "",
    pagePlan: uniquePages.map((p, idx) => ({
      name: p,
      objective:
        idx === 0
          ? "Establish trust and present the core offer"
          : p === "Contact" || p === "Book Call"
            ? "Capture qualified inquiries"
            : "Move visitors toward action",
    })),
    copyAngles: [
      `Primary offer: ${form.offer || "Your core service"}`,
      `Voice direction: ${form.notes ? "Use founder story + proof" : "Clear, confidence-first"}`,
      "CTA language: action-first with specific outcomes",
    ],
  };
}

// Defensive utility to normalize pagePlan
function normalizePagePlan(plan) {
  if (Array.isArray(plan)) return plan;
  if (typeof plan === "string") {
    // Split on comma or newlines, trim, remove empties
    return plan.split(/,|\n/).map((p) => {
      if (typeof p === "string") return { name: p.trim(), objective: "Move visitors toward action" };
      return p;
    }).filter((p) => p && p.name && p.name.length > 0);
  }
  return [];
}

export default function WebsiteBuilderNewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const mode = safeMode(router.query.mode);
  const buildType = safeBuildType(router.query.type);
  const meta = modeMeta[mode];
  const [isMobile, setIsMobile] = useState(false);

  
  const [form, setForm] = useState({
    businessName: "",
    offer: "",
    targetAudience: "",
    goal: "",
    notes: "",
  });
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [newPageName, setNewPageName] = useState("");
  const [aiDescBusy, setAiDescBusy] = useState(false);
  const [aiDescError, setAiDescError] = useState("");
  const [aiObjBusy, setAiObjBusy] = useState(false);
  const [aiObjError, setAiObjError] = useState("");
  const [aiPlanBusy, setAiPlanBusy] = useState(false);
  const [aiPlanError, setAiPlanError] = useState("");
  const [blankRedirecting, setBlankRedirecting] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const projectStylePack = "executive";
  const [importCrawl, setImportCrawl] = useState(true);
  const [importMaxPages, setImportMaxPages] = useState(4);
  const [launchBusy, setLaunchBusy] = useState(false);

  const inferredBusinessName = useMemo(() => inferBusinessNameFromUser(user), [user]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncViewport = () => setIsMobile(window.innerWidth <= 720);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!inferredBusinessName) return;
    setForm((prev) => (prev.businessName ? prev : { ...prev, businessName: inferredBusinessName }));
  }, [inferredBusinessName]);

  const picks = useMemo(() => {
    if (mode === "import") return TEMPLATES.slice(0, 6);
    if (mode === "blank") return [];
    return TEMPLATES.slice(0, 3);
  }, [mode]);

  function addCustomPage() {
    if (buildType === "landing") return;
    const clean = normalizePageName(newPageName);
    if (!clean) return;

    setGeneratedPlan((prev) => {
      const basePlan = prev || makePlan(form, buildType);
      const exists = basePlan.pagePlan.some((p) => p.name.toLowerCase() === clean.toLowerCase());
      if (exists) return basePlan;

      return {
        ...basePlan,
        pagePlan: [
          ...basePlan.pagePlan,
          {
            name: clean,
            objective: "Move visitors toward action",
          },
        ],
      };
    });
    setNewPageName("");
  }

  function removeCustomPage(pageName) {
    setGeneratedPlan((prev) => {
      if (!prev) return prev;
      if (["Home", "About", "Contact"].includes(pageName)) return prev;
      return {
        ...prev,
        pagePlan: prev.pagePlan.filter((p) => p.name !== pageName),
      };
    });
  }

  async function openProject(projectInput) {
    setLaunchBusy(true);

    try {
      await openSelfHostedBuilder({
        name: projectInput?.name || `${form.businessName || "GR8"} Website`,
        mode: projectInput?.mode || mode,
        buildType: projectInput?.buildType || buildType,
        stylePack: projectInput?.stylePack || projectStylePack,
        templateSlug: String(projectInput?.templateSlug || generatedPlan?.templateSlug || router.query.template || "").trim(),
        brief: projectInput?.brief || { ...form, stylePack: projectStylePack, importStylePack: projectStylePack },
        pages: projectInput?.pages || normalizePagePlan(generatedPlan?.pagePlan),
        copyAngles: projectInput?.copyAngles || generatedPlan?.copyAngles || [],
        tab: projectInput?.tab || "builder",
      });
    } finally {
      setLaunchBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== "blank") return;
    if (typeof window === "undefined") return;

    const lockKey = "gr8:website-builder:blank-auto-open";
    const lastRun = Number(window.sessionStorage.getItem(lockKey) || 0);
    if (Date.now() - lastRun < 2500) return;
    window.sessionStorage.setItem(lockKey, String(Date.now()));

    setBlankRedirecting(true);
    openProject({
      name: `${form.businessName || "Starter"} Website`,
      mode: "blank",
      stylePack: projectStylePack,
      brief: { ...form, stylePack: projectStylePack },
      pages: [
        { name: "Home", objective: "Start with a completely blank page and build from scratch." },
      ],
      copyAngles: [],
    });
  }, [mode]);

  async function generateDescription() {
    setAiDescBusy(true);
    setAiDescError("");
    try {
      const res = await fetch("/api/website/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setAiDescError(json?.error || "Could not generate description");
        return;
      }
      setForm((prev) => ({ ...prev, notes: json.description || prev.notes }));
    } catch (e) {
      setAiDescError(e?.message || "Could not generate description");
    } finally {
      setAiDescBusy(false);
    }
  }

  async function generatePageObjectives() {
    if (!generatedPlan?.pagePlan?.length) return;
    setAiObjBusy(true);
    setAiObjError("");
    try {
      const res = await fetch("/api/website/generate-page-objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pages: generatedPlan.pagePlan.map((p) => p.name),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok || !Array.isArray(json?.objectives)) {
        setAiObjError(json?.error || "Could not generate page objectives");
        return;
      }

      const objectiveMap = new Map(
        json.objectives.map((item) => [String(item.name || "").toLowerCase(), String(item.objective || "")])
      );

      setGeneratedPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pagePlan: prev.pagePlan.map((p) => ({
            ...p,
            objective: objectiveMap.get(String(p.name || "").toLowerCase()) || p.objective,
          })),
        };
      });
    } catch (e) {
      setAiObjError(e?.message || "Could not generate page objectives");
    } finally {
      setAiObjBusy(false);
    }
  }

  async function generateSitePlan() {
    setAiPlanBusy(true);
    setAiPlanError("");
    try {
      const res = await fetch("/api/website/generate-site-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, buildType }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok || !json?.plan) {
        setAiPlanError(json?.error || "Could not generate AI site plan");
        setGeneratedPlan(makePlan(form, buildType));
        return;
      }
      setGeneratedPlan(json.plan);
    } catch (e) {
      setAiPlanError(e?.message || "Could not generate AI site plan");
      setGeneratedPlan(makePlan(form, buildType));
    } finally {
      setAiPlanBusy(false);
    }
  }

  async function importFromExternalUrl() {
    const url = String(importUrl || "").trim();
    if (!url) {
      setImportError("Enter a URL to import from.");
      return;
    }

    setImportBusy(true);
    setImportError("");

    try {
      const res = await fetch("/api/website/import-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          projectName: form.businessName || "Imported Website",
          stylePack: projectStylePack,
          crawl: importCrawl,
          maxPages: importMaxPages,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setImportError(json?.error || "Import failed.");
        return;
      }

      openProject({
        name: json.projectName || form.businessName || "Imported Website",
        mode: "import",
        templateSlug: "external-import",
        brief: {
          ...form,
          importUrl: url,
          stylePack: projectStylePack,
          importCrawl,
          importMaxPages,
        },
        pages: Array.isArray(json.pages) && json.pages.length
          ? json.pages
          : [{ name: "Home", objective: "Imported page" }],
        pageBlocks: json.pageBlocks || {},
        stylePack: projectStylePack,
        copyAngles: ["Imported from external page URL"],
      });
    } catch (e) {
      setImportError(e?.message || "Import failed.");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>{meta.title} | Website Builder</title>
      </Head>

      <main style={styles.page(isMobile)}>
        <div style={styles.container(isMobile)}>
          <section style={styles.banner(meta, isMobile)}>
            <div style={styles.bannerLeft(isMobile)}>
              <div style={styles.bannerIcon(meta, isMobile)} aria-hidden>{meta.icon}</div>
              <div>
                <h1 style={styles.title(isMobile)}>{meta.title}</h1>
                <p style={styles.subtitle(isMobile)}>{meta.subtitle}</p>
              </div>
            </div>
            <Link href="/modules/website-builder" style={styles.backBtn(isMobile)}>Back</Link>
          </section>

          {mode === "ai" && (
            <section style={styles.card(isMobile)}>
              <h2 style={styles.cardTitle}>AI Setup Questions</h2>
              <p style={styles.typeHint}>
                Building: <strong>{buildType === "landing" ? "Landing Page (Single Page)" : "Website (Multiple Pages)"}</strong>
              </p>

              <div style={styles.grid2(isMobile)}>
                <VoiceInput
                  label="Business Name"
                  placeholder={inferredBusinessName || "Your business name"}
                  value={form.businessName}
                  onChange={(v) => setForm((prev) => ({ ...prev, businessName: v }))}
                />
                <VoiceInput
                  label="Primary Offer"
                  placeholder="Your core offer or service"
                  value={form.offer}
                  onChange={(v) => setForm((prev) => ({ ...prev, offer: v }))}
                />
                <VoiceInput
                  label="Target Audience"
                  placeholder="Who you serve"
                  value={form.targetAudience}
                  onChange={(v) => setForm((prev) => ({ ...prev, targetAudience: v }))}
                />
                <VoiceInput
                  label="Main Goal"
                  placeholder="What this website should achieve"
                  value={form.goal}
                  onChange={(v) => setForm((prev) => ({ ...prev, goal: v }))}
                />
              </div>
              <VoiceInput
                textarea
                label="Brand Voice & Details"
                placeholder="Describe your brand voice, objections to handle, and what makes you different..."
                value={form.notes}
                onChange={(v) => setForm((prev) => ({ ...prev, notes: v }))}
                style={styles.textarea}
              />
              <div style={styles.subActions(isMobile)}>
                <button type="button" style={styles.aiGhostBtn} onClick={generateDescription} disabled={aiDescBusy}>
                  {aiDescBusy ? "Generating description..." : "AI Generate Description"}
                </button>
                {aiDescError ? <p style={styles.aiError}>{aiDescError}</p> : null}
              </div>
              <div style={styles.actions(isMobile)}>
                <button
                  type="button"
                  style={styles.primary(meta.accent, isMobile)}
                  onClick={generateSitePlan}
                >
                  {aiPlanBusy ? "Generating AI Site Plan..." : "Generate Site Plan"}
                </button>
                <Link href="/modules/website-builder/new?mode=blank" style={styles.secondary(isMobile)}>Start Blank Instead</Link>
              </div>
              {buildType !== "landing" ? (
                <>
                  <div style={styles.addPageRowGlobal(isMobile)}>
                    <input
                      style={styles.addPageInput}
                      placeholder="Add extra page (e.g. Portfolio, Results, Team)"
                      value={newPageName}
                      onChange={(e) => setNewPageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomPage();
                        }
                      }}
                    />
                    <button type="button" style={styles.addPageBtn(isMobile)} onClick={addCustomPage}>Add Extra Page</button>
                  </div>
                  <p style={styles.mutedHint}>You can add pages before or after generating the plan.</p>
                </>
              ) : (
                <p style={styles.mutedHint}>Landing page mode keeps this to one page for focused conversion.</p>
              )}
              {aiPlanError ? <p style={styles.aiError}>AI fallback used: {aiPlanError}</p> : null}

              {generatedPlan ? (
                <div style={styles.planWrap}>
                  <h3 style={styles.planTitle}>{generatedPlan.headline}</h3>
                  <p style={styles.planStrap}>{generatedPlan.strap}</p>
                  <p style={styles.planTemplate}>Recommended template: {generatedPlan.templateSlug || "starter"}</p>

                  <div style={styles.planGrid(isMobile)}>
                    <div style={styles.planCardCol}>
                      <p style={styles.planLabel}>Page Plan</p>
                      <div style={styles.subActions(isMobile)}>
                        <button type="button" style={styles.aiGhostBtn} onClick={generatePageObjectives} disabled={aiObjBusy}>
                          {aiObjBusy ? "Generating page objectives..." : "AI Generate Page Objectives"}
                        </button>
                        {aiObjError ? <p style={styles.aiError}>{aiObjError}</p> : null}
                      </div>
                      <div style={styles.addPageRow(isMobile)}>
                        <input
                          style={styles.addPageInput}
                          placeholder="Add page (e.g. Pricing, FAQ, Portfolio)"
                          value={newPageName}
                          onChange={(e) => setNewPageName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomPage();
                            }
                          }}
                        />
                        <button type="button" style={styles.addPageBtn(isMobile)} onClick={addCustomPage}>+ Add</button>
                      </div>
                      <div style={styles.planList}>
                        {normalizePagePlan(generatedPlan.pagePlan).map((p) => (
                          <div key={p.name} style={styles.planItem}>
                            <div style={styles.planItemHead(isMobile)}>
                              <p style={styles.planItemTitle}>{p.name}</p>
                              {!["Home", "About", "Contact"].includes(p.name) ? (
                                <button type="button" style={styles.pageRemoveBtn} onClick={() => removeCustomPage(p.name)}>
                                  Remove
                                </button>
                              ) : null}
                            </div>
                            <p style={styles.planItemText}>{p.objective}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={styles.planCardCol}>
                      <p style={styles.planLabel}>Copy Angles</p>
                      <div style={styles.planList}>
                        {generatedPlan.copyAngles.map((line) => (
                          <p key={line} style={styles.copyLine}>- {line}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={styles.actions(isMobile)}>
                    <button
                      type="button"
                      style={styles.primary(meta.accent, isMobile)}
                      onClick={() =>
                        openProject({
                          name: generatedPlan.headline || `${form.businessName || "New"} Website`,
                          mode: "ai",
                          buildType,
                          stylePack: projectStylePack,
                          templateSlug: generatedPlan.templateSlug,
                          brief: { ...form, stylePack: projectStylePack },
                          pages: generatedPlan.pagePlan,
                          copyAngles: generatedPlan.copyAngles,
                        })
                      }
                    >
                      {launchBusy ? "Opening Visual Builder..." : "Open in Visual Builder"}
                    </button>
                    <Link href="/modules/website-builder/new?mode=import" style={styles.secondary(isMobile)}>Open Template Import</Link>
                  </div>
                </div>
              ) : null}
            </section>
          )}

          {mode === "blank" && (
            <section style={styles.card(isMobile)}>
              <h2 style={styles.cardTitle}>Opening Website Studio</h2>
              <p style={styles.note}>
                {blankRedirecting
                  ? "Opening the website studio..."
                  : "If redirect did not happen, use the button below."}
              </p>
              {!blankRedirecting ? (
                <div style={styles.actions(isMobile)}>
                  <button
                    type="button"
                    style={styles.primary(meta.accent, isMobile)}
                    onClick={() => {
                      openProject({
                        name: `${form.businessName || "Starter"} Website`,
                        mode: "import",
                        templateSlug: "website-generic-premium",
                        stylePack: projectStylePack,
                        brief: { ...form, stylePack: projectStylePack },
                        pages: [
                          { name: "Home", objective: "Establish trust and present core offer" },
                          { name: "About", objective: "Build authority and personal connection" },
                          { name: "Contact", objective: "Capture qualified inquiries" },
                        ],
                        copyAngles: [],
                      });
                    }}
                  >
                    Open Website Studio
                  </button>
                </div>
              ) : null}
            </section>
          )}

          {mode === "import" && (
            <section style={styles.card(isMobile)}>
              <h2 style={styles.cardTitle}>Template Import</h2>
              <p style={styles.note}>Browse the imported templates below, or use a local starter template if needed.</p>

              <div style={styles.actions(isMobile)}>
                <Link href="/modules/website-builder" style={styles.primary(meta.accent, isMobile)}>
                  Back to Template Library
                </Link>
                <button
                  type="button"
                  style={styles.secondary(isMobile)}
                  onClick={() => openProject({ name: `${form.businessName || "Blank"} Website` })}
                >
                  Open Full Editor
                </button>
              </div>

              <div style={styles.wpImportCard}>
                <p style={styles.wpImportTitle}>Import From WordPress or External URL</p>
                <p style={styles.wpImportText}>
                  Paste a public page URL and we will convert key content into editable Website Builder blocks.
                </p>
                <div style={styles.wpImportControls(isMobile)}>
                  <label style={styles.wpImportLabel}>
                    Max Pages
                    <input
                      type="number"
                      min={1}
                      max={8}
                      style={styles.wpImportInput}
                      value={importMaxPages}
                      onChange={(e) => setImportMaxPages(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                    />
                  </label>

                  <label style={styles.wpImportCheck}>
                    <input
                      type="checkbox"
                      checked={importCrawl}
                      onChange={(e) => setImportCrawl(e.target.checked)}
                    />
                    Crawl Internal Pages
                  </label>
                </div>
                <div style={styles.wpImportRow(isMobile)}>
                  <input
                    style={styles.wpImportInput}
                    placeholder="https://example.com"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    style={styles.primary(meta.accent, isMobile)}
                    onClick={importFromExternalUrl}
                    disabled={importBusy}
                  >
                    {importBusy ? "Importing..." : "Import URL & Open"}
                  </button>
                </div>
                {importError ? <p style={styles.aiError}>{importError}</p> : null}
              </div>

              <div style={styles.templateGrid(isMobile)}>
                {picks.map((tpl) => {
                  const full = getTemplate(tpl.slug);
                  const preview = full.thumb || tpl.thumb || "";
                  const templateType = String(full.type || "website").toUpperCase();
                  const summary = full.blurb || full.description || "Starter template ready to customize.";
                  return (
                    <article key={tpl.slug} style={styles.tplCard}>
                      <TemplatePreview preview={preview} name={tpl.name} slug={tpl.slug} />
                      <p style={styles.tplBadge}>{templateType}</p>
                      <h3 style={styles.tplTitle}>{tpl.name}</h3>
                      <p style={styles.tplMeta}>{full.slug}</p>
                      <p style={styles.tplDesc}>{summary}</p>
                      <button
                        type="button"
                        style={styles.primary(meta.accent, isMobile)}
                        onClick={() => {
                          const built = full.build?.("modern-blue");
                          const pages = Array.isArray(built?.pages) && built.pages.length
                            ? built.pages.map((p, i) => ({
                                name: p.title || p.slug || (i === 0 ? "Home" : `Page ${i + 1}`),
                                objective: "Customize sections and publish this page.",
                              }))
                            : [{ name: "Home", objective: "Customize sections and publish this page." }];

                          openProject({
                            name: tpl.name,
                            mode: "import",
                            stylePack: projectStylePack,
                            templateSlug: tpl.slug,
                            brief: { ...form, stylePack: projectStylePack },
                            pages,
                            copyAngles: [],
                          });
                        }}
                      >
                        Use Template & Open
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

function Input({ label, placeholder, value, onChange }) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <input style={styles.input} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TemplatePreview({ preview, name, slug }) {
  const [failed, setFailed] = useState(false);
  const fallbackSrc = `https://picsum.photos/seed/${encodeURIComponent(slug || name)}/1200/800`;
  const src = !failed && preview ? preview : fallbackSrc;

  return (
    <div style={styles.tplPreviewWrap}>
      <img
        src={src}
        alt={`${name} preview`}
        style={styles.tplPreviewImg}
        onError={() => setFailed(true)}
      />
      {failed && !preview ? <div style={styles.tplPreviewOverlay}>Preview</div> : null}
    </div>
  );
}

const styles = {
  page: (isMobile) => ({
    minHeight: "100vh",
    background: "#0c121a",
    color: "#e6eef5",
    padding: isMobile ? "14px 10px 28px" : "24px 16px",
    fontFamily: "system-ui,-apple-system,sans-serif",
  }),
  container: (isMobile) => ({
    maxWidth: 1120,
    margin: "0 auto",
    display: "grid",
    gap: isMobile ? 14 : 18,
  }),
  banner: (meta, isMobile) => ({
    border: `1px solid ${meta.accent}77`,
    background: meta.gradient,
    borderRadius: 14,
    padding: isMobile ? "16px 14px" : "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: isMobile ? "stretch" : "center",
    flexDirection: isMobile ? "column" : "row",
    gap: 16,
    flexWrap: isMobile ? "nowrap" : "wrap",
    boxShadow: `0 10px 28px rgba(0,0,0,0.34), 0 0 0 1px ${meta.accent}55 inset`,
  }),
  bannerLeft: (isMobile) => ({
    display: "flex",
    alignItems: isMobile ? "flex-start" : "center",
    gap: isMobile ? 12 : 16,
    minWidth: 0,
  }),
  bannerIcon: (meta, isMobile) => ({
    width: isMobile ? 56 : 72,
    height: isMobile ? 56 : 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: isMobile ? 28 : 36,
    color: "#fff",
    background: `linear-gradient(135deg, rgba(255,255,255,0.28), ${meta.accent}55)`,
    border: "1px solid rgba(255,255,255,0.2)",
  }),
  title: (isMobile) => ({
    margin: 0,
    fontSize: isMobile ? 28 : 48,
    lineHeight: 1.08,
    fontWeight: 600,
    color: "#fff",
    textWrap: "balance",
  }),
  subtitle: (isMobile) => ({
    margin: "4px 0 0",
    color: "#9fb0c5",
    fontSize: isMobile ? 15 : 18,
    lineHeight: 1.35,
    fontWeight: 600,
  }),
  backBtn: (isMobile) => ({
    border: "1px solid #2d3e61",
    background: "#16233a",
    color: "#dbeafe",
    borderRadius: 10,
    padding: "10px 18px",
    textDecoration: "none",
    fontSize: isMobile ? 16 : 18,
    fontWeight: 600,
    whiteSpace: "nowrap",
    width: isMobile ? "100%" : "auto",
    textAlign: "center",
  }),
  card: (isMobile) => ({
    border: "1px solid #1e2d45",
    background: "#111827",
    borderRadius: 14,
    padding: isMobile ? 14 : 20,
    display: "grid",
    gap: 14,
  }),
  cardTitle: {
    margin: 0,
    fontSize: 22,
  },
  note: {
    margin: 0,
    color: "#94a3b8",
  },
  typeHint: {
    margin: "-4px 0 2px",
    color: "#cbd5e1",
    fontSize: 16,
  },
  grid2: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(240px,1fr))",
    gap: 12,
  }),
  labelWrap: {
    display: "grid",
    gap: 6,
  },
  label: {
    color: "#9fb0c5",
    fontSize: 16,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    border: "1px solid #2b3650",
    background: "#0d1522",
    color: "#e6eef5",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
  },
  textarea: {
    width: "100%",
    border: "1px solid #2b3650",
    background: "#0d1522",
    color: "#e6eef5",
    borderRadius: 10,
    padding: "12px 14px",
    minHeight: 110,
    resize: "vertical",
    outline: "none",
  },
  actions: (isMobile) => ({
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "center",
    flexWrap: "wrap",
    gap: 10,
  }),
  subActions: (isMobile) => ({
    display: "flex",
    alignItems: isMobile ? "stretch" : "center",
    flexDirection: isMobile ? "column" : "row",
    gap: 10,
    flexWrap: "wrap",
  }),
  aiGhostBtn: {
    border: "1px solid #2b3650",
    borderRadius: 10,
    padding: "9px 12px",
    fontWeight: 600,
    color: "#93c5fd",
    background: "#10192a",
    cursor: "pointer",
  },
  aiError: {
    margin: 0,
    color: "#fca5a5",
    fontSize: 16,
  },
  primary: (accent, isMobile) => ({
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 600,
    background: `linear-gradient(135deg, ${accent}, #2d6cdf)`,
    color: "#fff",
    cursor: "pointer",
    width: isMobile ? "100%" : "auto",
    textAlign: "center",
  }),
  secondary: (isMobile) => ({
    border: "1px solid #2b3650",
    borderRadius: 10,
    padding: "9px 14px",
    fontWeight: 600,
    color: "#cbd5e1",
    textDecoration: "none",
    background: "#152038",
    width: isMobile ? "100%" : "auto",
    textAlign: "center",
  }),
  templateGrid: (isMobile) => ({
    display: "grid",
    gap: 12,
    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(240px,1fr))",
  }),
  wpImportCard: {
    border: "1px solid #274f3c",
    background: "linear-gradient(135deg,#0e1f19,#101a2c)",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 10,
  },
  wpImportTitle: {
    margin: 0,
    color: "#d1fae5",
    fontSize: 16,
    fontWeight: 600,
  },
  wpImportText: {
    margin: 0,
    color: "#9fb0c5",
    fontSize: 16,
    lineHeight: 1.5,
  },
  wpImportRow: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
    gap: 10,
    alignItems: "center",
  }),
  wpImportControls: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(170px,1fr))",
    gap: 10,
    alignItems: "end",
  }),
  wpImportLabel: {
    display: "grid",
    gap: 6,
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: 600,
  },
  wpImportSelect: {
    width: "100%",
    border: "1px solid #2b3650",
    background: "#0d1522",
    color: "#e6eef5",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
  },
  wpImportCheck: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#d1fae5",
    fontSize: 16,
    fontWeight: 600,
    minHeight: 42,
  },
  wpImportInput: {
    width: "100%",
    border: "1px solid #2b3650",
    background: "#0d1522",
    color: "#e6eef5",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
  },
  tplCard: {
    border: "1px solid #2b3650",
    background: "#0d1522",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 8,
  },
  tplPreviewWrap: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    border: "1px solid #22314c",
    overflow: "hidden",
    background: "#0b1018",
    position: "relative",
  },
  tplPreviewImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  tplPreviewOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg,#0f2238,#0b1524)",
    color: "#dbeafe",
    fontSize: 16,
    fontWeight: 600,
  },
  tplBadge: {
    margin: "2px 0 0",
    color: "#7dd3fc",
    fontSize: 16,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tplTitle: {
    margin: 0,
    fontSize: 18,
    color: "#e6eef5",
  },
  tplMeta: {
    margin: 0,
    color: "#93c5fd",
    fontSize: 16,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tplDesc: {
    margin: 0,
    color: "#9fb0c5",
    fontSize: 16,
    minHeight: 40,
  },
  planWrap: {
    border: "1px solid #2b3650",
    borderRadius: 12,
    background: "#0a1424",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  planTitle: {
    margin: 0,
    fontSize: 21,
    color: "#e6eef5",
  },
  planStrap: {
    margin: 0,
    color: "#cbd5e1",
  },
  planTemplate: {
    margin: 0,
    color: "#7dd3fc",
    fontSize: 16,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planGrid: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(260px,1fr))",
    gap: 10,
  }),
  planCardCol: {
    border: "1px solid #22314c",
    borderRadius: 10,
    padding: 10,
    background: "#0d1522",
  },
  planLabel: {
    margin: "0 0 8px",
    color: "#93c5fd",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 600,
  },
  planList: {
    display: "grid",
    gap: 8,
  },
  addPageRow: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
    gap: 8,
    marginBottom: 8,
  }),
  addPageRowGlobal: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
    gap: 8,
    marginTop: 2,
  }),
  mutedHint: {
    margin: "-2px 0 0",
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: 500,
  },
  addPageInput: {
    width: "100%",
    border: "1px solid #2b3650",
    background: "#0b1018",
    color: "#e6eef5",
    borderRadius: 8,
    padding: "8px 10px",
    outline: "none",
    fontSize: 16,
  },
  addPageBtn: (isMobile) => ({
    border: "1px solid #2b3650",
    background: "#16233a",
    color: "#dbeafe",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
    width: isMobile ? "100%" : "auto",
  }),
  planItem: {
    border: "1px solid #1e2d45",
    borderRadius: 8,
    padding: "8px 10px",
    background: "#0b1018",
  },
  planItemHead: (isMobile) => ({
    display: "flex",
    alignItems: isMobile ? "flex-start" : "center",
    flexDirection: isMobile ? "column" : "row",
    justifyContent: "space-between",
    gap: 8,
  }),
  planItemTitle: {
    margin: 0,
    fontSize: 16,
    color: "#e6eef5",
    fontWeight: 600,
  },
  pageRemoveBtn: {
    border: "1px solid #4a1020",
    background: "#2d0d16",
    color: "#fecaca",
    borderRadius: 999,
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
  },
  planItemText: {
    margin: "4px 0 0",
    fontSize: 16,
    color: "#9fb0c5",
  },
  copyLine: {
    margin: 0,
    fontSize: 16,
    color: "#dbeafe",
  },
};
