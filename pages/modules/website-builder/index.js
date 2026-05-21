import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { cacheWebsiteProjects, deleteWebsiteProject, listWebsiteProjects, updateWebsiteProject } from "../../../lib/website-builder/projectStore";
import { getWebsiteTemplatePreview } from "../../../lib/website-builder/projectStore";
import { deleteWebsiteProjectFromServer, fetchWebsiteProjectsFromServer, renameWebsiteProjectOnServer } from "../../../lib/website-builder/remoteProjects";
import { TEMPLATES } from "../../../lib/website-builder/templates";
import { openSelfHostedBuilder } from "../../../lib/website-builder/launchSelfHostedBuilder";
import { seedWebsiteBuilderSharedLibrary } from "../../../lib/website-builder/mediaAssets";
import { supabase } from "../../../lib/supabaseClient";
import s from "./website-builder.module.css";

const PREVIEW_IMAGE_KEYS = [
  "backgroundImage",
  "imageUrl",
  "image",
  "src",
  "mediaUrl",
  "photo",
  "poster",
];

function humanizeThemeName(value = "") {
  const raw = String(value || "")
    .replace(/^theme[_-]?/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  return raw.replace(/\b\w/g, (m) => m.toUpperCase()) || "Template";
}

function pickPageBackground(blocks, fallback = "#ffffff") {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const value = String(block?.props?.pageBackground || "").trim();
    if (value) return value;
  }
  return fallback;
}

function isPreviewImageUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  return /^(https?:)?\/\//i.test(raw) || /^data:image\//i.test(raw) || /^\//.test(raw);
}

function isSafeDashboardPreviewImage(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^data:image\//i.test(raw) || /^\//.test(raw)) return true;

  try {
    const url = new URL(raw);
    if (/images\.unsplash\.com$/i.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function collectPreviewImages(value, bucket) {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((entry) => collectPreviewImages(entry, bucket));
    return;
  }

  if (typeof value !== "object") return;

  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === "string" && PREVIEW_IMAGE_KEYS.includes(key) && isPreviewImageUrl(entry)) {
      bucket.push(entry.trim());
      return;
    }

    if (entry && typeof entry === "object") {
      collectPreviewImages(entry, bucket);
    }
  });
}

function resolveThemePreviewImages(preview) {
  const collected = [];
  for (const block of Array.isArray(preview?.blocks) ? preview.blocks : []) {
    collectPreviewImages(block?.props, collected);
  }

  const unique = Array.from(new Set(collected.filter(Boolean)));
  return {
    primary: unique.find((url) => isSafeDashboardPreviewImage(url)) || "",
    secondary: unique.find((url) => url !== unique[0] && isSafeDashboardPreviewImage(url)) || "",
  };
}

