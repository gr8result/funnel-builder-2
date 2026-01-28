import { Handle, Position } from "reactflow";

export default function ConditionNode({ data }) {
  const c = data.condition || {};
  const conditionType = c.type || "";
  const count = Number(data?.count ?? 0);
  const activeMembers = Number(data?.activeMembers ?? 0);
  const hoursRemaining = data?.hoursRemaining;
  const waitHours = data?.waitHours || c.waitHours || 24;

  // Build descriptive summary based on condition type
  let summary = "No condition set";
  let waitingFor = "";

  switch (conditionType) {
    case "email_opened":
      summary = "Email Opened";
      waitingFor = activeMembers > 0 ? `⏳ Waiting ${waitHours}h for email open` : "";
      break;
    case "link_clicked":
      summary = "Link Clicked";
      waitingFor = activeMembers > 0 ? `⏳ Waiting for link click: ${c.url || "?"}` : "";
      break;
    case "tag_exists":
      summary = `Has Tag: ${c.tag || "?"}`;
      waitingFor = activeMembers > 0 ? `⏳ Checking tag: ${c.tag}` : "";
      break;
    case "tag_not_exists":
      summary = `Missing Tag: ${c.tag || "?"}`;
      waitingFor = activeMembers > 0 ? `⏳ Checking tag absence: ${c.tag}` : "";
      break;
    case "field_equals":
      summary = `${c.field || "Field"} = ${c.value || "?"}`;
      waitingFor = activeMembers > 0 ? `⏳ Checking field ${c.field}` : "";
      break;
    case "field_contains":
      summary = `${c.field || "Field"} contains ${c.value || "?"}`;
      waitingFor = activeMembers > 0 ? `⏳ Checking field ${c.field}` : "";
      break;
    case "field_starts_with":
      summary = `${c.field || "Field"} starts with ${c.value || "?"}`;
      waitingFor = activeMembers > 0 ? `⏳ Checking field ${c.field}` : "";
      break;
    case "field_ends_with":
      summary = `${c.field || "Field"} ends with ${c.value || "?"}`;
      waitingFor = activeMembers > 0 ? `⏳ Checking field ${c.field}` : "";
      break;
    case "product_purchased":
      summary = `Purchased: ${c.productName || "?"}`;
      waitingFor = activeMembers > 0 ? `⏳ Waiting for purchase: ${c.productName}` : "";
      break;
    case "event":
      summary = `Event: ${c.eventName || "?"}`;
      waitingFor = activeMembers > 0 ? `⏳ Waiting for event: ${c.eventName}` : "";
      break;
    case "abandoned_cart":
      summary = `Abandoned Cart (${c.cartTimeout || 30}m)`;
      waitingFor = activeMembers > 0 ? `⏳ Waiting ${c.cartTimeout}m for cart activity` : "";
      break;
    default:
      summary = conditionType || "No condition set";
      break;
  }

  // Format time display
  let timeDisplay = "";
  if (hoursRemaining !== undefined && hoursRemaining !== null) {
    if (hoursRemaining < 1) {
      const mins = Math.ceil(hoursRemaining * 60);
      timeDisplay = `${mins}m left`;
    } else {
      timeDisplay = `${hoursRemaining}h left`;
    }
  }

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        background: data.color || "#a855f7",
        color: "#fff",
        width: 300,
        textAlign: "center",
        boxShadow: "0 0 12px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ fontSize: 24 }}>🔀 Condition</div>

      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600 }}>
        {data.label || "Condition"}
      </div>

      <div style={{ marginTop: 2, fontSize: 14, opacity: 0.85, lineHeight: 1.3 }}>
        {summary}
      </div>

      {/* Active members badge */}
      {activeMembers > 0 && (
        <div
          style={{
            marginTop: 8,
            background: "rgba(2,6,23,0.35)",
            border: "1px solid rgba(2,6,23,0.45)",
            color: "#e5e7eb",
            padding: "4px 8px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          👥 {activeMembers} waiting
        </div>
      )}

      {/* What they're waiting for */}
      {waitingFor && (
        <div
          style={{
            marginTop: 6,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fef3c7",
            padding: "6px 10px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 11,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {waitingFor}
        </div>
      )}

      {/* Time remaining badge */}
      {timeDisplay && (
        <div
          style={{
            marginTop: 6,
            background: "rgba(255,193,7,0.2)",
            border: "1px solid rgba(255,193,7,0.4)",
            color: "#fbbf24",
            padding: "4px 8px",
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          ⏱️ {timeDisplay}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 16,
          height: 16,
          background: "#fff",
          border: "2px solid #000",
        }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{
          width: 16,
          height: 16,
          background: "#22c55e",
          border: "2px solid #000",
          position: "absolute",
          left: 40,
        }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{
          width: 16,
          height: 16,
          background: "#ef4444",
          border: "2px solid #000",
          position: "absolute",
          right: 40,
        }}
      />
    </div>
  );
}
