import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SubscriberAvatar from "../SubscriberAvatar";
import styles from "./pipelineStyles";
import { parseList, formatMoney } from "./pipelineSharedHelpers";

// helper for card visuals – outline = stage colour
function getCardVisualStyles(styleKey, color) {
  const baseBlue = "#2297c5"; // fallback / legacy

  switch (styleKey) {
    case "glass":
      return {
        background: `linear-gradient(135deg, ${color}aa, rgba(3,7,18,0.95))`,
        border: `2px solid ${color}`,
        boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
        backdropFilter: "blur(10px)",
      };
    case "solid":
      return {
        background: color || baseBlue,
        border: `2px solid ${color || baseBlue}`,
        boxShadow: "0 8px 18px rgba(0,0,0,0.7)",
      };
    case "minimal":
    default:
      return {
        background: "rgba(15,23,42,0.95)",
        borderLeft: `4px solid ${color}`,
        borderRight: "1px solid rgba(255,255,255,0.12)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(0,0,0,0.8)",
        boxShadow: "0 6px 14px rgba(0,0,0,0.6)",
      };
  }
}

/* -------------------------------------------------------------
   LEAD CARD - whole card draggable, inner area clickable
------------------------------------------------------------- */
export default function LeadCard({ lead, color, isCompactMode, onOpen, cardStyle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const visualStyles = getCardVisualStyles(cardStyle, color);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isDragging) return;
    if (onOpen) onOpen();
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...styles.card,
        ...visualStyles,
        opacity: isDragging ? 0.6 : 1,
        cursor: "grab",
      }}
    >
      <div
        style={styles.cardInner}
        onClick={handleClick}
        onDoubleClick={handleClick}
      >
        <span style={styles.dragHandle}>☰</span>

        <SubscriberAvatar lead={lead} size={28} fontSize={16} />

        <div style={{ flex: 1 }}>
          {isCompactMode ? (
            <strong style={styles.textWrap}>{lead.name || "Unnamed"}</strong>
          ) : (
            <>
              <h4 style={styles.textWrap}>{lead.name || "Unnamed"}</h4>
              <p style={styles.textWrap}>{lead.email || ""}</p>
            </>
          )}

          {(lead.crmMeta?.owner || lead.crmMeta?.dealValue || lead.crmMeta?.priority || lead.crmMeta?.tags || lead.crmMeta?.product) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {parseList(lead.crmMeta?.owner).slice(0, 2).map((owner) => (
                <span
                  key={`${lead.id}-${owner}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 16,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "rgba(148,163,184,0.18)",
                    color: "#e2e8f0",
                    maxWidth: "100%",
                  }}
                  title={owner}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(59,130,246,0.25)",
                      color: "#bfdbfe",
                      fontSize: 16,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    👤
                  </span>
                  {owner}
                </span>
              ))}
              {parseList(lead.crmMeta?.owner).length > 2 ? (
                <span style={{ fontSize: 16, padding: "2px 6px", borderRadius: 999, background: "rgba(148,163,184,0.14)", color: "#cbd5e1" }}>
                  +{parseList(lead.crmMeta?.owner).length - 2} more
                </span>
              ) : null}
              {lead.crmMeta?.dealValue ? (
                <span style={{ fontSize: 16, padding: "2px 6px", borderRadius: 999, background: "rgba(34,197,94,0.18)", color: "#bbf7d0" }}>
                  Revenue {formatMoney(lead.crmMeta.dealValue)}
                </span>
              ) : null}
              {lead.crmMeta?.priority ? (
                <span style={{ fontSize: 16, padding: "2px 6px", borderRadius: 999, background: lead.crmMeta.priority === "High" ? "rgba(239,68,68,0.18)" : "rgba(59,130,246,0.18)", color: lead.crmMeta.priority === "High" ? "#fecaca" : "#bfdbfe" }}>
                  {lead.crmMeta.priority}
                </span>
              ) : null}
              {lead.crmMeta?.product ? (
                <span style={{ fontSize: 16, padding: "2px 6px", borderRadius: 999, background: "rgba(168,85,247,0.18)", color: "#e9d5ff" }}>
                  📦 {lead.crmMeta.product}
                </span>
              ) : null}
              {parseList(lead.crmMeta?.tags).slice(0, 2).map((tag) => (
                <span key={`${lead.id}-${tag}`} style={{ fontSize: 16, padding: "2px 6px", borderRadius: 999, background: "rgba(249,115,22,0.16)", color: "#fdba74" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
