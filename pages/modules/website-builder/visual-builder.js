import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import PageBuilderCanvas from "../../../components/website-builder/PageBuilderCanvas";
import {
  applyAssetToProps,
  createStoredAsset,
  mergeWebsiteBuilderAssetSources,
  normalizeSelectedAsset,
  syncWebsiteBuilderSharedAssetCache,
  uploadSharedMediaLibraryAsset,
} from "../../../lib/website-builder/mediaAssets";
import { applyChaiThemePreset, buildStarterChaiData, renderChaiHtml } from "../../../lib/website-builder/chaiStudio";
import { supabase } from "../../../lib/supabaseClient";
import { buildDefaultSiteDomain, buildHostedWebsiteUrl, buildWebsitePath, buildWebsiteUrl, getSiteRootDomain, normalizeDomain } from "../../../lib/website-builder/publishConfig";
import {
  createWebsiteProject,
  deleteWebsiteTemplateOverride,
  getWebsiteBuilderAssets,
  getWebsiteProject,
  saveWebsiteBuilderAssets,
  updateWebsiteTemplateOverride,
  updateWebsiteProject,
} from "../../../lib/website-builder/projectStore";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizeSlugInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-");
}

function sanitizeDomainInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^https?:\/\//, "");
}

export default function VisualBuilderPage() {
  const router = useRouter();
  const { projectId, page, name, mode, type, template } = router.query;
  const [project, setProject] = useState(null);
  const [activePage, setActivePage] = useState("Home");
  const [newPageName, setNewPageName] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("info");
  const [noticeDuration, setNoticeDuration] = useState(2400);
  const [brandAssets, setBrandAssets] = useState({ logo: null, images: [] });
  const [session, setSession] = useState(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [siteSlug, setSiteSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [blockDefaults, setBlockDefaults] = useState({});

  useEffect(() => {
    setBrandAssets(getWebsiteBuilderAssets());
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return undefined;

    let cancelled = false;

    const syncSharedAssets = async () => {
      const mergedAssets = await syncWebsiteBuilderSharedAssetCache({
        supabase,
        userId: session.user.id,
        currentAssets: getWebsiteBuilderAssets(),
      });

      if (cancelled) return;
      saveWebsiteBuilderAssets(mergedAssets);
      setBrandAssets(mergedAssets);
    };

    syncSharedAssets().catch((error) => {
      console.warn("Could not sync shared website builder assets", error);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let subscription;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      const sub = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession || null);
      });
      subscription = sub.data.subscription;
    })();

    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => {
      setNotice("");
      setNoticeTone("info");
    }, noticeDuration);
    return () => window.clearTimeout(timer);
  }, [notice, noticeDuration]);

  useEffect(() => {
    if (!router.isReady) return;

    const requestedPage = String(page || "Home");
    let nextProject = projectId ? getWebsiteProject(projectId) : null;

    if (!nextProject) {
      nextProject = createWebsiteProject({
        name: String(name || "GR8 Website"),
        mode: String(mode || "blank"),
        buildType: String(type || "website"),
        templateSlug: String(template || ""),
        pages: [{
          name: requestedPage,
          objective: String(mode || "blank") === "blank"
            ? "Start with a completely blank page and build from scratch."
            : `Build the ${requestedPage} page.`,
        }],
        status: "unsaved",
      });
    }

    setProject(nextProject);

    const resolvedPage = nextProject?.pages?.find((entry) => slugify(entry.name) === slugify(requestedPage))?.name
      || nextProject?.pages?.[0]?.name
      || requestedPage;

    setActivePage(resolvedPage);
  }, [router.isReady, projectId, page, name, mode, type, template]);

  useEffect(() => {
    const fallbackSlug = slugify(project?.publication?.slug || project?.slug || project?.name || "site");
    if (fallbackSlug && fallbackSlug !== siteSlug) {
      setSiteSlug(fallbackSlug);
    }
    const savedCustomDomain = normalizeDomain(project?.publication?.customDomain || project?.publication?.custom_domain || "");
    if (savedCustomDomain !== customDomain) {
      setCustomDomain(savedCustomDomain);
    }
  }, [project?.id, project?.publication?.customDomain, project?.publication?.custom_domain]);

  const currentObjective = useMemo(() => {
    const pageEntry = project?.pages?.find((entry) => entry.name === activePage || slugify(entry.name) === slugify(activePage));
    return pageEntry?.objective || "Build this page in the visual editor.";
  }, [project, activePage]);

  function flashNotice(message, tone = "info", duration = null) {
    setNotice(String(message || ""));
    setNoticeTone(tone);
    setNoticeDuration(duration ?? (tone === "error" ? 6500 : 2400));
  }

  async function handleCopyPublishedUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
      flashNotice("No published URL is available yet.", "error");
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "readonly");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      flashNotice("Published URL copied", "success");
    } catch (_error) {
      flashNotice("Could not copy the published URL.", "error");
    }
  }

  async function handlePublishWebsite() {
    if (!project?.id) {
      flashNotice("Save the project before publishing.", "error");
      return;
    }

    if (!session?.access_token) {
      flashNotice("Please log in again before publishing.", "error");
      return;
    }

    const normalizedSlug = slugify(siteSlug || project.name || "site");
    if (!normalizedSlug) {
      flashNotice("Add a valid site slug before publishing.", "error");
      return;
    }

    setPublishBusy(true);

    try {
      const response = await fetch("/api/websites/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          slug: normalizedSlug,
          customDomain: normalizeDomain(customDomain),
          project: {
            ...project,
            brandAssets,
            name: displayName,
            publication: undefined,
          },
        }),
      });

      const responseText = await response.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = {};
      }

      if (!response.ok || !payload?.ok) {
        const detailedMessage = payload?.error
          || (responseText && !responseText.trim().startsWith("<") ? responseText.trim() : "")
          || `Could not publish website (HTTP ${response.status})`;
        throw new Error(detailedMessage);
      }

      const nextPublication = {
        id: payload.publication?.id || "",
        slug: payload.publication?.slug || normalizedSlug,
        primaryDomain: payload.publication?.primary_domain || buildDefaultSiteDomain(normalizedSlug),
        customDomain: payload.publication?.custom_domain || normalizeDomain(customDomain),
        domainStatus: payload.publication?.domain_status || "generated",
        publishedAt: payload.publication?.published_at || new Date().toISOString(),
        sitePath: payload.sitePath || buildWebsitePath(normalizedSlug),
        liveUrl: payload.liveUrl || (payload.publication?.custom_domain
          ? buildWebsiteUrl({ slug: normalizedSlug, domain: payload.publication?.custom_domain })
          : buildHostedWebsiteUrl({ slug: normalizedSlug })),
        defaultUrl: payload.defaultUrl || buildHostedWebsiteUrl({ slug: normalizedSlug }),
        customDomainInstructions: payload.customDomainInstructions || null,
      };

      const updated = saveProjectPatch({ publication: nextPublication }, "Website published");
      if (!updated) {
        setProject((current) => current ? { ...current, publication: nextPublication } : current);
        flashNotice("Website published", "success");
      }
    } catch (error) {
      flashNotice(error?.message || "Could not publish website", "error");
    } finally {
      setPublishBusy(false);
    }
  }

  function saveProjectPatch(patch, successMessage = "Saved changes") {
    if (!project?.id) return null;

    const didSave = updateWebsiteProject(project.id, {
      ...patch,
      status: "saved",
    });

    let latest = null;
    try {
      latest = getWebsiteProject(project.id);
    } catch (_error) {
      latest = null;
    }

    if (didSave && latest) {
      setProject(latest);
      flashNotice(successMessage);
      return latest;
    }

    if (!didSave) {
      flashNotice("Could not save changes. Local storage may be full or unavailable.");
    } else {
      flashNotice("Saved, but could not reload latest changes. Try refreshing the page.");
    }

    return null;
  }

  function handleAddPage() {
    const pageName = String(newPageName || "").trim();
    if (!pageName || !project?.id) return;

    if (project.pages?.some((entry) => slugify(entry.name) === slugify(pageName))) {
      flashNotice("That page already exists.");
      return;
    }

    const nextPages = [...(project.pages || []), { name: pageName, objective: `Build the ${pageName} page.` }];
    const starterData = project?.mode === "blank"
      ? { blocks: [], theme: { preset: project?.stylePack || "executive" }, designTokens: {} }
      : buildStarterChaiData(project, pageName);

    saveProjectPatch(
      {
        pages: nextPages,
        pageBlocks: {
          ...(project.pageBlocks || {}),
          [pageName]: starterData.blocks || [],
        },
        chaiData: {
          ...(project?.chaiData || {}),
          [pageName]: starterData,
        },
        pagesContent: {
          ...(project?.pagesContent || {}),
          [pageName]: renderChaiHtml(starterData),
        },
      },
      `Added ${pageName}`
    );

    setActivePage(pageName);
    setNewPageName("");
  }

  function saveChaiPage(data, successMessage = `Saved ${activePage}`) {
    const safeData = data || buildStarterChaiData(project, activePage);
    const html = renderChaiHtml(safeData, brandAssets);

    return saveProjectPatch(
      {
        chaiData: {
          ...(project?.chaiData || {}),
          [activePage]: safeData,
        },
        pageBlocks: {
          ...(project?.pageBlocks || {}),
          [activePage]: Array.isArray(safeData?.blocks) ? safeData.blocks : [],
        },
        pagesContent: {
          ...(project?.pagesContent || {}),
          [activePage]: html,
        },
      },
      successMessage
    );
  }

  function saveBlockPage(blocks, successMessage = `Saved ${activePage}`) {
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    return saveChaiPage({
      ...(project?.chaiData?.[activePage] || {}),
      blocks: safeBlocks,
      theme: project?.chaiData?.[activePage]?.theme || { preset: project?.stylePack || "premium" },
      designTokens: project?.chaiData?.[activePage]?.designTokens || {},
    }, successMessage);
  }

  useEffect(() => {
    let cancelled = false;

    const syncServerDefaults = async () => {
      try {
        const response = await fetch("/api/website-builder/defaults");
        const payload = await response.json();
        if (!response.ok || !payload?.ok || cancelled) return;

        setBlockDefaults(payload.blockDefaults && typeof payload.blockDefaults === "object" ? payload.blockDefaults : {});

        const templateSlug = String(project?.templateSlug || "").trim();
        if (!templateSlug) return;

        const serverOverride = payload.templateOverrides?.[templateSlug] || null;
        if (serverOverride) {
          updateWebsiteTemplateOverride(templateSlug, serverOverride);
        } else {
          deleteWebsiteTemplateOverride(templateSlug);
        }

        if (!project?.id) return;
        const refreshed = getWebsiteProject(project.id);
        if (!cancelled && refreshed) setProject(refreshed);
      } catch (error) {
        console.warn("Could not load website builder defaults", error);
      }
    };

    syncServerDefaults();

    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.templateSlug]);

  async function saveTemplatePageToServer({ pageName, blocks, globalNavBlock, globalFooterBlock }) {
    if (!project?.templateSlug) return false;

    try {
      const response = await fetch("/api/website-builder/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-template-page",
          templateSlug: project.templateSlug,
          pageName,
          blocks,
          globalNavBlock,
          globalFooterBlock,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return false;

      updateWebsiteTemplateOverride(project.templateSlug, payload.templateOverride || {});
      setBlockDefaults(payload.blockDefaults && typeof payload.blockDefaults === "object" ? payload.blockDefaults : {});
      flashNotice(`Saved ${pageName} to ${project.templateSlug}`, "success", 3600);
      return true;
    } catch (error) {
      flashNotice(error?.message || "Could not save template page", "error");
      return false;
    }
  }

  async function saveTemplateSiteToServer({ pageBlocks, globalNavBlock, globalFooterBlock }) {
    if (!project?.templateSlug) return false;

    try {
      const response = await fetch("/api/website-builder/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-template-site",
          templateSlug: project.templateSlug,
          pageBlocks,
          globalNavBlock,
          globalFooterBlock,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return false;

      updateWebsiteTemplateOverride(project.templateSlug, payload.templateOverride || {});
      setBlockDefaults(payload.blockDefaults && typeof payload.blockDefaults === "object" ? payload.blockDefaults : {});
      flashNotice(`Saved ${project.templateSlug} globally`, "success", 3600);
      return true;
    } catch (error) {
      flashNotice(error?.message || "Could not save template", "error");
      return false;
    }
  }

  async function saveBlockDefaultToServer(block) {
    const blockType = String(block?.type || "").trim();
    if (!blockType) return false;

    try {
      const response = await fetch("/api/website-builder/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-block-default",
          blockType,
          props: block?.props || {},
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return false;

      setBlockDefaults(payload.blockDefaults && typeof payload.blockDefaults === "object" ? payload.blockDefaults : {});
      flashNotice(`Saved ${blockType} block defaults`, "success", 3200);
      return true;
    } catch (error) {
      flashNotice(error?.message || "Could not save block defaults", "error");
      return false;
    }
  }

  function saveGlobalBlock(block, role) {
    if (!project?.id || !block) return;
    const field = role === "nav" ? "globalNavBlock" : "globalFooterBlock";
    const updated = updateWebsiteProject(project.id, { [field]: block });
    if (updated) {
      setProject(updated);
      flashNotice(`Saved as global ${role === "nav" ? "navigation" : "footer"} — shows on every page`);
    }
  }

  function updateGlobalBlock(role, block) {
    if (!project?.id || !block) return;
    const field = role === "nav" ? "globalNavBlock" : "globalFooterBlock";
    const updated = updateWebsiteProject(project.id, { [field]: block });
    if (updated) {
      setProject(updated);
      flashNotice(`Updated global ${role === "nav" ? "navigation" : "footer"}`);
    }
  }

  function applyDesignPreset(presetName) {
    const currentData = project?.chaiData?.[activePage] || buildStarterChaiData(project, activePage);
    const nextData = applyChaiThemePreset(currentData, presetName);
    const themeLabel = String(presetName || "premium").replace(/^./, (char) => char.toUpperCase());
    saveChaiPage(nextData, `${themeLabel} theme applied`);
  }

  function persistAssets(nextAssets) {
    const didSave = saveWebsiteBuilderAssets(nextAssets);
    setBrandAssets(nextAssets);
    if (!didSave) {
      flashNotice("Image library is nearly full. Large images may not persist until reduced.");
    }
    return didSave;
  }

  function handleSelectAsset(blockIndex, fieldKey, asset, blocksOverride) {
    const normalizedAsset = normalizeSelectedAsset(asset);
    if (!normalizedAsset?.src) return;

    const currentBlocks = Array.isArray(blocksOverride)
      ? [...blocksOverride]
      : Array.isArray(project?.pageBlocks?.[activePage])
        ? [...project.pageBlocks[activePage]]
        : [...(project?.chaiData?.[activePage]?.blocks || [])];

    if (!currentBlocks[blockIndex]) return;

    const existingProps = currentBlocks[blockIndex]?.props || {};
    const nextProps = applyAssetToProps(existingProps, fieldKey, normalizedAsset);
    nextProps[fieldKey] = String(normalizedAsset.src || "").startsWith("data:") ? "" : normalizedAsset.src;

    currentBlocks[blockIndex] = {
      ...currentBlocks[blockIndex],
      props: nextProps,
    };

    saveBlockPage(currentBlocks, `${fieldKey} updated`);
  }

  async function handleUploadImage(blockIndex, fieldKey, file) {
    if (!file) return;

    try {
      const asset = session?.user?.id
        ? await uploadSharedMediaLibraryAsset(supabase, session.user.id, file, { tag: fieldKey === "logo" ? "logo" : "web" })
        : await createStoredAsset(file, { maxWidth: 960, maxHeight: 960, quality: 0.68 });
      const existingImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
      const dedupedImages = existingImages.filter((image) => image?.src && image.src !== asset.src && image.name !== asset.name);
      const nextAssets = fieldKey === "logo"
        ? { ...brandAssets, logo: asset }
        : {
            ...brandAssets,
            images: [asset, ...dedupedImages],
          };

      persistAssets(mergeWebsiteBuilderAssetSources(nextAssets));
      flashNotice(`${file.name} added`);
      return asset;
    } catch (error) {
      flashNotice(error?.message || "Image upload failed.");
    }
  }

  function openMediaLibrary() {
    if (typeof window === "undefined") return;
    window.open("/assets", "_blank", "noopener,noreferrer");
  }

  async function refreshSharedLibrary() {
    if (!session?.user?.id) {
      const currentAssets = getWebsiteBuilderAssets();
      setBrandAssets(currentAssets);
      flashNotice("Media library refreshed", "success");
      return true;
    }

    try {
      const mergedAssets = await syncWebsiteBuilderSharedAssetCache({
        supabase,
        userId: session.user.id,
        currentAssets: getWebsiteBuilderAssets(),
      });

      persistAssets(mergedAssets);
      flashNotice("Shared media library refreshed", "success");
      return true;
    } catch (error) {
      flashNotice(error?.message || "Could not refresh shared media library", "error");
      return false;
    }
  }

  const displayName = String(name || project?.name || "GR8 Website");
  const predictedDefaultDomain = buildDefaultSiteDomain(siteSlug || displayName || "site");
  const predictedHostedUrl = buildHostedWebsiteUrl({ slug: siteSlug || displayName || "site" });
  const hasDedicatedRootDomain = !!getSiteRootDomain();
  const predictedSitePath = buildWebsitePath(siteSlug || displayName || "site");
  const publication = project?.publication || null;
  const resolvedPublicationLiveUrl = publication
    ? (publication.customDomain
      ? buildWebsiteUrl({ slug: publication.slug || siteSlug || displayName || "site", domain: publication.customDomain })
      : buildHostedWebsiteUrl({ slug: publication.slug || siteSlug || displayName || "site" }))
    : "";
  const liveUrl = publication?.liveUrl || publication?.defaultUrl || buildHostedWebsiteUrl({ slug: siteSlug || displayName || "site" });

  if (!router.isReady || !project) {
    return (
      <>
        <Head>
          <title>{displayName} | GR8 Website Studio</title>
        </Head>
        <main style={styles.loadingPage}>
          <div style={styles.loadingCard}>Opening blank studio…</div>
        </main>
      </>
    );
  }

  const studioProject = project;

  return (
    <>
      <Head>
        <title>{displayName} | GR8 Website Studio</title>
      </Head>
      <main style={styles.page}>
          <section style={styles.bannerOuter}>
            <div style={styles.bannerInner}>
              <div style={styles.bannerLeft}>
                <div style={styles.bannerIcon} aria-hidden>🌐</div>
                <div>
                  <strong style={styles.bannerTitle}>Website Studio</strong>
                  <span style={styles.bannerSubtitle}>{displayName} · {activePage} page builder</span>
                </div>
              </div>
              <div style={styles.bannerActions}>
                {project?.id ? (
                  <>
                    <Link href={`/modules/website-builder/project/${project.id}/preview?page=${slugify(activePage)}`} style={styles.secondaryLink} target="_blank" rel="noopener noreferrer">
                      Preview Page
                    </Link>
                    <Link href={`/modules/website-builder/project/${project.id}/preview`} style={styles.secondaryLink} target="_blank" rel="noopener noreferrer">
                      Preview Site
                    </Link>
                  </>
                ) : null}
                {resolvedPublicationLiveUrl ? (
                  <a href={resolvedPublicationLiveUrl} style={styles.secondaryLink} target="_blank" rel="noopener noreferrer">
                    Live Site
                  </a>
                ) : null}
                <Link href="/modules/website-builder/domains" style={styles.secondaryLink}>
                  Domains
                </Link>
                <Link href="/modules/website-builder" style={styles.primaryBackLink}>
                  Back
                </Link>
              </div>
            </div>
          </section>

          <div style={styles.contentWrap}>
            <section style={styles.navPanel}>
            <div style={styles.navPanelHead}>
              <div>
                <strong style={styles.sectionTitle}>Website Setup</strong>
                <span style={styles.mutedText}>{currentObjective}</span>
              </div>
              {notice ? <span style={noticeTone === "error" ? styles.noticeError : noticeTone === "success" ? styles.noticeSuccess : styles.notice}>{notice}</span> : null}
            </div>

            <div style={styles.publishPanel}>
              <div style={styles.publishHead}>
                <strong style={styles.sectionTitle}>Publish Website</strong>
                <span style={styles.publishStatus}>{publication?.publishedAt ? "Published" : "Draft only"}</span>
              </div>

              <label style={styles.fieldLabel}>
                Site slug
                <input
                  value={siteSlug}
                  onChange={(event) => setSiteSlug(sanitizeSlugInput(event.target.value))}
                  placeholder="my-business"
                  style={styles.publishInput}
                />
                <span style={styles.fieldHelp}>
                  This is the short name used in your hosted website URL. For example, if you enter <span style={styles.inlineHighlightBlue}>"my-business"</span>, the live URL becomes <span style={styles.inlineHighlightMint}>{buildHostedWebsiteUrl({ slug: "my-business" })}</span>.
                </span>
                <span style={styles.fieldHelpMuted}>
                  This is your website's live address. You can add your own custom domain later if you want a branded URL.
                </span>
              </label>

              <label style={styles.fieldLabel}>
                Custom domain (optional)
                <input
                  value={customDomain}
                  onChange={(event) => setCustomDomain(sanitizeDomainInput(event.target.value))}
                  placeholder="www.example.com"
                  style={styles.publishInput}
                />
              </label>

              <div style={styles.publishHintWrap}>
                <span style={styles.publishHint}>Hosted website URL: <span style={styles.inlineHighlightMint}>{predictedHostedUrl}</span></span>
                {hasDedicatedRootDomain ? <span style={styles.publishHint}>Branded subdomain: <span style={styles.inlineHighlightBlue}>{predictedDefaultDomain || "Add a site slug to generate one"}</span></span> : null}
                <span style={styles.publishHint}>Published route path: <span style={styles.inlineHighlightGold}>{predictedSitePath}</span></span>
              </div>

              <div style={styles.publishActionRow}>
                <button type="button" onClick={handlePublishWebsite} style={styles.publishBtn} disabled={publishBusy || !session}>
                  {publishBusy ? "Publishing..." : publication?.publishedAt ? "Update Published Site" : "Publish Site"}
                </button>

                {resolvedPublicationLiveUrl ? (
                  <div style={styles.publishUrlCard}>
                    <span style={styles.publishUrlLabel}>Published URL</span>
                    <div style={styles.publishUrlRow}>
                      <input value={resolvedPublicationLiveUrl} readOnly style={styles.publishUrlInput} aria-label="Published website URL" />
                      <button type="button" onClick={() => handleCopyPublishedUrl(resolvedPublicationLiveUrl)} style={styles.publishUrlButton}>
                        Copy URL
                      </button>
                      <a href={resolvedPublicationLiveUrl} style={styles.publishUrlOpenLink} target="_blank" rel="noopener noreferrer">
                        Open
                      </a>
                    </div>
                    <a href={resolvedPublicationLiveUrl} style={styles.publishLiveLink} target="_blank" rel="noopener noreferrer">
                        {publication.customDomain ? `Live on ${publication.customDomain}` : `Open live website`}
                    </a>
                  </div>
                ) : null}
              </div>

              {publication?.customDomainInstructions ? (
                <div style={styles.publishDnsCard}>
                  <strong style={styles.sectionLabel}>DNS setup</strong>
                  <p style={styles.publishDnsText}>Point your custom domain to {publication.customDomainInstructions.value}.</p>
                  <p style={styles.publishDnsText}>Preferred: CNAME the host to {publication.customDomainInstructions.value}.</p>
                  <p style={styles.publishDnsText}>Apex/root domains usually need ALIAS or ANAME support at your DNS provider.</p>
                </div>
              ) : null}

              {!session ? <span style={styles.publishAuthHint}>Log in to publish this website.</span> : null}
            </div>

            <div style={styles.controlsPanel}>
              <div style={styles.controlGroup}>
                <strong style={styles.sectionLabel}>Site Pages</strong>
                <div style={styles.pagePills}>
                  {(project?.pages || [{ name: activePage }]).map((entry) => (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => setActivePage(entry.name)}
                      style={{
                        ...styles.pagePill,
                        ...(activePage === entry.name ? styles.pagePillActive : {}),
                      }}
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.themePanel}>
                <strong style={styles.sectionLabel}>Site Theme</strong>
                <div style={styles.themeRow}>
                  <button type="button" onClick={() => applyDesignPreset("premium")} style={styles.themeBtn}>Premium</button>
                  <button type="button" onClick={() => applyDesignPreset("minimal")} style={styles.themeBtn}>Minimal</button>
                  <button type="button" onClick={() => applyDesignPreset("bold")} style={styles.themeBtn}>Bold</button>
                </div>
              </div>

            </div>

            <div style={styles.addRow}>
              <input
                value={newPageName}
                onChange={(event) => setNewPageName(event.target.value)}
                placeholder="Add page name, e.g. About"
                style={styles.pageInput}
              />
              <button type="button" onClick={handleAddPage} style={styles.addBtn}>
                Add Page
              </button>
            </div>
          </section>

            <div style={styles.mainColumn}>
              <PageBuilderCanvas
                project={studioProject}
                brandAssets={brandAssets}
                pageBlocks={studioProject?.pageBlocks?.[activePage] || studioProject?.chaiData?.[activePage]?.blocks || []}
                activePage={activePage}
                currentObjective={currentObjective}
                onSave={(blocks) => saveBlockPage(blocks, `Saved ${activePage}`)}
                onUploadImage={handleUploadImage}
                onSelectAsset={handleSelectAsset}
                onSaveAsGlobal={saveGlobalBlock}
                onSaveBlockDefault={saveBlockDefaultToServer}
                onSaveTemplatePage={saveTemplatePageToServer}
                onSaveTemplateSite={saveTemplateSiteToServer}
                onUpdateGlobalBlock={updateGlobalBlock}
                onOpenMediaLibrary={openMediaLibrary}
                onRefreshAssetLibrary={refreshSharedLibrary}
                blockDefaults={blockDefaults}
                showHeader={true}
              />
            </div>
          </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "calc(100dvh - 140px)",
    background: "linear-gradient(180deg, #0b1016 0%, #0d1420 100%)",
    color: "#e6eef5",
    fontFamily: "system-ui, sans-serif",
    fontSize: 16,
    fontWeight: 600,
    display: "grid",
    gridTemplateRows: "auto 1fr",
    alignContent: "stretch",
    gap: 12,
    minWidth: 0,
  },
  loadingPage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0b1016",
    padding: 24,
  },
  loadingCard: {
    borderRadius: 16,
    padding: "18px 22px",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
  },
  emptyCard: {
    display: "grid",
    gap: 14,
    width: "min(620px, 100%)",
    borderRadius: 18,
    padding: 24,
    background: "#111827",
    border: "1px solid rgba(255,255,255,.08)",
  },
  mainColumn: {
    minWidth: 0,
    minHeight: "calc(100dvh - 320px)",
    height: "calc(100dvh - 320px)",
    display: "grid",
  },
  bannerOuter: {
    padding: "18px 16px 12px",
  },
  bannerInner: {
    width: "min(1320px, 100%)",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "20px 24px",
    borderRadius: 20,
    background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 32%, #1d4ed8 58%, #7c3aed 100%)",
    border: "1px solid rgba(125,211,252,0.26)",
    boxShadow: "0 22px 48px rgba(15,23,42,0.30)",
    flexWrap: "wrap",
    position: "relative",
    overflow: "hidden",
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.24)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
    fontSize: 22,
    flexShrink: 0,
  },
  bannerTitle: {
    display: "block",
    fontSize: 48,
    lineHeight: 1,
    fontWeight: 600,
    color: "#ffffff",
    letterSpacing: "-.03em",
    textShadow: "0 2px 14px rgba(15,23,42,0.18)",
  },
  bannerSubtitle: {
    display: "block",
    marginTop: 8,
    fontSize: 18,
    lineHeight: 1.4,
    color: "rgba(239,246,255,0.92)",
  },
  bannerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginLeft: "auto",
  },
  secondaryLink: {
    color: "#ffffff",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.20)",
    background: "rgba(2,6,23,.16)",
    backdropFilter: "blur(8px)",
    fontSize: 16,
    fontWeight: 600,
  },
  primaryBackLink: {
    color: "#082032",
    textDecoration: "none",
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.34)",
    background: "#f8fafc",
    fontSize: 16,
    fontWeight: 600,
    boxShadow: "0 10px 24px rgba(8,32,50,0.16)",
  },
  backBtn: {
    textDecoration: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "rgba(255,255,255,.1)",
    border: "1px solid rgba(255,255,255,.22)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    justifySelf: "start",
  },
  contentWrap: {
    width: "100%",
    maxWidth: "none",
    margin: 0,
    padding: "0 12px 12px",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 12,
  },
  navPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    background: "#0f172a",
    minWidth: 0,
  },
  navPanelHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  mutedText: {
    fontSize: 16,
    fontWeight: 600,
    opacity: 0.75,
  },
  sectionTitle: {
    display: "block",
    fontSize: 16,
    color: "#f8fafc",
    fontWeight: 600,
  },
  sectionLabel: {
    fontSize: 16,
    color: "#f8fafc",
    fontWeight: 600,
  },
  notice: {
    fontSize: 16,
    color: "#bae6fd",
    fontWeight: 600,
  },
  noticeSuccess: {
    fontSize: 16,
    color: "#86efac",
    fontWeight: 600,
  },
  noticeError: {
    fontSize: 16,
    color: "#fca5a5",
    fontWeight: 600,
  },
  publishPanel: {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(56,189,248,0.18)",
  },
  publishHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  publishStatus: {
    fontSize: 16,
    fontWeight: 600,
    color: "#bae6fd",
  },
  fieldLabel: {
    display: "grid",
    gap: 6,
    fontSize: 16,
    color: "#e2e8f0",
    fontWeight: 600,
  },
  publishInput: {
    width: "100%",
    background: "#020617",
    color: "#e6eef5",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 600,
  },
  fieldHelp: {
    fontSize: 16,
    color: "#dbeafe",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  fieldHelpMuted: {
    fontSize: 16,
    color: "#c4b5fd",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  publishHintWrap: {
    display: "grid",
    gap: 4,
  },
  publishHint: {
    fontSize: 16,
    fontWeight: 600,
    color: "#cbd5e1",
  },
  publishActionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  inlineHighlightBlue: {
    color: "#7dd3fc",
  },
  inlineHighlightMint: {
    color: "#86efac",
  },
  inlineHighlightLavender: {
    color: "#c4b5fd",
  },
  inlineHighlightGold: {
    color: "#fcd34d",
  },
  publishBtn: {
    flex: "1 1 320px",
    maxWidth: "50%",
    minHeight: 72,
    padding: "18px 20px",
    borderRadius: 10,
    border: 0,
    background: "linear-gradient(135deg, #38bdf8 0%, #22c55e 100%)",
    color: "#04111d",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  publishLiveLink: {
    color: "#7dd3fc",
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 600,
  },
  publishUrlCard: {
    flex: "1 1 420px",
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  publishUrlLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "#f8fafc",
  },
  publishUrlRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  publishUrlInput: {
    flex: "1 1 320px",
    minWidth: 0,
    background: "#020617",
    color: "#e6eef5",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 600,
  },
  publishUrlButton: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(56,189,248,0.28)",
    background: "rgba(14,165,233,0.16)",
    color: "#e0f2fe",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  publishUrlOpenLink: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(34,197,94,0.24)",
    background: "rgba(34,197,94,0.14)",
    color: "#dcfce7",
    fontSize: 16,
    fontWeight: 600,
    textDecoration: "none",
  },
  publishDnsCard: {
    display: "grid",
    gap: 4,
    padding: 10,
    borderRadius: 12,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  publishDnsText: {
    margin: 0,
    fontSize: 16,
    color: "#cbd5e1",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  publishAuthHint: {
    fontSize: 16,
    color: "#fca5a5",
    fontWeight: 600,
  },
  controlsPanel: {
    display: "grid",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  controlGroup: {
    display: "grid",
    gap: 10,
  },
  pagePills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  themePanel: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  themeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  themeBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  pagePill: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  pagePillActive: {
    border: "1px solid #38bdf8",
    background: "rgba(14,165,233,.16)",
  },
  addRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  pageInput: {
    minWidth: 240,
    flex: "1 1 240px",
    background: "#020617",
    color: "#e6eef5",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 600,
  },
  addBtn: {
    padding: "10px 14px",
    borderRadius: 8,
    border: 0,
    background: "#0ea5e9",
    color: "#04111d",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
};