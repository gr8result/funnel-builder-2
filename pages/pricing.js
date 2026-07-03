import { useEffect } from "react";
import { useRouter } from "next/router";
import { PublishedWebsiteRenderer } from "./sites/[...slug]";
import { getPlatformAppHost, normalizeDomain } from "../lib/website-builder/publishConfig";
import { getPrimaryPublishedWebsite, publishedWebsiteHasPage } from "../lib/website-builder/publicationStore";

function PlatformPricingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/billing");
  }, [router]);
  return null;
}

export default function PricingRedirect({ mode, publication, requestedPath }) {
  if (mode === "published-website" && publication) {
    return <PublishedWebsiteRenderer publication={publication} requestedPath={requestedPath || ["pricing"]} isDomainRequest />;
  }

  return <PlatformPricingRedirect />;
}

export async function getServerSideProps(ctx) {
  const headers = ctx.req?.headers || {};
  const host = normalizeDomain(headers["x-vercel-forwarded-host"] || headers["x-forwarded-host"] || headers.host || "");
  const appHost = getPlatformAppHost();
  const isLocalHost = /^localhost$|^127\.0\.0\.1$/.test(host);
  const isAppHost = host === appHost || host.startsWith("app.");
  const requestedPath = ["pricing"];

  if (!isLocalHost && !isAppHost) {
    const publication = await getPrimaryPublishedWebsite(host);
    if (publication && publishedWebsiteHasPage(publication, requestedPath)) {
      return {
        props: {
          mode: "published-website",
          publication,
          requestedPath,
        },
      };
    }
  }

  return {
    props: {
      mode: "platform-pricing",
      publication: null,
      requestedPath,
    },
  };
}
