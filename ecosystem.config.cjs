module.exports = {
  apps: [
    {
      name: "email-campaign-worker",
      script: "./scripts/workers/emailCampaignWorker.mjs",
      node_args: "--env-file=.env.local",
      interpreter: "node",
      exec_mode: "fork",
    },
    {
      name: "sms-queue-flusher",
      script: "./scripts/flush-sms-queue.js",
      node_args: "--env-file=.env.local",
      interpreter: "node",
      exec_mode: "fork",
    },
  ],
};
