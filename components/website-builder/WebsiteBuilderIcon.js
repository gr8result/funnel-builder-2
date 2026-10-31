import React from "react";
import { BarChart3, Check, Globe, Mail, PartyPopper, Settings, Star, X } from "lucide-react";

const icons = { chart: BarChart3, check: Check, globe: Globe, mail: Mail, celebration: PartyPopper, settings: Settings, star: Star, close: X };

// SVG icons inherit the surrounding text size and colour without an icon font.
export default function WebsiteBuilderIcon({ name }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" focusable="false" width="1em" height="1em" fill={name === "star" ? "currentColor" : "none"} style={{ display: "inline-block", verticalAlign: "-0.125em" }} />;
}
