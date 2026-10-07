import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import styles from "./pipelineStyles";
import LeadCard from "./LeadCard";

export default function StageColumn({
  stage,
  leads,
  collapsed,
  onToggleCollapse,
  isCompactMode,
  onLeadOpen,
  cardStyle,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  if (collapsed)
    return (
      <div
        onClick={onToggleCollapse}
        style={{
          ...styles.columnCollapsed,
          borderRight: `5px solid ${stage.color}`,
        }}
      >
        <div
          style={{
            ...styles.collapsedText,
            color: stage.color,
          }}
        >
          {stage.title} ({leads.length})
        </div>
      </div>
    );

  return (
    <div
      ref={setNodeRef}
      style={{
        ...styles.column,
        border: `1px solid ${stage.color}`,
        background: isOver
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.04)",
      }}
    >
      <div style={styles.columnHeader}>
        <h3 style={{ margin: 0, color: stage.color }}>
          {stage.title} ({leads.length})
        </h3>

        <button onClick={onToggleCollapse} style={styles.collapseBtn}>
          ➖
        </button>
      </div>

      <SortableContext
        items={leads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div style={styles.cardList}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              color={stage.color}
              isCompactMode={isCompactMode}
              onOpen={() => onLeadOpen && onLeadOpen(lead)}
              cardStyle={cardStyle}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
