import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { lead_id: leadId } = req.body || {};
  if (!leadId) return res.status(400).json({ ok: false, error: "lead_id is required" });

  try {
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, funnel_id, current_funnel_step_id")
      .eq("id", leadId)
      .eq("workspace_id", req.workspaceId)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });
    if (!lead.funnel_id) {
      return res.status(400).json({ ok: false, error: "Lead is not assigned to a funnel" });
    }

    const { data: steps, error: stepsError } = await supabaseAdmin
      .from("funnel_steps")
      .select("id, title, order_index")
      .eq("funnel_id", lead.funnel_id)
      .order("order_index", { ascending: true });

    if (stepsError) throw stepsError;
    if (!steps?.length) return res.status(400).json({ ok: false, error: "Funnel has no steps" });

    const currentIndex = lead.current_funnel_step_id
      ? steps.findIndex((step) => step.id === lead.current_funnel_step_id)
      : -1;

    if (lead.current_funnel_step_id && currentIndex === -1) {
      return res.status(409).json({ ok: false, error: "Lead has an invalid funnel step" });
    }

    const nextStep = steps[currentIndex + 1];
    if (!nextStep) {
      return res.status(409).json({ ok: false, error: "Lead has already completed this funnel" });
    }

    const { data: updatedLead, error: updateError } = await supabaseAdmin
      .from("leads")
      .update({ current_funnel_step_id: nextStep.id, updated_at: new Date().toISOString() })
      .eq("id", lead.id)
      .eq("workspace_id", req.workspaceId)
      .select("*")
      .single();

    if (updateError) throw updateError;
    return res.status(200).json({ ok: true, lead: updatedLead, step: nextStep });
  } catch (error) {
    console.error("[/api/funnels/progress-lead]", error);
    return res.status(500).json({ ok: false, error: error?.message || "Server error" });
  }
}

export default withWorkspace(handler);