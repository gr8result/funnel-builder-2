// /lib/campaigns/campaignsTypes.js
// campaigns types + helpers (Zeneth-based, server-safe)

const TIME_UNITS = {
  minutes: { value: "minutes", multiplier: 60 * 1000 },
  hours: { value: "hours", multiplier: 60 * 60 * 1000 },
  days: { value: "days", multiplier: 24 * 60 * 60 * 1000 },
  weeks: { value: "weeks", multiplier: 7 * 24 * 60 * 60 * 1000 },
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getDefaultSchedule(position) {
  const schedules = [
    { delayValue: 0, delayUnit: "minutes" },
    { delayValue: 3, delayUnit: "days" },
    { delayValue: 7, delayUnit: "days" },
  ];
  return schedules[position - 1] || schedules[0];
}

function createcampaignsEmail(data = {}) {
  const position = data.position || 1;
  return {
    id: data.id || generateId(),
    templateId: data.templateId || null,
    templateName: data.templateName || `Email ${position}`,
    subject: data.subject || `Email ${position}`,
    htmlContent: data.htmlContent || "",
    schedule: data.schedule || getDefaultSchedule(position),
    dynamicTokens: data.dynamicTokens || {},
  };
}

function createcampaigns(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || "Untitled campaigns",
    description: data.description || "",
    leadList: data.leadList || null, // { id, name, count }
    emails: data.emails || [
      createcampaignsEmail({ position: 1 }),
      createcampaignsEmail({ position: 2 }),
      createcampaignsEmail({ position: 3 }),
    ],
    startDate: data.startDate ? new Date(data.startDate) : new Date(),
    status: data.status || "draft",
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    metadata: data.metadata || {},
  };
}

function calculateSendTime(campaignstart, schedule) {
  const start = new Date(campaignstart);
  const timeUnit = TIME_UNITS[schedule?.delayUnit];
  if (!timeUnit) throw new Error(`Invalid time unit: ${schedule?.delayUnit}`);
  const delayMs = Number(schedule?.delayValue || 0) * timeUnit.multiplier;
  return new Date(start.getTime() + delayMs);
}

function validatecampaigns(campaigns) {
  const errors = [];

  if (!campaigns?.name?.trim()) errors.push("campaigns name is required");
  if (!campaigns?.leadList?.id) errors.push("Lead list is required");
  if (!campaigns?.startDate) errors.push("Start date is required");

  if (!Array.isArray(campaigns?.emails) || campaigns.emails.length !== 3) {
    errors.push("campaigns must have exactly 3 emails");
  }

  (campaigns?.emails || []).forEach((email, idx) => {
    if (!email?.templateId) errors.push(`Email ${idx + 1}: Template is required`);
    if (!email?.subject?.trim()) errors.push(`Email ${idx + 1}: Subject is required`);
    if (!email?.htmlContent?.trim()) errors.push(`Email ${idx + 1}: HTML content is required`);
    if (!email?.schedule?.delayUnit) errors.push(`Email ${idx + 1}: Schedule unit missing`);
  });

  return { isValid: errors.length === 0, errors };
}

module.exports = {
  TIME_UNITS,
  generateId,
  getDefaultSchedule,
  createcampaignsEmail,
  createcampaigns,
  calculateSendTime,
  validatecampaigns,
};
