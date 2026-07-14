export function defaultLuxuryProposalTheme(client = {}) {
  const builder = client.companyName || "Your Building Team";
  return {
    name: "Luxury Residential Proposal",
    accentColor: "#c89d4a",
    logoUrl: client.logoUrl || "",
    heroImageUrl: client.heroImageUrl || "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1500&q=80",
    aboutImageUrl: client.showcaseImages?.[0] || "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1400&q=80",
    aboutDetailImageUrl: client.showcaseImages?.[1] || "",
    projectInfoImageUrl: client.showcaseImages?.[2] || "",
    whyImageUrl: client.showcaseImages?.[3] || "",
    designImageUrl: client.designImages?.[0] || "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1500&q=80",
    thankYouImageUrl: client.finalImageUrl || client.heroImageUrl || "",
    clientNameOverride: "",
    siteAddressOverride: "",
    companyStory: client.aboutUs || "We understand that building a home is about far more than bricks and mortar. It is about creating a place where your family will make memories for years to come. Our commitment is to deliver a home built with craftsmanship, honesty and clear communication every step of the way.",
    testimonial: client.testimonial || "",
    designNotes: client.projectDesignIntro || "The proposed scope is shaped around the plans, selections, site requirements, and the lifestyle outcome the client wants to achieve.",
    acceptanceNote: client.terms || "Acceptance is subject to final contract documentation, confirmed selections, site conditions, authority requirements, engineering and any agreed variations.",
    thankYouMessage: client.thankYouText || `Thank you for considering ${builder}. We appreciate the opportunity to help bring this project to life.`,
    stats: [
      { value: "18+", label: "Years Experience" },
      { value: "250+", label: "Homes Completed" },
      { value: "98%", label: "Client Happiness" },
      { value: "4.9/5", label: "Average Rating" },
    ],
  };
}

export function money(value) {
  return value ? `$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
}

export function hasProjectInfoValue(value) {
  const text = String(value ?? "").trim();
  return Boolean(text) && text.toLowerCase() !== "not entered";
}
