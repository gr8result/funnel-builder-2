// This config lives in deploy/; every app runs from the repository root so the
// "./scripts/..." paths and .env.local below resolve exactly as they did when
// this file sat at the root.
const path = require("path");
const repoRoot = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "email-campaign-worker",
      cwd: repoRoot,
      script: "./scripts/workers/emailCampaignWorker.mjs",
      node_args: "--env-file=.env.local",
      interpreter: "node",
      exec_mode: "fork",
    },
    {
      name: "sms-queue-flusher",
      cwd: repoRoot,
      script: "./scripts/flush-sms-queue.js",
      node_args: "--env-file=.env.local",
      interpreter: "node",
      exec_mode: "fork",
    },
  ],
};
