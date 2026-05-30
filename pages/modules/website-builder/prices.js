import React from "react";
import WhatYoudPayElsewhere from "../../../components/WhatYoudPayElsewhere";

const rows = [
  { category: "CRM & PIPELINE MANAGEMENT",  logos: [{ domain: "hubspot.com", name: "HubSpot" }, { domain: "salesforce.com", name: "Salesforce" }, { domain: "pipedrive.com", name: "Pipedrive" }],             price: 97 },
  { category: "EMAIL MARKETING",             logos: [{ domain: "mailchimp.com", name: "Mailchimp" }, { domain: "activecampaign.com", name: "ActiveCampaign" }, { domain: "klaviyo.com", name: "Klaviyo" }],     price: 99 },
  { category: "FUNNELS & WEBSITE BUILDER",   logos: [{ domain: "clickfunnels.com", name: "ClickFunnels" }, { domain: "leadpages.com", name: "Leadpages" }, { domain: "unbounce.com", name: "Unbounce" }],       price: 97 },
  { category: "2-WAY SMS MARKETING",         logos: [{ domain: "twilio.com", name: "Twilio" }, { domain: "simpletexting.com", name: "SimpleTexting" }, { domain: "attentivemobile.com", name: "Attentive" }],  price: 89 },
  { category: "BOOKING & APPOINTMENTS",      logos: [{ domain: "calendly.com", name: "Calendly" }, { domain: "acuityscheduling.com", name: "Acuity" }, { domain: "squareup.com", name: "Square" }],             price: 29 },
  { category: "WORKFLOW AUTOMATIONS",        logos: [{ domain: "hubspot.com", name: "HubSpot" }, { domain: "zapier.com", name: "Zapier" }, { domain: "keap.com", name: "Keap" }],                               price: 169 },
  { category: "COURSES / PRODUCTS",          logos: [{ domain: "teachable.com", name: "Teachable" }, { domain: "kajabi.com", name: "Kajabi" }, { domain: "thinkific.com", name: "Thinkific" }],                 price: 99 },
  { category: "CALL TRACKING",               logos: [{ domain: "callrail.com", name: "CallRail" }, { domain: "twilio.com", name: "Twilio" }],                                                                   price: 49 },
  { category: "REPUTATION MANAGEMENT",       logos: [{ domain: "birdeye.com", name: "Birdeye" }, { domain: "podium.com", name: "Podium" }, { domain: "grade.us", name: "Grade.us" }],                          price: 159 },
  { category: "TRACKING & ANALYTICS",        logos: [{ domain: "amplitude.com", name: "Amplitude" }, { domain: "mixpanel.com", name: "Mixpanel" }],                                                            price: 299 },
  { category: "COMMUNITIES",                 logos: [{ domain: "skool.com", name: "Skool" }, { domain: "mightynetworks.com", name: "Mighty Networks" }, { domain: "circle.so", name: "Circle" }],              price: 89 },
  { category: "DOCUMENT SIGNING",            logos: [{ domain: "docusign.com", name: "DocuSign" }, { domain: "pandadoc.com", name: "PandaDoc" }],                                                              price: 47 },
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#070c18" }}>
      <WhatYoudPayElsewhere
        rows={rows}
        planName="Gr8 Result Business Plan"
        planPrice={199}
        planTagline="Everything above, included"
        eyebrow="All-in-One Platform"
        title="What you'd pay elsewhere"
        subtitle="Gr8 Result replaces every tool below — one platform, one price."
      />
    </div>
  );
}