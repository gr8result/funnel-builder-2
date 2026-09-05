import applianceCatalogue from "../../data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json";
import appliancePackCatalogue from "../../data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json";
import applianceBrandCatalogue from "../../data/product-library/catalogues/appliances/AU-APPLIANCE-BRANDS.json";
import {
  APPLIANCE_ELIGIBILITY_STATES,
  APPLIANCE_FAMILIES,
  APPLIANCE_IMAGE_FALLBACK_LABEL,
  applianceProductToCatalogueRecord,
  createApplianceCatalogueSelectors,
  filterApplianceRecords,
  resolveApplianceCatalogueEligibility,
} from "./applianceCatalogueSelectorsCore.js";

const selectors = createApplianceCatalogueSelectors({
  productCatalogue: applianceCatalogue,
  packCatalogue: appliancePackCatalogue,
  brandCatalogue: applianceBrandCatalogue,
});

export {
  APPLIANCE_ELIGIBILITY_STATES,
  APPLIANCE_FAMILIES,
  APPLIANCE_IMAGE_FALLBACK_LABEL,
  applianceProductToCatalogueRecord,
  filterApplianceRecords,
  resolveApplianceCatalogueEligibility,
};

export const getPlatformMasterApplianceRecords = selectors.getPlatformMasterApplianceRecords;
export const getAdministrativeApplianceRecords = selectors.getAdministrativeApplianceRecords;
export const getActiveProductLibraryApplianceRecords = selectors.getActiveProductLibraryApplianceRecords;
export const getClientSelectableApplianceRecords = selectors.getClientSelectableApplianceRecords;
export const getClientVisibleApplianceRecords = selectors.getClientVisibleApplianceRecords;
export const getLegacyQuotationCompatibleApplianceRecords = selectors.getLegacyQuotationCompatibleApplianceRecords;
export const getApplianceRecordsRequiringVerification = selectors.getApplianceRecordsRequiringVerification;
export const getTenantSpecificApplianceRecords = selectors.getTenantSpecificApplianceRecords;
export const getApplianceFamilies = selectors.getApplianceFamilies;
export const getApplianceRecordsByFamily = selectors.getApplianceRecordsByFamily;
export const getApplianceBrands = selectors.getApplianceBrands;
export const getApplianceBrandByName = selectors.getApplianceBrandByName;
export const getApplianceBrandsByFamily = selectors.getApplianceBrandsByFamily;
export const getApplianceModelsByFamilyAndBrand = selectors.getApplianceModelsByFamilyAndBrand;
export const getApplianceProductById = selectors.getApplianceProductById;
export const getAppliancePacks = selectors.getAppliancePacks;
