// ============================================
// /pages/api/ai/write-email-block.js
// ============================================
// FULL REPLACEMENT — FIXES "Module not found: Can't resolve 'openai'"
// ✅ Removes the broken `import OpenAI from "openai"`
// ✅ Safe stub (no dependency). Your app will build again.
// ✅ Returns a simple block you can drop into your editor.
//
// If you later want real AI output, we can swap this stub to a fetch() call.
// ============================================

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const body = req.body || {};
    const prompt = String(body.prompt || body.text || "").trim();

    if (!prompt) {
      return res.status(400).json({ ok: false, error: "Missing prompt" });
    }

    // Simple deterministic output so you can see it work
    const html = `
      <div style="padding:16px;border:1px solid rgba(255,255,255,0.18);border-radius:12px;background:rgba(255,255,255,0.06);color:#e6eef8;font-size:16px;line-height:1.5;direction:ltr;text-align:left;">
        <div style="font-weight:600;margin-bottom:8px;">Suggested block</div>
        <div>${escapeHtml(prompt)}</div>
        <div style="opacity:0.8;margin-top:10px;">(AI stub is active — replace later if needed.)</div>
      </div>
    `.trim();

    return res.status(200).json({ ok: true, html });
  } catch (e) {
    console.error("write-email-block error:", e);
    return res.status(500).json({ ok: false, error: "AI failed" });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
