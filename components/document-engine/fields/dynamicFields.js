import { DEFAULT_BUILDER_TEMPLATE_BRAND } from "../../../lib/builders/defaultTemplateBrand.js";

export const FIELD_FALLBACK = "Not entered";

export const DYNAMIC_FIELDS = {
  PROJECT_NAME: {
    id: "PROJECT_NAME",
    label: "Project Name",
    workbookKey: "projectName",
    path: "workbook.data.inputDataSheet.rows.projectName.value",
    fallback: FIELD_FALLBACK,
  },
  OWNER_NAME: {
    id: "OWNER_NAME",
    label: "Owner Name",
    workbookKey: "clientName",
    path: "workbook.data.inputDataSheet.rows.clientName.value",
    fallback: FIELD_FALLBACK,
  },
  CLIENT_NAME: {
    id: "CLIENT_NAME",
    label: "Client Name",
    workbookKey: "clientName",
    path: "workbook.data.inputDataSheet.rows.clientName.value",
    fallback: FIELD_FALLBACK,
  },
  SITE_ADDRESS: {
    id: "SITE_ADDRESS",
    label: "Site Address",
    workbookKey: "projectAddress",
    path: "workbook.data.inputDataSheet.rows.projectAddress.value",
    fallback: FIELD_FALLBACK,
  },
  JOB_NUMBER: {
    id: "JOB_NUMBER",
    label: "Job Number",
    workbookKey: "jobNumber",
    path: "workbook.data.inputDataSheet.rows.jobNumber.value",
    fallback: FIELD_FALLBACK,
  },
  QUOTE_NUMBER: {
    id: "QUOTE_NUMBER",
    label: "Quote Number",
    workbookKey: "jobNumber",
    path: "workbook.data.inputDataSheet.rows.jobNumber.value",
    fallback: FIELD_FALLBACK,
  },
  QUOTE_DATE: {
    id: "QUOTE_DATE",
    label: "Quote Date",
    workbookKey: "quoteDate",
    path: "workbook.data.inputDataSheet.rows.quoteDate.value",
    fallback: FIELD_FALLBACK,
  },
  BUILDER_NAME: {
    id: "BUILDER_NAME",
    label: "Builder",
    workbookKey: "builderName",
    path: "workbook.data.inputDataSheet.rows.builderName.value",
    fallback: DEFAULT_BUILDER_TEMPLATE_BRAND.name,
  },
  COMPANY_NAME: {
    id: "COMPANY_NAME",
    label: "Company Name",
    workbookKey: "builderName",
    path: "workbook.data.inputDataSheet.rows.builderName.value",
    fallback: DEFAULT_BUILDER_TEMPLATE_BRAND.name,
  },
  ESTIMATOR_NAME: {
    id: "ESTIMATOR_NAME",
    label: "Estimator",
    workbookKey: "estimatorName",
    path: "workbook.data.inputDataSheet.rows.estimatorName.value",
    fallback: FIELD_FALLBACK,
  },
  PROJECT_STATUS: {
    id: "PROJECT_STATUS",
    label: "Status",
    workbookKey: "projectStatus",
    path: "workbook.data.inputDataSheet.rows.projectStatus.value",
    fallback: FIELD_FALLBACK,
  },
  QUOTE_TOTAL: {
    id: "QUOTE_TOTAL",
    label: "Quote Total",
    workbookKey: "preview.summary.finalQuoteTotal",
    path: "workbook.preview.summary.finalQuoteTotal",
    fallback: FIELD_FALLBACK,
  },
  EXPIRY_DATE: {
    id: "EXPIRY_DATE",
    label: "Expiry Date",
    workbookKey: null,
    path: null,
    fallback: FIELD_FALLBACK,
  },
  COMPANY_LOGO: {
    id: "COMPANY_LOGO",
    label: "Company Logo",
    workbookKey: null,
    path: null,
    fallback: DEFAULT_BUILDER_TEMPLATE_BRAND.logoUrl,
  },
  COMPANY_ADDRESS: {
    id: "COMPANY_ADDRESS",
    label: "Company Address",
    workbookKey: null,
    path: null,
    fallback: DEFAULT_BUILDER_TEMPLATE_BRAND.legalName,
  },
};

export function listDynamicFields() {
  return Object.values(DYNAMIC_FIELDS);
}
