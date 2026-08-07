import type { CanvaImportManifest } from "./types";

export type Gr8ImportConfig = {
  baseUrl: string;
  importToken: string;
};

export async function uploadManifest(config: Gr8ImportConfig, manifest: CanvaImportManifest) {
  return gr8Fetch(config, "/api/standard-inclusions/canva-app/import/pages", {
    method: "POST",
    body: JSON.stringify({ manifest }),
  });
}

export async function uploadRenderedPageAsset(config: Gr8ImportConfig, asset: {
  sourceElementId: string;
  sourcePageId: string;
  pageIndex: number;
  fileName?: string;
  mimeType?: string;
  publicUrl?: string;
  base64?: string;
}) {
  return gr8Fetch(config, "/api/standard-inclusions/canva-app/import/assets", {
    method: "POST",
    body: JSON.stringify({ ...asset, role: "page-render" }),
  });
}

export async function completeImport(config: Gr8ImportConfig) {
  return gr8Fetch(config, "/api/standard-inclusions/canva-app/import/complete", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function gr8Fetch(config: Gr8ImportConfig, path: string, init: RequestInit) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.importToken}`,
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `Gr8 Result import failed at ${path}`);
  return payload;
}
