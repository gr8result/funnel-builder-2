import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

function bearerToken(req) {
  const auth = String(req.headers.authorization || req.headers.Authorization || "").trim();
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function parseStoragePath(value = "") {
  const raw = String(value || "");
  const index = raw.indexOf(":");
  if (index <= 0) return null;
  return { bucket: raw.slice(0, index), path: raw.slice(index + 1) };
}

function isInclusionsSourceType(sourceType = "") {
  return ["standard_inclusions", "modified_inclusions"].includes(String(sourceType || ""));
}

function isQuoteProposalInclusionsRow(row = {}) {
  const metadata = row.metadata || {};
  return metadata.source === "quote_proposal_builder" && isInclusionsSourceType(metadata.sourceType);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }

  try {
    const body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const documentId = String(body.documentId || "").trim();
    const storagePath = String(body.storagePath || "").trim();
    const workspaceId = String(body.workspaceId || "").trim();
    const projectId = String(body.projectId || "").trim();
    const removeAllProjectInclusions = Boolean(body.removeAllProjectInclusions);

    let rows = [];
    if (documentId && !documentId.startsWith("pdf:")) {
      const { data, error } = await supabaseAdmin
        .from("builder_project_documents")
        .select("id, storage_path, metadata, status")
        .eq("id", documentId)
        .limit(1);
      if (error) throw error;
      rows = data || [];
    }

    if (removeAllProjectInclusions && workspaceId && projectId) {
      const { data, error } = await supabaseAdmin
        .from("builder_project_documents")
        .select("id, storage_path, metadata, status")
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("document_type", "other")
        .eq("status", "active")
        .limit(100);
      if (error) throw error;
      rows = [...rows, ...(data || []).filter(isQuoteProposalInclusionsRow)];
    }

    const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values());
    const rowIds = uniqueRows.map((row) => row.id).filter(Boolean);
    if (rowIds.length) {
      const { error } = await supabaseAdmin
        .from("builder_project_documents")
        .update({ status: "removed", updated_at: new Date().toISOString() })
        .in("id", rowIds);
      if (error) throw error;
    }

    const storageTargets = [
      storagePath,
      ...uniqueRows.map((row) => row.storage_path),
    ].map(parseStoragePath).filter((item) => item?.bucket && item.path);

    const byBucket = storageTargets.reduce((groups, item) => {
      groups[item.bucket] = [...(groups[item.bucket] || []), item.path];
      return groups;
    }, {});

    await Promise.all(Object.entries(byBucket).map(([bucket, paths]) => (
      supabaseAdmin.storage.from(bucket).remove([...new Set(paths)]).catch(() => null)
    )));

    return res.status(200).json({
      ok: true,
      removedDocumentIds: rowIds,
      removedStoragePaths: storageTargets.map((item) => `${item.bucket}:${item.path}`),
    });
  } catch (error) {
    console.error("[proposal-document-remove]", error);
    return res.status(500).json({ ok: false, error: error?.message || "Document removal failed" });
  }
}