function ThemePreview({ theme }) {
  const preview = useMemo(() => getWebsiteTemplatePreview(String(theme?.slug || theme?.name || "")), [theme?.slug, theme?.name]);
  const blocks = Array.isArray(preview?.blocks) ? preview.blocks : [];
  const pageBackground = pickPageBackground(blocks, "#ffffff");
  const previewImages = useMemo(() => resolveThemePreviewImages(preview), [preview]);
  const pageCount = Array.isArray(preview?.pages) ? preview.pages.length : 1;
  // Use the template's explicit thumb first (covers Unsplash which isSafeDashboardPreviewImage blocks),
  // then fall back to block-extracted images
  const primaryImage = theme?.thumb || previewImages.primary;
  const secondaryImage = previewImages.secondary;

  return (
    <div
      style={{
        marginBottom: 12,
        borderRadius: 14,
        overflow: "hidden",
        background: pageBackground,
        border: "1px solid rgba(255,255,255,.12)",
        aspectRatio: "4 / 3",
        minHeight: 260,
        position: "relative",
        display: "block",
        padding: 0,
        textAlign: "left",
      }}
    >
      {primaryImage ? (
        <div
          aria-label={`${theme.title} preview`}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            background: pageBackground,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `linear-gradient(180deg, rgba(8,15,29,0.08) 0%, rgba(8,15,29,0.14) 28%, rgba(8,15,29,0.74) 100%), url(${primaryImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              transform: "scale(1.02)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <span
                style={{
                  display: "inline-flex",
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.72)",
                  color: "#e0f2fe",
                  border: "1px solid rgba(125,211,252,0.28)",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                {pageCount} pages
              </span>
              {secondaryImage ? (
                <span
                  style={{
                    display: "inline-flex",
                    padding: "7px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.14)",
                    color: "#f8fafc",
                    border: "1px solid rgba(255,255,255,0.22)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  image-rich
                </span>
              ) : null}
            </div>
            <div style={{ maxWidth: "100%" }}>
              <div style={{ color: "#ffffff", fontWeight: 800, fontSize: 18, lineHeight: 1.1, textShadow: "0 6px 24px rgba(15,23,42,0.38)" }}>{theme.title}</div>
              <div style={{ color: "rgba(226,232,240,0.92)", fontSize: 13, marginTop: 8, lineHeight: 1.45, textShadow: "0 4px 18px rgba(15,23,42,0.32)" }}>{theme.desc || "Built-in GR8 website template."}</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ height: "100%", display: "grid", placeItems: "center", gap: 8, padding: 18 }}>
          <div style={{ fontSize: 42 }}>🎨</div>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>{theme.title}</div>
          <div style={{ color: "#cbd5e1", fontSize: 16 }}>{theme.desc || "Built-in GR8 website template."}</div>
        </div>
      )}
    </div>
  );
}

export default function WebsiteBuilderDashboard() {
  const router = useRouter();
  const [websites, setWebsites] = useState([]);
  const [themes, setThemes] = useState([]);
  const [session, setSession] = useState(null);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedWebsite = useMemo(() => {
    return websites.find((site) => String(site.id) === String(selectedWebsiteId)) || websites[0] || null;
  }, [selectedWebsiteId, websites]);

  useEffect(() => {
    let subscription;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession || null)));
    })();

    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    seedWebsiteBuilderSharedLibrary(supabase, session.user.id).catch(() => {
      // Keep the dashboard responsive even if shared library sync fails.
    });
  }, [session?.user?.id]);

  async function refreshDashboard() {
    setLoading(true);
    setError("");

    try {
      let nextProjects = listWebsiteProjects({ includeUnsaved: true });

      if (session?.access_token) {
        try {
          const remoteProjects = await fetchWebsiteProjectsFromServer(session);
          // replaceAll: true makes the server list authoritative so locally-cached
          // drafts that were deleted on the server are not re-surfaced.
          nextProjects = cacheWebsiteProjects(remoteProjects, { replaceAll: true });
        } catch (syncError) {
          console.warn("Could not sync website drafts from the server", syncError);
        }
      }

      const nextWebsites = nextProjects.map((site) => ({
        ...site,
        projectStatus: String(site?.status || "saved"),
        pageCount: Array.isArray(site?.pages) && site.pages.length ? site.pages.length : Object.keys(site?.pagesContent || {}).length || 1,
      }));

      const nextThemes = TEMPLATES.filter((item) => String(item?.type || "website") === "website").map((item, index) => ({
        id: item.id || item.slug || `theme-${index}`,
        slug: item.slug,
        name: item.name,
        title: humanizeThemeName(item.name || item.slug),
        desc: item.blurb || item.description || "Built-in GR8 website template.",
        thumb: item.thumb || "",
        pageCount: Array.isArray(item.build?.("modern-blue")?.pages) ? item.build("modern-blue").pages.length : 1,
        state: "installed",
      }));

      setWebsites(nextWebsites);
      setThemes(nextThemes);
      setSelectedWebsiteId((prev) => prev || String(nextWebsites[0]?.id || ""));
    } catch (err) {
      setError(err?.message || "Could not load the local visual builder dashboard.");
      setWebsites([]);
      setThemes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshDashboard();
  }, [session?.access_token]);

  function pageCountForWebsite(site) {
    return Number(site?.pageCount || site?.pages?.length || 1);
  }

  async function openBuilder(tab = "builder", websiteId = selectedWebsite?.id) {
    const targetWebsite = websites.find((site) => String(site?.id) === String(websiteId)) || selectedWebsite;
    if (websiteId) {
      const pageName = targetWebsite?.pages?.[0]?.name || "Home";
      return router.push(`/modules/website-builder/visual-builder?projectId=${encodeURIComponent(websiteId)}&page=${encodeURIComponent(pageName)}&name=${encodeURIComponent(targetWebsite?.name || "GR8 Website")}`);
    }

    await openSelfHostedBuilder({
      name: targetWebsite?.name || "GR8 Website",
      tab,
      mode: "blank",
      buildType: "website",
    });
  }

  async function openBlankBuilder() {
    setLaunching("blank-site");
    setError("");

    try {
      await openSelfHostedBuilder({
        name: "Starter Website",
        mode: "import",
        buildType: "website",
        templateSlug: "website-generic-premium",
      });
    } catch (err) {
      setError(err?.message || "Could not open the website studio.");
    } finally {
      setLaunching("");
    }
  }

  async function applyTheme(theme) {
    setLaunching(String(theme.id));
    setError("");

    try {
      await openSelfHostedBuilder({
        name: selectedWebsite?.name || theme.title || "GR8 Website",
        mode: "import",
        buildType: "website",
        templateSlug: String(theme.slug || theme.name || ""),
      });
    } catch (err) {
      setError(err?.message || "Could not open that template in the local visual builder.");
    } finally {
      setLaunching("");
    }
  }

  function startRename(site) {
    setRenamingId(String(site.id));
    setRenameValue(site.name || "");
  }

  function cancelRename() {
    setRenamingId("");
    setRenameValue("");
  }

  async function commitRename(site) {
    const newName = renameValue.trim();
    if (!newName || newName === site.name) { cancelRename(); return; }
    setRenameSaving(true);
    try {
      updateWebsiteProject(site.id, { name: newName });
      if (session?.access_token) {
        await renameWebsiteProjectOnServer(session, site.id, newName).catch(() => {});
      }
      await refreshDashboard();
    } finally {
      setRenameSaving(false);
      cancelRename();
    }
  }

  async function deleteWebsite(site) {
    const websiteId = String(site?.id || "").trim();
    if (!websiteId) return;

    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(`Delete the saved website "${site?.name || "Untitled Site"}"? This cannot be undone.`);

    if (!confirmed) return;

    setDeletingId(String(websiteId));
    setError("");

    try {
      deleteWebsiteProject(websiteId);
      if (session?.access_token) {
        await deleteWebsiteProjectFromServer(session, websiteId);
      }
      await refreshDashboard();
    } catch (err) {
      setError(err?.message || "Could not delete that saved website.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <>
      <Head>
        <title>Website Builder | GR8</title>
      </Head>

      <main className={s.page}>
        <div className={s.container}>
          <section className={s.banner}>
            <div className={s.bannerLeft}>
              <div className={s.bannerIcon} aria-hidden>
                🌐
              </div>
              <div>
                <h1 className={s.bannerTitle}>Website Builder</h1>
                <p className={s.bannerSubtitle}>Launch the native website studio with clean starter templates </p>
              </div>
            </div>
            <button type="button" className={s.secondaryAction} onClick={() => router.push("/dashboard")}>
              Back
            </button>
          </section>

          <section className={s.heroCard}>
            <div className={s.heroBadge}>START HERE</div>
            <h2 className={s.heroTitle}>{selectedWebsite ? `Selected Project: ${selectedWebsite.name}` : "Pick a Site to Edit"}</h2>
            <p className={s.heroText}>
              Choose an existing project, open a blank local builder, or load one of the built-in website templates.
            </p>
            <div className={s.heroActions}>
              <button type="button" onClick={() => router.push("/modules/website-builder/new?mode=ai&type=website")} className={s.primaryAction}>
                AI Website Wizard
              </button>
              <button type="button" onClick={openBlankBuilder} className={s.secondaryAction} disabled={launching === "blank-site"}>
                {launching === "blank-site" ? "Opening Studio..." : "Open Website Studio"}
              </button>
              <button type="button" onClick={() => openBuilder("builder")} className={s.secondaryAction}>
                Open Selected Site
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("gr8-theme-library")?.scrollIntoView({ behavior: "smooth" })}
                className={s.secondaryAction}
              >
                Browse Imported Themes
              </button>
              <button type="button" onClick={() => router.push("/modules/website-builder/domains")} className={s.secondaryAction}>
                Manage Domains
              </button>
            </div>
          </section>

          {error ? (
            <section className={s.wizardCard}>
              <h3 className={s.wizardTitle}>Builder Message</h3>
              <p className={s.wizardText}>{error}</p>
            </section>
          ) : null}

          <section className={s.wizardCard}>
            <h3 className={s.wizardTitle}>Saved Websites</h3>
            <p className={s.wizardText}>Select from your saved website projects and reopen them in the visual block builder. Draft and unsaved projects are shown too so AI builds do not disappear from the dashboard.</p>
            {loading ? <p className={s.wizardText}>Loading sites...</p> : null}
            {!loading && websites.length === 0 ? <p className={s.wizardText}>No sites found yet. Open the visual block builder to create one.</p> : null}
            <div className={s.grid}>
              {websites.map((site) => (
                <article key={site.id} className={s.modeCard}>
                  <div className={s.modeIcon}>{String(site.id) === String(selectedWebsiteId) ? "✅" : "🌍"}</div>
                  {renamingId === String(site.id) ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename(site); if (e.key === "Escape") cancelRename(); }}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid #3b82f6", background: "#0f172a", color: "#f1f5f9", fontSize: 15, fontWeight: 600 }}
                        disabled={renameSaving}
                      />
                      <button type="button" onClick={() => commitRename(site)} disabled={renameSaving} style={{ padding: "6px 12px", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        {renameSaving ? "…" : "Save"}
                      </button>
                      <button type="button" onClick={cancelRename} disabled={renameSaving} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: "#cbd5e1", border: "none", cursor: "pointer", fontSize: 13 }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <h3 className={s.modeTitle}>{site.name}</h3>
                  )}
                  <p className={s.modeDesc}>{pageCountForWebsite(site)} pages ready on this site.</p>
                  <p className={s.modeDesc}>Status: {site.projectStatus}</p>
                  <div className={s.heroActions}>
                    <button
                      type="button"
                      onClick={() => setSelectedWebsiteId(String(site.id))}
                      className={s.secondaryAction}
                      disabled={deletingId === String(site.id)}
                    >
                      {String(site.id) === String(selectedWebsiteId) ? "Selected" : "Select Site"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(site)}
                      className={s.secondaryAction}
                      disabled={deletingId === String(site.id) || renamingId === String(site.id)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => openBuilder("builder", site.id)}
                      className={s.primaryAction}
                      disabled={deletingId === String(site.id)}
                    >
                      Open Site
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteWebsite(site)}
                      className={s.projectDeleteBtn}
                      disabled={deletingId === String(site.id)}
                    >
                      {deletingId === String(site.id) ? "Deleting..." : "Delete Site"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="gr8-theme-library" className={s.wizardCard}>
            <h3 className={s.wizardTitle}>Imported Theme Library</h3>
            <p className={s.wizardText}>Open a template directly in the local visual builder for {selectedWebsite?.name || "your next site"}.</p>
            {!loading && themes.length === 0 ? <p className={s.wizardText}>No imported themes were returned by the local builder yet.</p> : null}
            <div className={s.grid}>
              {themes.map((theme) => (
                <article key={theme.id} className={s.modeCard}>
                  <ThemePreview theme={theme} />
                  <div className={s.modeIcon}>🎨</div>
                  <h3 className={s.modeTitle}>{theme.title}</h3>
                  <p className={s.modeDesc}>{theme.desc}</p>
                  <p className={s.modeDesc}>{theme.pageCount} starter pages included.</p>
                  <div className={s.heroActions}>
                    <button
                      type="button"
                      onClick={() => window.open(`/modules/website-builder/preview?template=${encodeURIComponent(theme.slug || theme.name)}`, "_blank", "noopener,noreferrer")}
                      className={s.secondaryAction}
                    >
                      Preview Theme
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTheme(theme)}
                      className={s.modeAction}
                      disabled={launching === String(theme.id)}
                    >
                      {launching === String(theme.id) ? "Opening Theme..." : "Use Theme in Builder"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
