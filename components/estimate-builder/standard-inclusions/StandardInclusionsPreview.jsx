import { DEFAULT_BUILDER_TEMPLATE_BRAND } from "../../../lib/builders/defaultTemplateBrand";
import StandardInclusionsDocument from "../../standard-inclusions/StandardInclusionsDocument";
import { standardInclusionsData } from "../../standard-inclusions/standardInclusionsData";

export function standardInclusionsCoverValues(pkg = {}, builderProfile = {}) {
  return {
    title: pkg.cover_title || "Premier Range Inclusions",
    subtitle: pkg.cover_subtitle || "Premier Range Inclusions Schedule",
    intro: pkg.intro || standardInclusionsData.page01Cover.intro,
    tagline: pkg.cover_tagline || "Premier range.\nPersonalised by choice.",
    features: Array.isArray(pkg.cover_features) && pkg.cover_features.length ? pkg.cover_features : standardInclusionsData.page01Cover.features,
    heroImage: pkg.cover_image_url || standardInclusionsData.page01Cover.imageUrl,
    builderName: builderProfile.builderName || DEFAULT_BUILDER_TEMPLATE_BRAND.name,
    builderLogo: pkg.builder_logo_url || builderProfile.logoUrl || DEFAULT_BUILDER_TEMPLATE_BRAND.logoUrl,
    footerLogo: pkg.footer_logo_url || pkg.builder_logo_url || builderProfile.logoUrl || DEFAULT_BUILDER_TEMPLATE_BRAND.logoUrl,
    phone: pkg.builder_phone || builderProfile.phone || DEFAULT_BUILDER_TEMPLATE_BRAND.phone,
    website: pkg.builder_website || builderProfile.website || DEFAULT_BUILDER_TEMPLATE_BRAND.website,
  };
}

function pageValue(pkg, pageKey, fallback) {
  const source = pkg?.document_pages?.[pageKey] || {};
  return {
    ...fallback,
    ...(source.image_url ? { imageUrl: source.image_url } : {}),
    ...(source.heading ? { heading: source.heading } : {}),
    ...(source.intro ? { intro: source.intro } : {}),
    ...(Array.isArray(source.callouts) ? { callouts: source.callouts } : {}),
    ...(Array.isArray(source.images) ? { images: source.images } : {}),
  };
}

export default function StandardInclusionsPreview({ data, builderProfile = {}, onImageDoubleClick = null }) {
  const pkg = data.package || {};
  const cover = standardInclusionsCoverValues(pkg, builderProfile);
  const documentData = {
    ...standardInclusionsData,
    builder: {
      ...standardInclusionsData.builder,
      builderName: cover.builderName,
      logoUrl: cover.footerLogo || cover.builderLogo,
      phone: cover.phone,
      website: cover.website,
      packageName: pkg.name || cover.title,
    },
    page01Cover: {
      ...standardInclusionsData.page01Cover,
      title: cover.title,
      subtitle: cover.subtitle,
      imageUrl: cover.heroImage,
      intro: cover.intro,
      tagline: cover.tagline,
      features: cover.features,
    },
    page02PremierIntroduction: pageValue(pkg, "intro", standardInclusionsData.page02PremierIntroduction),
    page03CreatingHomes: pageValue(pkg, "living", standardInclusionsData.page03CreatingHomes),
    page04DesignedForLiving: pageValue(pkg, "selections", standardInclusionsData.page04DesignedForLiving),
    page05ConstructionInclusions: pageValue(pkg, "specification", standardInclusionsData.page05ConstructionInclusions),
    page06SelectionsProcess: standardInclusionsData.page06SelectionsProcess,
  };

  return <StandardInclusionsDocument data={documentData} onImageDoubleClick={onImageDoubleClick} />;
}
