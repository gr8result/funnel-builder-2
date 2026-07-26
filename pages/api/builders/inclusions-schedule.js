import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { roundMoney, numberValue } from "../../../lib/builders/selectionBudget";

const BUCKET = "Private-assets";

function groupSelectionsForSchedule(selections) {
  const groups = new Map();
  selections.forEach((selection) => {
    const groupName = selection.room || selection.category || "Other";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push({
      productCode: selection.supplier_sku || selection.manufacturer_sku || "",
      productName: selection.product_name || selection.selected_product_name || selection.title,
      description: selection.description || "",
      brand: selection.brand || "",
      model: selection.model_number || "",
      colour: selection.colour || selection.selected_colour || "",
      finish: selection.finish || selection.selected_finish || "",
      supplier: selection.selected_supplier_name || "",
      imageUrl: selection.image_url || "",
      variationAmount: roundMoney(numberValue(selection.variation_amount)),
      clientNotes: selection.notes && selection.metadata?.notesVisibility === "client" ? selection.notes : "",
    });
  });
  return Array.from(groups, ([groupName, items]) => ({ groupName, items }));
}

function buildScheduleHtml(snapshot) {
  const rows = snapshot.groups
    .map(
      (group) => `
        <h2>${group.groupName}</h2>
        ${group.items
          .map(
            (item) => `
          <div class="item">
            <div class="item-name">${item.productName || ""} ${item.brand ? `— ${item.brand}` : ""} ${item.model ? `(${item.model})` : ""}</div>
            <div class="item-detail">${[item.colour, item.finish, item.supplier].filter(Boolean).join(" · ")}</div>
            <div class="item-amount">${item.variationAmount === 0 ? "Included" : item.variationAmount > 0 ? `+$${item.variationAmount.toFixed(2)} Upgrade` : `-$${Math.abs(item.variationAmount).toFixed(2)} Credit`}</div>
          </div>`
          )
          .join("")}
      `
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    body { font-family: Arial, sans-serif; color: #0f172a; padding: 40px; }
    h1 { font-size: 26px; margin-bottom: 4px; }
    .meta { color: #475569; margin-bottom: 24px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.04em; color: #0369a1; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 24px; }
    .item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
    .item-amount { font-weight: 700; }
    .totals { margin-top: 30px; border-top: 2px solid #0f172a; padding-top: 12px; font-weight: 700; }
    .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
    .sig-line { width: 45%; border-top: 1px solid #0f172a; padding-top: 6px; }
  </style></head><body>
    <h1>${snapshot.projectName || "Client Selections Schedule"}</h1>
    <div class="meta">${snapshot.clientName || ""}${snapshot.siteAddress ? ` · ${snapshot.siteAddress}` : ""}<br/>Generated ${new Date(snapshot.generatedAt).toLocaleDateString("en-AU")} · Version ${snapshot.version}</div>
    ${rows}
    <div class="totals">
      Total upgrades: $${snapshot.totals.totalUpgrades.toFixed(2)}<br/>
      Total credits: -$${Math.abs(snapshot.totals.totalCredits).toFixed(2)}<br/>
      Net variation: $${snapshot.totals.netVariation.toFixed(2)}
    </div>
    <div class="signatures">
      <div class="sig-line">Client signature / date</div>
      <div class="sig-line">Builder / consultant signature / date</div>
    </div>
  </body></html>`;
}

async function renderPdfBestEffort(html) {
  try {
    let puppeteer = null;
    try {
      const req = eval("require"); // eslint-disable-line no-eval
      puppeteer = req("puppeteer");
    } catch {
      const req = eval("require"); // eslint-disable-line no-eval
      puppeteer = req("puppeteer-core");
    }
    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"], headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();
    return buffer;
  } catch {
    return null;
  }
}

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const projectId = String(req.query?.projectId || "");
      if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required." });
      const { data, error } = await supabaseAdmin
        .from("builder_inclusions_schedules")
        .select("id, version, status, generated_at, signed_at, pdf_url, snapshot")
        .eq("workspace_id", req.workspaceId)
        .eq("project_id", projectId)
        .order("version", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, versions: data || [] });
    }

    if (req.method === "POST") {
      const projectId = String(req.body?.projectId || "");
      if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required." });

      const { data: project, error: projectError } = await supabaseAdmin
        .from("builder_commercial_projects")
        .select("id, project_name, client_name, site_address")
        .eq("workspace_id", req.workspaceId)
        .eq("id", projectId)
        .single();
      if (projectError) throw projectError;

      const { data: selections, error: selectionsError } = await supabaseAdmin
        .from("builder_client_selections")
        .select("*")
        .eq("workspace_id", req.workspaceId)
        .eq("project_id", projectId)
        .eq("is_active", true)
        .in("selection_status", ["selected", "approved"]);
      if (selectionsError) throw selectionsError;

      const groups = groupSelectionsForSchedule(selections || []);
      const totalUpgrades = roundMoney((selections || []).reduce((sum, s) => sum + Math.max(0, numberValue(s.variation_amount)), 0));
      const totalCredits = roundMoney((selections || []).reduce((sum, s) => sum + Math.min(0, numberValue(s.variation_amount)), 0));
      const netVariation = roundMoney(totalUpgrades + totalCredits);

      const { data: lastVersion } = await supabaseAdmin
        .from("builder_inclusions_schedules")
        .select("version")
        .eq("workspace_id", req.workspaceId)
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const version = (lastVersion?.version || 0) + 1;

      const snapshot = {
        projectName: project.project_name,
        clientName: project.client_name,
        siteAddress: project.site_address,
        generatedAt: new Date().toISOString(),
        version,
        groups,
        totals: { totalUpgrades, totalCredits, netVariation },
      };

      const html = buildScheduleHtml(snapshot);
      const pdfBuffer = await renderPdfBestEffort(html);

      let pdfUrl = null;
      if (pdfBuffer) {
        const storagePath = `inclusions-schedules/${req.workspaceId}/${projectId}/v${version}.pdf`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
        if (!uploadError) {
          const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
          pdfUrl = signed?.signedUrl || null;
        }
      }

      const { data: created, error: insertError } = await supabaseAdmin
        .from("builder_inclusions_schedules")
        .insert({
          workspace_id: req.workspaceId,
          project_id: projectId,
          version,
          status: "draft",
          snapshot,
          generated_by: req.user.id,
          pdf_url: pdfUrl,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;

      return res.status(200).json({ ok: true, schedule: created, pdfGenerated: Boolean(pdfBuffer) });
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ ok: false, error: "id is required." });
      const role = req.body?.role === "builder" ? "builder" : "client";
      const signedName = String(req.body?.signedName || "").trim();
      if (!signedName) return res.status(400).json({ ok: false, error: "A signer name is required." });

      const { data: existing, error: fetchError } = await supabaseAdmin
        .from("builder_inclusions_schedules")
        .select("id, status, client_signed_name, builder_signed_name")
        .eq("workspace_id", req.workspaceId)
        .eq("id", id)
        .single();
      if (fetchError) throw fetchError;
      if (existing.status === "signed" && role === "client" && existing.client_signed_name) {
        return res.status(409).json({ ok: false, error: "This schedule version is already signed. Regenerate a new version to make changes." });
      }

      const update = role === "builder"
        ? { builder_signed_name: signedName }
        : { client_signed_name: signedName };
      const bothSigned = role === "builder"
        ? Boolean(existing.client_signed_name)
        : Boolean(existing.builder_signed_name);
      if (bothSigned) {
        update.status = "signed";
        update.signed_at = new Date().toISOString();
      } else {
        update.status = "issued";
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("builder_inclusions_schedules")
        .update(update)
        .eq("workspace_id", req.workspaceId)
        .eq("id", id)
        .select("*")
        .single();
      if (updateError) throw updateError;

      return res.status(200).json({ ok: true, schedule: updated });
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Inclusions schedule request failed." });
  }
}

export default withWorkspace(handler);
