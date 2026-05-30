// pages/api/automation/engine/check-storage.js
// Quick diagnostic to check if HTML files exist in storage
import { supabaseAdmin as supabase } from "../../../../lib/supabaseAdmin.js";
import withAdmin from "../../../../lib/withAdmin";

async function handler(req, res) {
  const { htmlPath } = req.query;
  
  if (!htmlPath) {
    return res.status(400).json({ error: "Missing htmlPath parameter" });
  }

  const bucket = "email-user-assets";
  
  try {
    // Try to download the file
    const { data, error } = await supabase.storage.from(bucket).download(htmlPath);
    
    if (error) {
      return res.json({
        ok: false,
        exists: false,
        error: error.message,
        bucket,
        htmlPath,
      });
    }
    
    if (!data) {
      return res.json({
        ok: false,
        exists: false,
        error: "No data returned",
        bucket,
        htmlPath,
      });
    }
    
    const html = await data.text();
    
    return res.json({
      ok: true,
      exists: true,
      bucket,
      htmlPath,
      htmlLength: html.length,
      htmlPreview: html.substring(0, 200),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err),
      bucket,
      htmlPath,
    });
  }
}

export default withAdmin(handler);
