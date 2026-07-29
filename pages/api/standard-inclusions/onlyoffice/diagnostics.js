import { appPublicUrl, onlyOfficeAppInternalUrl, onlyOfficeDocumentServerUrl, onlyOfficeJwtSecret } from "../../../../lib/standard-inclusions/onlyoffice";

async function canReach(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error?.message || "unreachable" };
  }
}

export default async function handler(req, res) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const documentServerUrl = onlyOfficeDocumentServerUrl();
  const publicUrl = appPublicUrl(req);
  const internalUrl = onlyOfficeAppInternalUrl(req);
  const documentServerReachable = documentServerUrl ? await canReach(documentServerUrl) : { ok: false, error: "not configured" };
  const appInternalReachable = internalUrl ? await canReach(`${internalUrl}/modules/estimate-builder`) : { ok: false, error: "not configured" };

  return res.status(200).json({
    ok: true,
    documentServerUrlConfigured: Boolean(documentServerUrl),
    jwtSecretConfigured: Boolean(onlyOfficeJwtSecret()),
    documentServerReachable,
    appPublicUrl: publicUrl,
    appInternalUrl: internalUrl,
    callbackUrlExample: internalUrl ? `${internalUrl}/api/standard-inclusions/onlyoffice/callback?documentId=...` : "",
    fileUrlExample: internalUrl ? `${internalUrl}/api/standard-inclusions/onlyoffice/file?documentId=...&accessKey=...` : "",
    documentServerCanAccessApplication: appInternalReachable,
  });
}
