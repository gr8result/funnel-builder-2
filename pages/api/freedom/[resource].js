import {
  FREEDOM_TABLES,
  ensureCompany,
  isValidTicker,
  normalizeTicker,
  supabaseAdmin,
} from "../../../lib/freedom-terminal/core";

function getResourceConfig(resource) {
  return FREEDOM_TABLES[String(resource || "")] || null;
}

function parseLimit(value) {
  const limit = Number(value || 100);
  if (!Number.isFinite(limit)) return 100;
  return Math.max(1, Math.min(1000, Math.floor(limit)));
}

async function withCompanyId(config, payload) {
  if (!config.companyScoped) return payload;
  if (payload.company_id) return payload;

  const ticker = normalizeTicker(payload.ticker || payload.symbol);
  if (!ticker) return payload;
  if (!isValidTicker(ticker)) {
    const error = new Error("Invalid company ticker.");
    error.statusCode = 400;
    throw error;
  }

  const company = await ensureCompany(ticker);
  const nextPayload = { ...payload, company_id: company.id };
  delete nextPayload.ticker;
  delete nextPayload.symbol;
  return nextPayload;
}

function selectFor(config) {
  if (!config.companyScoped) return "*";
  return "*, companies(id, ticker, symbol, company_name, short_name, sector, industry, country, currency, colour_primary, colour_secondary, colour_accent, logo_url)";
}

function applySearch(config, query, search) {
  const value = String(search || "").trim();
  if (!value || !config.searchable?.length) return query;

  const orFilter = config.searchable.map((column) => `${column}.ilike.%${value}%`).join(",");
  return query.or(orFilter);
}

export default async function handler(req, res) {
  const config = getResourceConfig(req.query.resource);

  if (!config) {
    return res.status(404).json({
      error: "Unknown Freedom Terminal resource.",
      resources: Object.keys(FREEDOM_TABLES),
    });
  }

  try {
    if (req.method === "GET") {
      const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
      const ticker = normalizeTicker(
        Array.isArray(req.query.ticker)
          ? req.query.ticker[0]
          : Array.isArray(req.query.symbol)
            ? req.query.symbol[0]
            : req.query.ticker || req.query.symbol
      );
      const limit = parseLimit(req.query.limit);
      let query = supabaseAdmin.from(config.table).select(selectFor(config)).limit(limit);

      if (id) query = query.eq("id", id);
      if (ticker && config.table === "companies") query = query.eq("ticker", ticker);
      if (ticker && config.companyScoped) {
        const company = await ensureCompany(ticker);
        query = query.eq("company_id", company.id);
      }

      query = applySearch(config, query, req.query.search);

      if (config.orderBy) {
        query = query.order(config.orderBy, { ascending: Boolean(config.ascending) });
      }

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({ data: id ? data?.[0] || null : data || [] });
    }

    if (req.method === "POST") {
      const payload = await withCompanyId(config, req.body || {});
      const { data, error } = await supabaseAdmin.from(config.table).insert(payload).select("*").maybeSingle();
      if (error) throw error;
      return res.status(201).json({ data });
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: "id is required for updates." });

      const payload = await withCompanyId(config, { ...(req.body || {}) });
      delete payload.id;

      const { data, error } = await supabaseAdmin
        .from(config.table)
        .update(payload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === "DELETE") {
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: "id is required for deletes." });

      const { error } = await supabaseAdmin.from(config.table).delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.error(`Freedom Terminal ${config.table} API error:`, error);
    return res.status(error.statusCode || 500).json({
      error: error.message || `Unable to process ${config.table} request.`,
    });
  }
}
