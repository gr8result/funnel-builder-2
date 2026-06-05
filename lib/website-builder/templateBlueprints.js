import {
  attachTeamMemberImages,
  enrichBlueprintImages,
  normalizeBlueprintLinks,
} from "./template-blueprints/core";
import {
  buildAccountingBlueprint,
  buildFitnessBlueprint,
  buildGenericPremiumBlueprint,
  buildHomeRenovationBlueprint,
  buildLawBlueprint,
  buildMedicalBlueprint,
  buildRealEstateBlueprint,
  buildSalonSpaBlueprint,
} from "./template-blueprints/industryBlueprints";
import {
  buildAgencyBlueprint,
  buildCoachBlueprint,
  buildLocalServiceBlueprint,
  buildPortfolioBlueprint,
  buildRestaurantBlueprint,
  buildSaasBlueprint,
  buildServiceFirmBlueprint,
} from "./template-blueprints/serviceFirm";
import {
  buildAutoRepairBlueprint,
  buildCleaningBlueprint,
  buildEcommerceBlueprint,
  buildElectricalBlueprint,
  buildHvacBlueprint,
  buildLandscapingBlueprint,
  buildMortgageBrokerBlueprint,
  buildPestControlBlueprint,
  buildPlumbingBlueprint,
  buildPoolServiceBlueprint,
  buildRoofingBlueprint,
  buildSolarBlueprint,
} from "./template-blueprints/tradeShowcase";

function buildTemplateBlueprintBySlug(templateSlug, profile) {
  const enrichedProfile = { ...profile, templateSlug };
  switch (templateSlug) {
    case "website-generic-premium":
      return buildGenericPremiumBlueprint(enrichedProfile);
    case "website-business-agency":
      return buildAgencyBlueprint(enrichedProfile);
    case "website-coach-personal-brand":
      return buildCoachBlueprint(enrichedProfile);
    case "website-local-service":
      return buildLocalServiceBlueprint(enrichedProfile);
    case "website-saas-simple":
      return buildSaasBlueprint(enrichedProfile);
    case "website-restaurant-cafe":
      return buildRestaurantBlueprint(enrichedProfile);
    case "website-portfolio-creative":
      return buildPortfolioBlueprint(enrichedProfile);
    case "website-medical-clinic":
      return buildMedicalBlueprint(enrichedProfile);
    case "website-law-firm":
      return buildLawBlueprint(enrichedProfile);
    case "website-real-estate":
      return buildRealEstateBlueprint(enrichedProfile);
    case "website-salon-spa":
      return buildSalonSpaBlueprint(enrichedProfile);
    case "website-fitness-gym":
      return buildFitnessBlueprint(enrichedProfile);
    case "website-home-renovation":
      return buildHomeRenovationBlueprint(enrichedProfile);
    case "website-accounting-bookkeeping":
      return buildAccountingBlueprint(enrichedProfile);
    case "website-plumbing-company":
      return buildPlumbingBlueprint(enrichedProfile);
    case "website-electrician-company":
      return buildElectricalBlueprint(enrichedProfile);
    case "website-hvac-air-conditioning":
      return buildHvacBlueprint(enrichedProfile);
    case "website-roofing-company":
      return buildRoofingBlueprint(enrichedProfile);
    case "website-cleaning-services":
      return buildCleaningBlueprint(enrichedProfile);
    case "website-landscaping-lawn-care":
      return buildLandscapingBlueprint(enrichedProfile);
    case "website-pest-control":
      return buildPestControlBlueprint(enrichedProfile);
    case "website-solar-energy":
      return buildSolarBlueprint(enrichedProfile);
    case "website-pool-service":
      return buildPoolServiceBlueprint(enrichedProfile);
    case "website-auto-repair":
      return buildAutoRepairBlueprint(enrichedProfile);
    case "website-mortgage-broker":
      return buildMortgageBrokerBlueprint(enrichedProfile);
    case "website-ecommerce-store":
      return buildEcommerceBlueprint(enrichedProfile);
    default:
      return buildServiceFirmBlueprint(enrichedProfile);
  }
}

export function buildWebsiteTemplateBlueprint(templateSlug, profile) {
  if (!profile) return null;
  const enrichedProfile = attachTeamMemberImages({ ...profile, templateSlug });
  const blueprint = buildTemplateBlueprintBySlug(templateSlug, enrichedProfile);
  return normalizeBlueprintLinks(enrichBlueprintImages(blueprint, enrichedProfile));
}
