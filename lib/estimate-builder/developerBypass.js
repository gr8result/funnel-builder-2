const OWNER_TESTING_EMAIL = "support@gr8result.com";

// DEV ONLY / OWNER TESTING BYPASS:
// This must stay limited to the owner support account so normal users keep the
// regular estimate job credit and payment workflow.
export function isDeveloperAccount(email = "") {
  return String(email || "").trim().toLowerCase() === OWNER_TESTING_EMAIL;
}

export function estimateJobsRemainingLabel(email, credits = 0) {
  if (isDeveloperAccount(email)) return "Unlimited";
  const count = Number(credits) || 0;
  return `${count} ${count === 1 ? "job" : "jobs"} remaining`;
}
