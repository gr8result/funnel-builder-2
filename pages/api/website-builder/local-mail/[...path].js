export default function handler(req, res) {
  res.setHeader("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("content-type", "application/json; charset=utf-8");

  return res.status(200).json({
    jsonrpc: "2.0",
    id: null,
    result: {
      channels: [],
      inbox: [],
      menu_id: false,
      needaction_inbox_counter: 0,
      shortcodes: {},
    },
  });
}
