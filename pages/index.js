import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { PublishedWebsiteRenderer } from "./sites/[...slug]";
import Welcome from "./welcome";
import { getPlatformAppHost, normalizeDomain } from "../lib/website-builder/publishConfig";
import { getPrimaryPublishedWebsite } from "../lib/website-builder/publicationStore";

function shouldLogRootResolution() {
  return process.env.WEBSITE_PUBLISH_DEBUG === "1" || process.env.NEXT_PUBLIC_WEBSITE_PUBLISH_DEBUG === "1";
}

function PlatformAppRoot() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // Show nothing while checking auth (avoids flash)
  if (loading) return null;

  // Authenticated users are being redirected; don't flash the landing page
  if (user) return null;

  return <Welcome />;
}

export default function Index({ mode, publication }) {
  if (mode === "published-website" && publication) {
    return <PublishedWebsiteRenderer publication={publication} requestedPath={[]} isDomainRequest />;
  }

  if (mode === "published-not-found") {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#05070f", color: "#f8fafc", fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
        <section style={{ width: "min(720px, 100%)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 16, padding: 24, background: "rgba(127,29,29,0.22)" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 28 }}>Published website not found</h1>
          <p style={{ margin: 0, color: "rgba(248,250,252,0.82)", lineHeight: 1.6 }}>
            This domain reached the Website Builder public route, but no published website matched the request host. Check the `published_websites` row for the custom domain and published status.
          </p>
        </section>
      </main>
    );
  }

  return <PlatformAppRoot />;
}

Index.disableLayout = true;

export async function getServerSideProps(ctx) {
  const headers = ctx.req?.headers || {};
  const host = normalizeDomain(headers.host || "");
  const forwardedHost = normalizeDomain(headers["x-forwarded-host"] || "");
  const vercelForwardedHost = normalizeDomain(headers["x-vercel-forwarded-host"] || "");
  const resolvedHost = vercelForwardedHost || forwardedHost || host;
  const appHost = getPlatformAppHost();
  const isLocalHost = /^localhost$|^127\.0\.0\.1$/.test(resolvedHost);
  const isAppHost = resolvedHost === appHost || resolvedHost.startsWith(`app.`);

  if (shouldLogRootResolution()) {
    console.info("[website-root] host resolution", {
      host,
      forwardedHost,
      vercelForwardedHost,
      resolvedHost,
      appHost,
      isLocalHost,
      isAppHost,
      url: ctx.req?.url || "/",
    });
  }

  if (!isLocalHost && !isAppHost) {
    const publication = await getPrimaryPublishedWebsite(resolvedHost);
    if (shouldLogRootResolution()) {
      console.info("[website-root] publication resolution", {
        resolvedHost,
        found: !!publication,
        id: publication?.id || null,
        slug: publication?.slug || null,
        customDomain: publication?.custom_domain || null,
        primaryDomain: publication?.primary_domain || null,
        published: publication?.published ?? null,
      });
    }

    if (publication) {
      return {
        props: {
          mode: "published-website",
          publication,
        },
      };
    }

    return {
      props: {
        mode: "published-not-found",
        publication: null,
      },
    };
  }

  return {
    props: {
      mode: "platform-app-root",
      publication: null,
    },
  };
}

