// /pages/api/calendar/create-service.js

import { createClient } from "@supabase/supabase-js";
import { getCalendarPlanServer } from "../../../lib/calendar/getCalendarPlanServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function buildCalendarUsagePolicy(used, limit) {
  if (!Number.isFinite(limit) || limit <= 0) {
    return {
      stage: "ok",
      level: "ok",
      shouldWarn: false,
      shouldBlock: false,
      percent: 0,
      message: "Calendar capacity is unlimited on this plan.",
      upgradePath: "/modules/billing/calendar-plans",
    };
  }

  const pct = Math.round((Number(used || 0) / limit) * 100);

  if (pct >= 100) {
    return {
      stage: "hard-stop",
      level: "critical",
      shouldWarn: true,
      shouldBlock: true,
      percent: pct,
      message: `Calendar hard stop: ${pct}% of capacity used. Upgrade required to add more services.`,
      upgradePath: "/modules/billing/calendar-plans",
    };
  }

  if (pct >= 95) {
    return {
      stage: "critical-warning",
      level: "critical",
      shouldWarn: true,
      shouldBlock: false,
      percent: pct,
      message: `Calendar critical warning: ${pct}% of service capacity used.`,
      upgradePath: "/modules/billing/calendar-plans",
    };
  }

  if (pct >= 80) {
    return {
      stage: "early-warning",
      level: "warning",
      shouldWarn: true,
      shouldBlock: false,
      percent: pct,
      message: `Calendar usage notice: ${pct}% of service capacity used.`,
      upgradePath: "/modules/billing/calendar-plans",
    };
  }

  return {
    stage: "ok",
    level: "ok",
    shouldWarn: false,
    shouldBlock: false,
    percent: pct,
    message: `Calendar usage is healthy at ${pct}%.`,
    upgradePath: "/modules/billing/calendar-plans",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: "Invalid user" });
  }

  const { config, hasAccess } = await getCalendarPlanServer(user.id);

  if (!hasAccess) {
    return res.status(403).json({
      error: "Calendar module is not active. Please choose a calendar plan in billing.",
    });
  }

  const { data: existing } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("user_id", user.id);

  const currentCount = existing?.length || 0;
  const projectedCount = currentCount + 1;
  const limit = config?.calendars;
  const policy = buildCalendarUsagePolicy(projectedCount, limit);

  if (
    config.calendars !== Infinity &&
    currentCount >= config.calendars
  ) {
    return res.status(403).json({
      error: "Calendar limit reached. Please upgrade your plan.",
      policy,
    });
  }

  const { name, duration_minutes, price } = req.body;

  const { error } = await supabaseAdmin.from("services").insert({
    user_id: user.id,
    name,
    duration_minutes,
    price,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    usage: {
      used: projectedCount,
      limit,
      percentage: Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.round((projectedCount / limit) * 100)) : 0,
      policy,
    },
  });
}