function unitToMinutes(unit) {
  const normalized = String(unit || "minutes").trim().toLowerCase();
  if (normalized === "days") return 24 * 60;
  if (normalized === "hours") return 60;
  return 1;
}

export function buildSmsSequenceQueueRows({
  userId,
  workspaceId,
  campaignId = null,
  recipients,
  steps,
  origin,
  scheduledAt = null,
  now = Date.now(),
}) {
  const requestedStart = scheduledAt ? Date.parse(scheduledAt) : now;
  if (!Number.isFinite(requestedStart)) throw new Error("SMS campaign schedule is invalid.");
  const campaignStart = Math.max(now, requestedStart);
  const availableAt = new Date(campaignStart).toISOString();
  let cumulativeMinutes = 0;
  const rows = [];

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    cumulativeMinutes += Math.max(0, Number(step.delay || 0)) * unitToMinutes(step.unit);
    const scheduledFor = new Date(campaignStart + cumulativeMinutes * 60 * 1000).toISOString();

    for (const recipient of recipients) {
      rows.push({
        user_id: userId,
        workspace_id: workspaceId,
        ...(campaignId ? { campaign_id: campaignId, contact_id: recipient.contact_id || null } : {}),
        lead_id: recipient.lead_id,
        step_no: stepIndex + 1,
        to_phone: recipient.to_phone,
        body: step.message,
        send_at_iso: scheduledFor,
        scheduled_for: scheduledFor,
        available_at: availableAt,
        status: "queued",
        origin,
      });
    }
  }

  return rows;
}
