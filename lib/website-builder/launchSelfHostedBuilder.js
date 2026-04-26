import { createWebsiteProject } from "./projectStore";

function normalizePages(pages, buildType = "website", mode = "blank") {
  if (Array.isArray(pages) && pages.length) return pages;

  if (String(mode || "blank").toLowerCase() === "blank") {
    return [{ name: "Home", objective: "Start with a completely blank page and build from scratch." }];
  }

  if (String(buildType || "website").toLowerCase() === "landing") {
    return [{ name: "Landing", objective: "Convert visitors into leads or customers" }];
  }

  return [
    { name: "Home", objective: "Establish trust and present the core offer" },
    { name: "About", objective: "Build authority and personal connection" },
    { name: "Contact", objective: "Capture qualified inquiries" },
  ];
}

export function buildSelfHostedBuilderLaunchUrl(options = {}) {
  const params = new URLSearchParams();
  params.set("mode", String(options.mode || "blank"));
  params.set("type", String(options.buildType || "website"));
  if (options.name) params.set("name", String(options.name));
  if (options.templateSlug || options.theme) params.set("template", String(options.templateSlug || options.theme));
  return `/modules/website-builder/visual-builder?${params.toString()}`;
}

export async function prepareSelfHostedBuilder(options = {}) {
  return {
    url: buildSelfHostedBuilderLaunchUrl(options),
  };
}

export async function openSelfHostedBuilder(options = {}) {
  if (typeof window === "undefined") {
    return prepareSelfHostedBuilder(options);
  }

  const project = createWebsiteProject({
    name: options.name || "GR8 Website",
    mode: options.mode || "blank",
    buildType: options.buildType || "website",
    stylePack: options.stylePack || options?.brief?.stylePack || options?.brief?.importStylePack || "executive",
    templateSlug: options.templateSlug || options.theme || "",
    brief: options.brief || {},
    pages: normalizePages(options.pages, options.buildType, options.mode),
    copyAngles: Array.isArray(options.copyAngles) ? options.copyAngles : [],
    status: "unsaved",
  });

  const firstPage = project?.pages?.[0]?.name || "Home";
  const url = `/modules/website-builder/visual-builder?projectId=${encodeURIComponent(project.id)}&page=${encodeURIComponent(firstPage)}&name=${encodeURIComponent(project.name || "GR8 Website")}&mode=${encodeURIComponent(project.mode || options.mode || "blank")}&type=${encodeURIComponent(project.buildType || options.buildType || "website")}`;

  window.location.assign(url);
  return { url, projectId: project.id };
}
