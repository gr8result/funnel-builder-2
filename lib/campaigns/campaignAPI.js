// /lib/campaigns/campaignAPI.js
// FULL REPLACEMENT — injects user_id into queue rows

const {
  createCampaign,
  validateCampaign,
} = require("./campaignTypes");

const {
  fetchLeadLists,
  fetchListSubscribers,
  fetchEmailTemplates,
  fetchTemplateContent,
  saveCampaign,
  updateCampaignStatus,
  enqueueCampaignSends,
} = require("./supabaseClient");

const {
  scheduleCampaign,
  validateCampaignScheduling,
  prepareEmailForSubscriber,
} = require("./campaignScheduler");

class CampaignManager {
  constructor(supabase, config = {}) {
    this.supabase = supabase;
    this.config = {
      campaignsTable: "email_campaigns",
      queueTable: "email_campaign_queue",
      leadsTable: "leads",
      ...config,
    };
    this.currentCampaign = null;
  }

  createNewCampaign(data) {
    this.currentCampaign = createCampaign(data);
    return this.currentCampaign;
  }

  updateCampaignStartDate(date) {
    if (this.currentCampaign) {
      this.currentCampaign.startDate = new Date(date);
    }
  }

  async saveCampaign() {
    const validation = validateCampaign(this.currentCampaign);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(", "));
    }

    const saved = await saveCampaign(
      this.supabase,
      this.currentCampaign,
      this.config.campaignsTable
    );

    this.currentCampaign.id = saved.id;
    return saved;
  }

  async scheduleAndEnqueue({ userId }) {
    if (!userId) throw new Error("userId required");

    const check = validateCampaignScheduling(this.currentCampaign);
    if (!check.canSchedule) {
      throw new Error(check.issues.join(", "));
    }

    const jobs = scheduleCampaign(this.currentCampaign);

    const subscribers = await fetchListSubscribers(
      this.supabase,
      this.currentCampaign.leadList.id,
      { leadsTable: this.config.leadsTable }
    );

    const rows = [];

    for (const job of jobs) {
      for (const sub of subscribers) {
        const email = prepareEmailForSubscriber(
          {
            subject: job.subject,
            htmlContent: job.htmlContent,
          },
          sub
        );

        if (!email.to) continue;

        rows.push({
          user_id: userId,                 // ✅ FIX
          campaign_id: this.currentCampaign.id,
          email_position: job.emailPosition,
          lead_id: sub.id,
          to_email: email.to,
          subject: email.subject,
          html: email.html,
          send_at: job.sendTime,
          status: "scheduled",
          attempts: 0,
          created_at: new Date().toISOString(),
        });
      }
    }

    await enqueueCampaignSends(
      this.supabase,
      rows,
      this.config.queueTable
    );

    await updateCampaignStatus(
      this.supabase,
      this.currentCampaign.id,
      "scheduled",
      this.config.campaignsTable
    );

    return { queued: rows.length };
  }
}

module.exports = { CampaignManager };
