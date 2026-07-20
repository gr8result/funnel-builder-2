import React from "react";
import type { TakeoffObject, TakeoffPage } from "../state/takeoffTypes";

export default function OverlayRenderer({
  page,
  selectedObjectId,
  showAiObjects = false,
}: {
  page: TakeoffPage | null;
  selectedObjectId?: string | null;
  showAiObjects?: boolean;
}) {
  if (!page) return null;
  const objects = (page.objects || []).filter((object) => {
    if (object.status === "rejected") return false;
    if (object.source === "ai") return showAiObjects;
    return page.scaleStatus === "confirmed";
  });
  return (
    <svg style={styles.layer} aria-hidden="true">
      {objects.map((object) => <ObjectShape key={object.id} object={object} selected={object.id === selectedObjectId} />)}
    </svg>
  );
}

function ObjectShape({ object, selected }: { object: TakeoffObject; selected: boolean }) {
  const points = object.points || [];
  const stroke = colourForObject(object);
  const strokeWidth = selected ? 4 : 2.5;
  if (object.type === "room" || object.type === "column") {
    const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(" ");
    return (
      <g>
        <polygon
          points={polygonPoints}
          fill={object.type === "room" ? "rgba(16, 185, 129, 0.18)" : "rgba(168, 85, 247, 0.2)"}
          stroke={stroke}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
        {selected ? points.map((point, index) => <Handle key={index} point={point} />) : null}
      </g>
    );
  }
  if (points.length >= 2) {
    return (
      <g>
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={object.status === "detected" ? "8 5" : undefined}
        />
        {selected ? points.map((point, index) => <Handle key={index} point={point} />) : null}
      </g>
    );
  }
  return null;
}

function Handle({ point }: { point: { x: number; y: number } }) {
  return <circle cx={point.x} cy={point.y} r={5} fill="#ffffff" stroke="#0f172a" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
}

function colourForObject(object: TakeoffObject) {
  if (object.displayColour && !object.displayColour.startsWith("rgba")) return object.displayColour;
  if (object.type === "wall" && object.wallType === "exterior") return "#16a34a";
  if (object.type === "wall" && object.wallType === "interior") return "#2563eb";
  if (object.type === "room") return "#10b981";
  if (object.type === "door") return "#f97316";
  if (object.type === "window") return "#0ea5e9";
  if (object.type === "opening") return "#a855f7";
  if (object.type === "measurement") return "#ea580c";
  return "#334155";
}

const styles: Record<string, React.CSSProperties> = {
  layer: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    overflow: "hidden",
  },
};
