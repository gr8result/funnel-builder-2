import React from "react";
import WhatYoudPayElsewhere from "../../../components/WhatYoudPayElsewhere";
import { COMPETITOR_COMPARISON_TEMPLATE_PROPS } from "../../../lib/website-builder/pageBlockComponents";

export default function PricingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#121c26" }}>
      <WhatYoudPayElsewhere
        {...COMPETITOR_COMPARISON_TEMPLATE_PROPS}
      />
    </div>
  );
}