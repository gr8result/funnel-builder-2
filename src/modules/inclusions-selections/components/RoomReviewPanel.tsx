import type { RoomReviewGroup } from "../services/selectionReviewService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function RoomReviewPanel({ groups, onEdit }: { groups: RoomReviewGroup[]; onEdit: (areaId: string, requirementId?: string) => void }) {
  return (
    <section className="reviewPanel">
      {groups.map((group) => <div key={group.groupId} className="reviewGroup"><h2>{group.groupName}</h2>{group.rooms.map((room) => (
        <article key={room.area.id} className="reviewCard">
          <header><h3>{room.area.name}</h3><span>{room.levelName} - {room.areaTypeName}</span></header>
          <div className="reviewMetrics"><span>Tier {room.tierId ?? "Unset"}</span><span>{room.completeRequirements}/{room.totalRequirements} complete</span><span>{currency.format(room.netVariation.amount)} net</span><span>{room.issueCount} issues</span></div>
          <div className="reviewRows">{room.lines.map((line) => <button key={line.requirement.id} type="button" className="reviewRow" onClick={() => onEdit(room.area.id, line.requirement.id)}><strong>{line.requirement.title}</strong><span>{line.requirement.category}</span><span>{line.selectedItem}</span><span>{line.quantity} {line.unit}</span><span>{currency.format(line.variation.amount)}</span><span>{line.pricingStatus.replace(/_/g, " ")}</span></button>)}</div>
        </article>
      ))}</div>)}
    </section>
  );
}
