import { STANDARD_PAGE_KEYS, standardInclusionsData } from "../../standard-inclusions/standardInclusionsData";

export { STANDARD_PAGE_KEYS };

export function standardDocumentPages(pkg = {}) {
  return {
    intro: {
      image_url: standardInclusionsData.page02PremierIntroduction.imageUrl,
      heading: standardInclusionsData.page02PremierIntroduction.heading,
      intro: standardInclusionsData.page02PremierIntroduction.intro,
      ...(pkg.document_pages?.intro || {}),
    },
    living: {
      image_url: standardInclusionsData.page03CreatingHomes.imageUrl,
      heading: standardInclusionsData.page03CreatingHomes.heading,
      intro: standardInclusionsData.page03CreatingHomes.intro,
      callouts: standardInclusionsData.page03CreatingHomes.callouts || [],
      ...(pkg.document_pages?.living || {}),
    },
    selections: {
      image_url: standardInclusionsData.page04DesignedForLiving.imageUrl,
      heading: standardInclusionsData.page04DesignedForLiving.heading,
      intro: standardInclusionsData.page04DesignedForLiving.intro,
      ...(pkg.document_pages?.selections || {}),
    },
    specification: {
      image_url: standardInclusionsData.page05ConstructionInclusions.imageUrl,
      heading: standardInclusionsData.page05ConstructionInclusions.heading,
      intro: "",
      images: [],
      ...(pkg.document_pages?.specification || {}),
    },
  };
}
