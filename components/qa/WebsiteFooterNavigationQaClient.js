import { useMemo, useState } from "react";
import { FooterPropertiesPanel } from "../website-builder/page-builder/pbPropertiesPanels";
import { renderWebsiteBlock } from "../website-builder/WebsiteBlockRenderer";
import { buildFooterNavigationContext, normalizeFooterNavigationBlock } from "../../lib/website-builder/footerNavigation";

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const EXPECTED_LINKS = [
  ["Home", "/"],
  ["Modules", "/modules"],
  ["Email", "/email"],
  ["SMS", "/sms"],
  ["CRM", "/crm"],
  ["Funnels", "/funnels"],
  ["Website Builder", "/website-builder"],
  ["Social Media", "/social-media"],
  ["Project Hub", "/project-hub"],
  ["About Us", "/about-us"],
  ["Pricing", "/pricing"],
  ["Contact Us", "/contact-us"],
].map(([label, href]) => ({ label, href }));

const pages = EXPECTED_LINKS.map((link, index) => ({
  id: `page-${index}`,
  name: link.label,
  slug: link.href === "/" ? "home" : link.href.slice(1),
  order: index,
}));

const project = {
  id: PROJECT_ID,
  pages,
  globalNavBlock: {
    type: "nav-bar",
    props: {
      links: [
        { label: "Home", href: "/" },
        {
          label: "Modules",
          href: "/modules",
          children: EXPECTED_LINKS.slice(2, 9),
        },
        ...EXPECTED_LINKS.slice(9),
      ],
    },
  },
};

const initialFooter = {
  id: "global-footer",
  type: "footer",
  props: {
    brand: "Gr8 Result Digital Solutions",
    tagline: "Code Hard or Code Home",
    backgroundColor: "#121c26",
    textColor: "#ffffff",
    linkColor: "#f59e0b",
    borderColor: "#f59e0b",
    navHeading: "Navigation",
    navigationLinks: EXPECTED_LINKS,
    extraHeading: "Company",
    extraLinks: [
      { label: "Blog", href: "/blog" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms", href: "/terms" },
    ],
    showNewsletter: false,
    copyrightText: "(c) 2026 Gr8 Result Digital Solutions. All rights reserved.",
  },
};

export default function WebsiteFooterNavigationQaClient() {
  const [footer, setFooter] = useState(() => initialFooter);
  const [saved, setSaved] = useState(null);
  const navigationContext = useMemo(() => buildFooterNavigationContext({ pages }), []);
  const normalizedFooter = normalizeFooterNavigationBlock(footer, navigationContext);
  const save = () => {
    const normalized = normalizeFooterNavigationBlock(footer, navigationContext);
    window.localStorage.setItem("qa-website-footer-navigation", JSON.stringify(normalized));
    const readBack = JSON.parse(window.localStorage.getItem("qa-website-footer-navigation"));
    setSaved({
      count: readBack.props.navigationLinks.length,
      matches: JSON.stringify(readBack.props.navigationLinks) === JSON.stringify(normalized.props.navigationLinks),
    });
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "Arial, sans-serif", padding: 22 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <strong>QA Website Footer Navigation</strong>
        <button type="button" onClick={save}>Save</button>
      </header>
      {saved ? <div style={{ padding: 10, border: "1px solid #bae6fd", background: "#e0f2fe", marginBottom: 12 }}>Saved {saved.count} links. Verified: {saved.matches ? "yes" : "no"}</div> : null}
      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 390px", gap: 18, alignItems: "start" }}>
        <div data-qa-footer-renderer>
          {renderWebsiteBlock(normalizedFooter, { editor: false, compact: false, navigationContext, siteId: PROJECT_ID })}
        </div>
        <aside data-qa-footer-editor style={{ maxHeight: "calc(100vh - 90px)", overflow: "auto" }}>
          <FooterPropertiesPanel
            block={normalizedFooter}
            index={0}
            project={project}
            onChange={(_index, props) => setFooter((current) => normalizeFooterNavigationBlock({ ...current, props }, navigationContext))}
          />
        </aside>
      </section>
    </main>
  );
}
