// /pages/api/social/schedule-campaign.js
// FULL FILE — distributes posts across calendar

import { requireUser } from "../../../lib/social/auth";

function getNextDates(startDate, daysOfWeek, count, time) {
  const dates = [];
  let current = new Date(startDate);

  while (dates.length < count) {
    if (daysOfWeek.includes(current.getDay())) {
      const d = new Date(current);
      const [h, m] = time.split(":");
      d.setHours(Number(h), Number(m), 0, 0);
      dates.push(new Date(d));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  try {
    const {
      campaign_id,
      days_of_week, // [1,3,5]
      time = "09:00",
      start_date = new Date().toISOString(),
    } = req.body;

    if (!campaign_id || !days_of_week?.length) {
      return res.status(400).json({ ok: false, error: "Missing data" });
    }

    const { data: posts } = await auth.admin
      .from("social_campaign_posts")
      .select("post_id, social_posts(platform)")
      .eq("campaign_id", campaign_id);

    if (!posts?.length) {
      return res.status(400).json({ ok: false, error: "No posts found" });
    }

    const dates = getNextDates(
      start_date,
      days_of_week,
      posts.length,
      time
    );

    const userId = auth.user.id;
    const scheduleRows = [];
    const queueRows = [];

    posts.forEach((p, i) => {
      const scheduled_for = dates[i];

      scheduleRows.push({
        user_id: userId,
        post_id: p.post_id,
        scheduled_for,
        status: "scheduled",
      });

      queueRows.push({
        user_id: userId,
        post_id: p.post_id,
        platform: p.social_posts?.platform || "facebook",
        scheduled_for,
        status: "queued",
      });
    });

    await auth.admin.from("social_schedule").insert(scheduleRows);
    await auth.admin.from("social_queue").insert(queueRows);

    return res.status(200).json({
      ok: true,
      scheduled: scheduleRows.length,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}