// /lib/campaigns/supabaseClient.js
// Supabase wrapper for lists/leads/templates/campaigns saving/queue writes

async function fetchLeadLists(supabase, tableName = "lead_lists") {
  const { data, error } = await supabase
    .from(tableName)
    .select("id, name, description, created_at, subscriber_count")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch lead lists: ${error.message}`);

  return (data || []).map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description || "",
    count: list.subscriber_count || 0,
    createdAt: list.created_at,
    fieldNames: ["email", "name", "first_name", "last_name", "company", "phone"],
  }));
}

/**
 * Fetch recipients for a list.
 * Tries:
 * 1) leads where list_id = listId
 * 2) leads where lead_list_id = listId
 * 3) join table lead_list_members -> leads
 */
async function fetchListSubscribers(supabase, listId, config = {}) {
  const leadsTable = config.leadsTable || "leads";
  const joinTable = config.joinTable || "lead_list_members";

  // Attempt A: leads.list_id
  {
    const { data, error } = await supabase
      .from(leadsTable)
      .select("id, email, name, first_name, last_name, company, phone, custom_fields")
      .eq("list_id", listId)
      .limit(5000);

    if (!error && Array.isArray(data)) return data;
  }

  // Attempt B: leads.lead_list_id
  {
    const { data, error } = await supabase
      .from(leadsTable)
      .select("id, email, name, first_name, last_name, company, phone, custom_fields")
      .eq("lead_list_id", listId)
      .limit(5000);

    if (!error && Array.isArray(data)) return data;
  }

  // Attempt C: join table -> leads
  {
    const { data, error } = await supabase
      .from(joinTable)
      .select(
        `lead:${leadsTable} ( id, email, name, first_name, last_name, company, phone, custom_fields )`
      )
      .eq("list_id", listId)
      .limit(5000);

    if (error) throw new Error(`Failed to fetch list members: ${error.message}`);

    return (data || [])
      .map((row) => row.lead)
      .filter(Boolean);
  }
}

async function fetchEmailTemplates(supabase, bucketName = "email-templates", folder = "") {
  const { data, error } = await supabase.storage.from(bucketName).list(folder || "");
  if (error) throw new Error(`Failed to fetch templates: ${error.message}`);

  return (data || [])
    .filter((file) => file.name && file.name.endsWith(".html"))
    .map((file) => ({
      id: file.id || file.name,
      name: file.name.replace(".html", ""),
      filename: folder ? `${folder}/${file.name}` : file.name,
      path: `${bucketName}/${folder ? `${folder}/` : ""}${file.name}`,
      lastModified: file.updated_at,
    }));
}

async function fetchTemplateContent(supabase, templateFilename, bucketName = "email-templates") {
  const { data, error } = await supabase.storage.from(bucketName).download(templateFilename);
  if (error) throw new Error(`Failed to fetch template: ${error.message}`);
  return await data.text();
}

async function savecampaigns(supabase, campaigns, tableName = "email_campaigns") {
  // store emails as jsonb if possible, but keep stringify-safe
  const payload = {
    name: campaigns.name,
    description: campaigns.description || "",
    lead_list_id: campaigns.leadList?.id || null,
    campaigns_data: campaigns.emails, // jsonb if column is jsonb
    status: campaigns.status || "draft",
    start_date: new Date(campaigns.startDate).toISOString(),
    metadata: campaigns.metadata || {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from(tableName).insert([payload]).select().single();
  if (error) throw new Error(`Failed to save campaigns: ${error.message}`);
  return data;
}

async function updatecampaignstatus(supabase, campaignsId, status, tableName = "email_campaigns") {
  const { data, error } = await supabase
    .from(tableName)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", campaignsId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update campaigns status: ${error.message}`);
  return data;
}

async function enqueuecampaignsends(supabase, rows, queueTable = "email_campaigns_queue") {
  if (!rows.length) return { inserted: 0 };
  const { error } = await supabase.from(queueTable).insert(rows);
  if (error) throw new Error(`Failed to enqueue campaigns sends: ${error.message}`);
  return { inserted: rows.length };
}

module.exports = {
  fetchLeadLists,
  fetchListSubscribers,
  fetchEmailTemplates,
  fetchTemplateContent,
  savecampaigns,
  updatecampaignstatus,
  enqueuecampaignsends,
};
