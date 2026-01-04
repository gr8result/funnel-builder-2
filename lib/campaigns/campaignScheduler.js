// /lib/campaigns/campaignscheduler.js
// Scheduling + token replacement (Zeneth-based)

const { calculateSendTime } = require("./campaignsTypes");

function schedulecampaigns(campaigns) {
  if (!campaigns?.startDate) throw new Error("campaigns start date is required");

  return campaigns.emails.map((email, idx) => {
    const sendTime = calculateSendTime(campaigns.startDate, email.schedule);

    return {
      id: `job-${email.id}`,
      campaignsId: campaigns.id,
      emailId: email.id,
      emailPosition: idx + 1,
      templateId: email.templateId,
      subject: email.subject,
      htmlContent: email.htmlContent,
      sendTime,
      status: "scheduled",
      retryCount: 0,
      maxRetries: 3,
    };
  });
}

function validatecampaignscheduling(campaigns) {
  const issues = [];
  const now = new Date();

  if (!campaigns?.startDate) issues.push("Start date not set");
  if (campaigns?.startDate && new Date(campaigns.startDate) < now) issues.push("Start date is in the past");
  if (!campaigns?.leadList?.id) issues.push("No lead list selected");
  if (!campaigns?.leadList?.count || campaigns.leadList.count === 0) issues.push("Lead list is empty");

  (campaigns?.emails || []).forEach((email, idx) => {
    if (!email?.templateId || !email?.htmlContent) issues.push(`Email ${idx + 1}: No template selected`);
    if (!email?.subject?.trim()) issues.push(`Email ${idx + 1}: Subject is empty`);
  });

  return { canSchedule: issues.length === 0, issues };
}

function prepareEmailForSubscriber(email, subscriber) {
  let htmlContent = String(email.htmlContent || "");

  const fullName =
    subscriber.name ||
    [subscriber.first_name, subscriber.last_name].filter(Boolean).join(" ").trim() ||
    "";

  const tokens = {
    "{email}": subscriber.email || "",
    "{name}": fullName,
    "{first_name}": subscriber.first_name || (fullName.split(" ")[0] || ""),
    "{last_name}": subscriber.last_name || "",
    "{company}": subscriber.company || "",
    "{phone}": subscriber.phone || "",
    ...(subscriber.custom_fields || {}),
    ...(email.dynamicTokens || {}),
  };

  Object.entries(tokens).forEach(([token, value]) => {
    // Escape token for regex
    const safe = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    htmlContent = htmlContent.replace(new RegExp(safe, "g"), String(value ?? ""));
  });

  return {
    to: subscriber.email,
    subject: email.subject,
    html: htmlContent,
    leadId: subscriber.id,
  };
}

function buildRecipientList(subscribers) {
  return (subscribers || []).map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name || "",
    first_name: s.first_name || "",
    last_name: s.last_name || "",
    company: s.company || "",
    phone: s.phone || "",
    custom_fields: s.custom_fields || {},
  }));
}

function getcampaignsTimeline(campaigns) {
  return campaigns.emails.map((email, idx) => {
    const sendTime = calculateSendTime(campaigns.startDate, email.schedule);
    return {
      position: idx + 1,
      date: sendTime,
      subject: email.subject,
      schedule: email.schedule,
      daysFromStart: Math.ceil((sendTime - new Date(campaigns.startDate)) / (24 * 60 * 60 * 1000)),
    };
  });
}

module.exports = {
  schedulecampaigns,
  validatecampaignscheduling,
  prepareEmailForSubscriber,
  buildRecipientList,
  getcampaignsTimeline,
};
