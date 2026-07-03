import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { listWebsiteProjects, updateWebsiteProject } from "../../../lib/website-builder/projectStore";
import { normalizeDomain } from "../../../lib/website-builder/publishConfig";

function affiliateOrFallback(envKey, fallback) {
  return process.env[envKey] || fallback;
}

function sanitizeDomainInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^https?:\/\//, "");
}

const namecheapAffiliateUrl = affiliateOrFallback(
  "NEXT_PUBLIC_AFFILIATE_NAMECHEAP_URL",
  "https://namecheap.pxf.io/Qj2Mbx"
);

export default function WebsiteDomainsPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [verifyingId, setVerifyingId] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [websites, setWebsites] = useState([]);
  const [draftProjects, setDraftProjects] = useState([]);
  const [draftDomains, setDraftDomains] = useState({});
  const [draftProjectDomains, setDraftProjectDomains] = useState({});
  const [verifyNotes, setVerifyNotes] = useState({});
  const [searchDomain, setSearchDomain] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [activeSiteId, setActiveSiteId] = useState("");
  const [pendingDomain, setPendingDomain] = useState("");

  const showInternalTools = process.env.NEXT_PUBLIC_DOMAIN_INTERNAL_TOOLS === "1" || String(router.query.tools || "") === "1";

  useEffect(() => {
    let subscription;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const nextSession = data?.session || null;
      setSession(nextSession);
      refreshDraftProjects();
      if (nextSession?.access_token) {
        await loadDomains(nextSession.access_token);
      } else {
        setLoading(false);
      }

      const sub = supabase.auth.onAuthStateChange(async (_event, nextSessionValue) => {
        setSession(nextSessionValue || null);
        refreshDraftProjects();
        if (nextSessionValue?.access_token) {
          await loadDomains(nextSessionValue.access_token);
        } else {
          setWebsites([]);
          setDraftDomains({});
          setLoading(false);
        }
      });
      subscription = sub.data.subscription;
    })();

    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    const allTargets = [
      ...websites.map((site) => `published:${site.id}`),
      ...draftProjects.map((project) => `draft:${project.id}`),
    ];

    if (!allTargets.length) {
      setActiveSiteId("");
      return;
    }

    if (!activeSiteId || !allTargets.includes(activeSiteId)) {
      setActiveSiteId(allTargets[0]);
    }
  }, [websites, draftProjects, activeSiteId]);

  useEffect(() => {
    refreshDraftProjects();
  }, [websites.length]);

  function refreshDraftProjects() {
    const localProjects = listWebsiteProjects()
      .filter((project) => project?.id)
      .filter((project) => !project?.publication?.publishedAt)
      .filter((project) => !websites.some((site) => String(site.projectId || "") === String(project.id || "")))
      .map((project) => ({
        id: project.id,
        name: project.name || "Untitled Website",
        projectId: project.id,
        customDomain: normalizeDomain(project?.publication?.customDomain || project?.publication?.custom_domain || ""),
        isPublished: !!project?.publication?.publishedAt,
      }));

    setDraftProjects(localProjects);
    setDraftProjectDomains(Object.fromEntries(localProjects.map((project) => [project.id, project.customDomain || ""])));
  }

  async function loadDomains(accessToken = session?.access_token) {
    if (!accessToken) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/websites/domains", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load domains");

      setWebsites(Array.isArray(payload.websites) ? payload.websites : []);
      setDraftDomains(Object.fromEntries((payload.websites || []).map((site) => [site.id, site.customDomain || ""])));
      setSetupRequired(!!payload?.setupRequired);
      refreshDraftProjects();
    } catch (loadError) {
      setError(loadError?.message || "Could not load domains");
    } finally {
      setLoading(false);
    }
  }

  async function saveDomain(site) {
    if (!session?.access_token) return;
    setSavingId(site.id);
    setError("");

    try {
      const response = await fetch("/api/websites/domains", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: site.id,
          customDomain: draftDomains[site.id] || "",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not save domain");

      setWebsites((current) => current.map((entry) => entry.id === site.id ? payload.website : entry));
      setDraftDomains((current) => ({ ...current, [site.id]: payload.website.customDomain || "" }));
      setVerifyNotes((current) => ({ ...current, [site.id]: "Your domain has been saved." }));
    } catch (saveError) {
      setError(saveError?.message || "Could not save domain");
    } finally {
      setSavingId("");
    }
  }

  async function verifyDomain(site) {
    if (!session?.access_token) return;
    setVerifyingId(site.id);
    setError("");

    try {
      const response = await fetch("/api/websites/verify-domain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: site.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not verify DNS");

      setWebsites((current) => current.map((entry) => entry.id === site.id ? { ...entry, domainStatus: payload.status } : entry));
      setVerifyNotes((current) => ({ ...current, [site.id]: payload.message || "Verification complete." }));
    } catch (verifyError) {
      setError(verifyError?.message || "Could not verify DNS");
    } finally {
      setVerifyingId("");
    }
  }

  function saveDraftProjectDomain(project) {
    const nextCustomDomain = normalizeDomain(draftProjectDomains[project.id] || pendingDomain || "");
    const updated = updateWebsiteProject(project.id, {
      publication: {
        ...(project.publication || {}),
        customDomain: nextCustomDomain,
        custom_domain: nextCustomDomain,
      },
      status: "saved",
    });

    if (!updated) {
      setError("Could not save domain");
      return;
    }

    setDraftProjectDomains((current) => ({ ...current, [project.id]: nextCustomDomain }));
    setVerifyNotes((current) => ({ ...current, [`draft:${project.id}`]: nextCustomDomain ? "Your domain has been saved and will be applied when you publish this site." : "Your saved domain has been cleared." }));
    refreshDraftProjects();
  }

  async function handleSearchDomain() {
    if (!searchDomain.trim()) {
      setError("Enter a domain name to search.");
      return;
    }

    setSearching(true);
    setError("");
    setSearchResult(null);

    try {
      const response = await fetch(`/api/websites/search-domain?domain=${encodeURIComponent(searchDomain.trim())}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not search that domain");
      setSearchResult(payload);
    } catch (searchError) {
      setError(searchError?.message || "Could not search that domain");
    } finally {
      setSearching(false);
    }
  }

  const activePublishedSite = activeSiteId.startsWith("published:")
    ? websites.find((site) => site.id === activeSiteId.replace("published:", "")) || null
    : null;
  const activeDraftProject = activeSiteId.startsWith("draft:")
    ? draftProjects.find((project) => project.id === activeSiteId.replace("draft:", "")) || null
    : null;
  const activeDomainValue = activePublishedSite
    ? draftDomains[activePublishedSite.id] || ""
    : activeDraftProject
      ? draftProjectDomains[activeDraftProject.id] || ""
      : pendingDomain;

  function handleDomainValueChange(value) {
    const nextValue = sanitizeDomainInput(value);
    if (activePublishedSite) {
      setDraftDomains((current) => ({ ...current, [activePublishedSite.id]: nextValue }));
      return;
    }
    if (activeDraftProject) {
      setDraftProjectDomains((current) => ({ ...current, [activeDraftProject.id]: nextValue }));
      return;
    }
    setPendingDomain(nextValue);
  }

  return (
    <>
      <Head>
        <title>Website Domains | GR8</title>
      </Head>

      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.hero}>
            <div>
              <p style={styles.eyebrow}>CUSTOM DOMAINS</p>
              <h1 style={styles.title}>Connect Your Domain in 3 Steps</h1>
              <p style={styles.subtitle}>Buy a domain, connect it to your website, and verify your DNS settings here. If you prefer, your site can stay live on its website URL.</p>
            </div>
            <div style={styles.heroActions}>
              <Link href="/modules/website-builder" style={styles.secondaryLink}>Back to Website Builder</Link>
            </div>
          </section>

          <section style={styles.infoGrid}>
            <article style={styles.infoCard}>
              <h2 style={styles.cardTitle}>Step 1: Buy Your Domain</h2>
              <p style={styles.cardText}>If you do not already own a domain, choose one on Namecheap and complete checkout there first.</p>
              <div style={styles.providerList}>
                <a href={namecheapAffiliateUrl} target="_blank" rel="noreferrer" style={styles.providerLink(true)}>
                  <div style={styles.providerHead}>
                    <strong>Namecheap</strong>
                    <span style={styles.providerBadge}>Recommended</span>
                  </div>
                  <span>Good pricing, simple checkout, and an easy path to connect your domain after purchase.</span>
                </a>
              </div>
              <p style={styles.providerFootnote}>When your purchase is complete, return here and enter the domain exactly as you bought it.</p>
            </article>

            <article style={styles.infoCard}>
              <h2 style={styles.cardTitle}>Step 2: Add Your Domain</h2>
              <p style={styles.cardText}>If you already own a domain, or you have just bought one, select your site below and save the domain now. It can be applied before or after you publish.</p>
              <div style={styles.stepsList}>
                <div style={styles.stepItem}><span style={styles.stepNumber}>1</span><span>Use the Website dropdown in the Enter Your Domain section on this page.</span></div>
                <div style={styles.stepItem}><span style={styles.stepNumber}>2</span><span>Enter your custom domain and save it.</span></div>
                <div style={styles.stepItem}><span style={styles.stepNumber}>3</span><span>Publish your site when you are ready, then update your DNS and run connection checking.</span></div>
              </div>
              <p style={styles.cardText}>If you do not want a custom domain, you can leave your site on its website URL.</p>
            </article>
          </section>

          {showInternalTools ? (
            <section style={styles.searchCard}>
              <div style={styles.searchHead}>
                <div>
                  <h2 style={styles.cardTitle}>Internal Registrar Tools</h2>
                  <p style={styles.cardText}>This section is for internal setup and registrar testing only.</p>
                </div>
              </div>

              <div style={styles.searchRow}>
                <input
                  value={searchDomain}
                  onChange={(event) => setSearchDomain(event.target.value.trim().toLowerCase())}
                  placeholder="mybrand.com"
                  style={styles.searchInput}
                />
                <button type="button" onClick={handleSearchDomain} style={styles.primaryButton} disabled={searching}>
                  {searching ? "Searching..." : "Search Domain"}
                </button>
              </div>

              <div style={styles.envCard}>
                <strong style={styles.instructionsTitle}>Environment vars needed</strong>
                <p style={styles.instructionsText}>OPENSRS_RESELLER_USERNAME</p>
                <p style={styles.instructionsText}>OPENSRS_API_KEY</p>
                <p style={styles.instructionsText}>OPENSRS_ENV=test for sandbox, then switch to live after IP allowlisting is configured in OpenSRS.</p>
              </div>

              {searchResult ? (
                <div style={styles.searchResultCard(searchResult.available)}>
                  <strong style={styles.searchResultTitle}>
                    {searchResult.domain} {searchResult.available ? "is available" : searchResult.taken ? "is taken" : "returned a registrar response"}
                  </strong>
                  <p style={styles.instructionsText}>Registrar env: {searchResult.setup?.environment || "test"}</p>
                  <p style={styles.instructionsText}>Lookup: {searchResult.lookup?.responseText || searchResult.lookup?.status || "No status returned"}</p>
                  {typeof searchResult.price === "number" ? <p style={styles.instructionsText}>Wholesale-like OpenSRS price: ${searchResult.price.toFixed(2)} {searchResult.currency || "USD"}</p> : null}
                  {searchResult.premium ? <p style={styles.instructionsText}>Premium domain tier{searchResult.premiumGroup ? `: ${searchResult.premiumGroup}` : ""}</p> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? <div style={styles.error}>{error}</div> : null}
          {!session ? <div style={styles.notice}>You can prepare a domain for an unpublished site here now. Sign in when you want to connect or verify a live published site.</div> : null}
          {loading ? <div style={styles.notice}>Loading domains...</div> : null}
          {!loading && session && setupRequired ? <div style={styles.notice}>Domain connection setup is still being prepared. You can buy your domain now and return here to connect it once setup is complete.</div> : null}
          {!loading && session && !setupRequired && websites.length === 0 ? <div style={styles.notice}>No published sites are available yet. Publish your site first, then return here to connect your domain.</div> : null}

          {!loading && !setupRequired ? (
            <section style={styles.formCard}>
              <div style={styles.formHeader}>
                <div>
                  <h2 style={styles.cardTitle}>Enter Your Domain</h2>
                  <p style={styles.cardText}>Use this form to choose your site, enter your domain, and save the connection.</p>
                </div>
              </div>

              <div style={styles.domainGrid}>
                <label style={styles.label}>
                  Website
                  <select
                    value={activeSiteId}
                    onChange={(event) => setActiveSiteId(event.target.value)}
                    style={styles.select}
                    disabled={!websites.length && !draftProjects.length}
                  >
                    {websites.length || draftProjects.length ? null : <option value="">Create or publish your site first</option>}
                    {websites.map((site) => (
                      <option key={site.id} value={`published:${site.id}`}>{site.name} (published)</option>
                    ))}
                    {draftProjects.map((project) => (
                      <option key={project.id} value={`draft:${project.id}`}>{project.name} (not published yet)</option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Custom domain
                  <input
                    value={activeDomainValue}
                    onChange={(event) => handleDomainValueChange(event.target.value)}
                    placeholder="www.example.com"
                    style={styles.input}
                  />
                </label>
              </div>

              <div style={styles.buttonRow}>
                <button
                  type="button"
                  onClick={() => {
                    if (activePublishedSite) saveDomain(activePublishedSite);
                    if (activeDraftProject) saveDraftProjectDomain(activeDraftProject);
                  }}
                  style={styles.primaryButton}
                  disabled={(!activePublishedSite && !activeDraftProject) || (activePublishedSite && (!session || savingId === activePublishedSite.id)) || !activeDomainValue}
                >
                  {activePublishedSite && savingId === activePublishedSite.id ? "Saving..." : activeDraftProject ? "Save for Publish" : "Save Domain"}
                </button>
                <button
                  type="button"
                  onClick={() => activePublishedSite && verifyDomain(activePublishedSite)}
                  style={styles.secondaryButton}
                  disabled={!activePublishedSite || !session || verifyingId === activePublishedSite.id || !activeDomainValue}
                >
                  {activePublishedSite && verifyingId === activePublishedSite.id ? "Checking DNS..." : "Check Connection"}
                </button>
              </div>

              {activePublishedSite ? (
                <div style={styles.instructionsCard}>
                  <strong style={styles.instructionsTitle}>DNS target</strong>
                  <p style={styles.instructionsText}>Point your domain to {activePublishedSite.customDomainInstructions?.value || activePublishedSite.dnsTargetHost}.</p>
                  <p style={styles.instructionsText}>After saving your domain, update the DNS records at your registrar and then run Check Connection.</p>
                  {verifyNotes[activePublishedSite.id] ? <p style={styles.verifyNote}>{verifyNotes[activePublishedSite.id]}</p> : null}
                </div>
              ) : activeDraftProject ? (
                <div style={styles.instructionsCard}>
                  <strong style={styles.instructionsTitle}>Saved for publish</strong>
                  <p style={styles.instructionsText}>Save your domain here now and it will be applied automatically the next time you publish this site.</p>
                  <p style={styles.instructionsText}>When you are ready, open the site editor and publish the site.</p>
                  {verifyNotes[`draft:${activeDraftProject.id}`] ? <p style={styles.verifyNote}>{verifyNotes[`draft:${activeDraftProject.id}`]}</p> : null}
                </div>
              ) : (
                <div style={styles.instructionsCard}>
                  <strong style={styles.instructionsTitle}>Before you connect</strong>
                  <p style={styles.instructionsText}>You can type your domain now, but you will need to create a site before it can be saved.</p>
                </div>
              )}
            </section>
          ) : null}

          {!loading && session && !setupRequired && websites.length === 0 ? (
            <section style={styles.emptyCard}>
              <h2 style={styles.cardTitle}>Add Your Domain Before You Publish</h2>
              <p style={styles.cardText}>You can enter your domain in the form above now. Select a site that is not published yet, save your domain, and it will be applied automatically when you publish.</p>
              <div style={styles.emptySteps}>
                <div style={styles.stepItem}><span style={styles.stepNumber}>1</span><span>Open Website Builder.</span></div>
                <div style={styles.stepItem}><span style={styles.stepNumber}>2</span><span>Create or open your site.</span></div>
                <div style={styles.stepItem}><span style={styles.stepNumber}>3</span><span>Return here, save your domain, and publish when you are ready.</span></div>
              </div>
              <div style={styles.heroActions}>
                <Link href="/modules/website-builder" style={styles.secondaryLink}>Open Website Builder</Link>
              </div>
            </section>
          ) : null}

          <section style={styles.stack}>
            {websites.map((site) => (
              <article key={site.id} style={styles.siteCard}>
                <div style={styles.siteHeader}>
                  <div>
                    <h2 style={styles.siteTitle}>{site.name}</h2>
                    <p style={styles.siteMeta}>Primary Website: {site.primaryWebsiteUrl || site.liveUrl} - Status: {site.domainStatus || "generated"}</p>
                  </div>
                  <a href={site.primaryWebsiteUrl || site.liveUrl} target="_blank" rel="noreferrer" style={styles.liveLink}>Open Primary Website</a>
                </div>

                <div style={styles.domainGrid}>
                  <label style={styles.label}>
                    Primary Website
                    <input value={site.primaryWebsiteUrl || site.liveUrl || ""} readOnly style={styles.readonlyInput} />
                  </label>
                  <label style={styles.label}>
                    Internal Preview URL
                    <input value={site.internalPreviewUrl || site.defaultUrl || ""} readOnly style={styles.readonlyInput} />
                  </label>
                  <label style={styles.label}>
                    Custom domain
                    <input
                      value={draftDomains[site.id] || ""}
                      onChange={(event) => setDraftDomains((current) => ({ ...current, [site.id]: event.target.value.trim().toLowerCase() }))}
                      placeholder="www.example.com"
                      style={styles.input}
                    />
                  </label>
                </div>

                <div style={styles.buttonRow}>
                  <button type="button" onClick={() => saveDomain(site)} style={styles.primaryButton} disabled={savingId === site.id}>
                    {savingId === site.id ? "Saving..." : "Save Domain"}
                  </button>
                  <button type="button" onClick={() => verifyDomain(site)} style={styles.secondaryButton} disabled={verifyingId === site.id || !draftDomains[site.id]}>
                    {verifyingId === site.id ? "Checking DNS..." : "Check Connection"}
                  </button>
                  <Link href={`/modules/website-builder/visual-builder?projectId=${encodeURIComponent(site.projectId || "")}&page=Home&name=${encodeURIComponent(site.name || "GR8 Website")}`} style={styles.secondaryLink}>Open Site Editor</Link>
                </div>

                <div style={styles.instructionsCard}>
                  <strong style={styles.instructionsTitle}>Step 3: Update Your DNS</strong>
                  <p style={styles.instructionsText}>At your domain registrar, point your custom domain to {site.customDomainInstructions?.value || site.dnsTargetHost}.</p>
                  <p style={styles.instructionsText}>Use a CNAME record for subdomains such as www. For a root domain, use ALIAS or ANAME if your DNS provider supports it.</p>
                  {verifyNotes[site.id] ? <p style={styles.verifyNote}>{verifyNotes[site.id]}</p> : null}
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #09111a 0%, #0f172a 100%)",
    color: "#e2e8f0",
    padding: "28px 16px 56px",
    fontFamily: "'Manrope','Segoe UI',system-ui,-apple-system,sans-serif",
  },
  container: {
    width: "min(1200px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    padding: 24,
    borderRadius: 22,
    background: "linear-gradient(135deg, rgba(14,165,233,.22), rgba(15,23,42,.86))",
    border: "1px solid rgba(125,211,252,.18)",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: 0,
    fontSize: 16,
    letterSpacing: ".12em",
    color: "#7dd3fc",
    fontWeight: 600,
  },
  title: {
    margin: "8px 0 10px",
    fontSize: 38,
    lineHeight: 1.05,
  },
  subtitle: {
    margin: 0,
    maxWidth: 720,
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  searchCard: {
    padding: 20,
    borderRadius: 20,
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(148,163,184,.18)",
    display: "grid",
    gap: 14,
  },
  searchHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  searchRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  searchInput: {
    flex: "1 1 280px",
    minWidth: 240,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.2)",
    background: "#020617",
    color: "#f8fafc",
    padding: "11px 12px",
  },
  envCard: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(2,6,23,.52)",
    border: "1px solid rgba(148,163,184,.16)",
    display: "grid",
    gap: 4,
  },
  searchResultCard: (available) => ({
    padding: 14,
    borderRadius: 14,
    background: available ? "rgba(20,83,45,.32)" : "rgba(30,41,59,.45)",
    border: available ? "1px solid rgba(74,222,128,.3)" : "1px solid rgba(148,163,184,.16)",
    display: "grid",
    gap: 6,
  }),
  searchResultTitle: {
    fontSize: 16,
    color: "#f8fafc",
  },
  formCard: {
    padding: 20,
    borderRadius: 20,
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(56,189,248,.2)",
    display: "grid",
    gap: 14,
  },
  formHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  infoCard: {
    padding: 20,
    borderRadius: 20,
    background: "rgba(15,23,42,.88)",
    border: "1px solid rgba(148,163,184,.18)",
    display: "grid",
    gap: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
  },
  cardText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
  providerList: {
    display: "grid",
    gap: 10,
  },
  providerLink: (recommended) => ({
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 14,
    textDecoration: "none",
    background: recommended ? "rgba(8,47,73,.72)" : "rgba(2,6,23,.55)",
    border: recommended ? "1px solid rgba(56,189,248,.35)" : "1px solid rgba(148,163,184,.16)",
    color: "#f8fafc",
  }),
  providerHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  providerBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "4px 8px",
    background: "rgba(125,211,252,.18)",
    border: "1px solid rgba(125,211,252,.35)",
    color: "#bae6fd",
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: ".04em",
    textTransform: "uppercase",
  },
  providerFootnote: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.6,
    fontSize: 16,
  },
  stepsList: {
    display: "grid",
    gap: 10,
  },
  stepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(56,189,248,.18)",
    border: "1px solid rgba(56,189,248,.32)",
    color: "#bae6fd",
    fontSize: 16,
    fontWeight: 600,
    flexShrink: 0,
    marginTop: 1,
  },
  stack: {
    display: "grid",
    gap: 16,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 20,
    background: "rgba(15,23,42,.9)",
    border: "1px solid rgba(148,163,184,.18)",
    display: "grid",
    gap: 14,
  },
  emptySteps: {
    display: "grid",
    gap: 10,
  },
  siteCard: {
    padding: 20,
    borderRadius: 20,
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(148,163,184,.18)",
    display: "grid",
    gap: 14,
  },
  siteHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  siteTitle: {
    margin: 0,
    fontSize: 24,
  },
  siteMeta: {
    margin: "6px 0 0",
    color: "#94a3b8",
  },
  domainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 16,
    color: "#cbd5e1",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.2)",
    background: "#020617",
    color: "#f8fafc",
    padding: "11px 12px",
  },
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.2)",
    background: "#020617",
    color: "#f8fafc",
    padding: "11px 12px",
  },
  readonlyInput: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.14)",
    background: "rgba(2,6,23,.45)",
    color: "#7dd3fc",
    padding: "11px 12px",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: 0,
    borderRadius: 10,
    background: "linear-gradient(135deg, #38bdf8 0%, #22c55e 100%)",
    color: "#04111d",
    fontWeight: 600,
    padding: "11px 16px",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(148,163,184,.24)",
    borderRadius: 10,
    background: "rgba(2,6,23,.52)",
    color: "#e2e8f0",
    fontWeight: 600,
    padding: "11px 16px",
    cursor: "pointer",
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    border: "1px solid rgba(148,163,184,.24)",
    borderRadius: 10,
    background: "rgba(2,6,23,.52)",
    color: "#e2e8f0",
    fontWeight: 600,
    padding: "11px 16px",
  },
  liveLink: {
    color: "#7dd3fc",
    textDecoration: "none",
    fontWeight: 600,
  },
  instructionsCard: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(2,6,23,.52)",
    border: "1px solid rgba(148,163,184,.16)",
    display: "grid",
    gap: 6,
  },
  instructionsTitle: {
    fontSize: 16,
    color: "#f8fafc",
  },
  instructionsText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.5,
    fontSize: 16,
  },
  verifyNote: {
    margin: "6px 0 0",
    color: "#86efac",
    fontWeight: 600,
    fontSize: 16,
  },
  notice: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(148,163,184,.18)",
    color: "#cbd5e1",
  },
  error: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(127,29,29,.25)",
    border: "1px solid rgba(248,113,113,.35)",
    color: "#fecaca",
  },
};
