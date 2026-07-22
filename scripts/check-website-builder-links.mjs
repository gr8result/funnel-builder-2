import fs from "node:fs";

const projectPath = "website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/full-project.json";
const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));

const pick = (link) => ({
  label: link?.label || "",
  pageId: link?.pageId || "",
  href: link?.href || "",
});

console.log(JSON.stringify({
  pages: project.pages.map((page) => pick({ label: page.name, pageId: page.id, href: page.slug === "home" ? "/" : `/${page.slug}` })),
  nav: project.globalNavBlock.props.links.map(pick),
  footer: project.globalFooterBlock.props.navLinks.map(pick),
  extra: project.globalFooterBlock.props.extraLinks.map(pick),
  parallaxCtas: Object.entries(project.pageBlocks || {}).flatMap(([pageName, blocks]) => (
    Array.isArray(blocks) ? blocks
      .filter((block) => block?.type === "parallax")
      .map((block) => ({
        pageName,
        id: block.id,
        cta: block.props?.cta || null,
        ctaText: block.props?.ctaText || "",
        ctaLink: block.props?.ctaLink || "",
      }))
      : []
  )),
}, null, 2));
