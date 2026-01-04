// /components/crm/SubscriberAvatar.js
// Avatar display component that supports shapes + emoji + color

import React from "react";
import { getAvatarForLead } from "/utils/avatar";

export default function SubscriberAvatar(props) {
  const {
    lead,
    size = 32,
    fontSize,
    name,
    email,
    avatarIcon,
    avatarColor,
  } = props;

  const mergedLead = lead || {
    name: name || "",
    email: email || "",
    avatar_icon: avatarIcon,
    avatar_color: avatarColor,
  };

  const { emoji, color, shape } = getAvatarForLead(mergedLead);
  const fs = fontSize || Math.round(size * 0.55);

  // Shape-specific styles
  const shapeStyle = (() => {
    switch (shape) {
      case "square":
        return { borderRadius: "6px" };
      case "diamond":
        return {
          transform: "rotate(45deg)",
          borderRadius: "6px",
        };
      case "hex":
        return {
          clipPath:
            "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
        };
      case "circle":
      default:
        return { borderRadius: "999px" };
    }
  })();

  return (
    <span
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fs,
        background: color,
        boxShadow: "0 0 0 2px rgba(15,23,42,0.85)",
        color: "#0b1120",
        flexShrink: 0,
        ...shapeStyle,
      }}
      title={mergedLead?.name || mergedLead?.email || "Subscriber"}
    >
      {/* Fix emoji orientation when diamond rotates */}
      <span
        style={{
          transform: shape === "diamond" ? "rotate(-45deg)" : "none",
        }}
      >
        {emoji}
      </span>
    </span>
  );
}
