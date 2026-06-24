export const VAULT_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "under_review",
  "verified",
  "needs_attention",
];

export const VAULT_STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  under_review: "Under Review",
  verified: "Verified",
  needs_attention: "Needs Attention",
};

export const PROOF_OF_ADDRESS_DOCUMENT_TYPES = [
  "Electricity Bill",
  "Phone Bill",
  "Internet Bill",
  "Rates Notice",
  "Lease Agreement",
  "Supplier Invoice",
];

export const BUSINESS_PROFILE_SECTIONS = [
  {
    key: "account_holder_verification",
    title: "Account Holder Verification",
    description: "Identity and contact details for the primary account holder.",
    fields: [
      { key: "fullLegalName", label: "Full Legal Name", type: "text", required: true },
      { key: "positionRole", label: "Position / Role", type: "text", required: true },
      { key: "mobileNumber", label: "Mobile Number", type: "tel", required: true },
      { key: "smsVerificationStatus", label: "SMS Verification Status", type: "status", readOnly: true },
      { key: "emailAddress", label: "Email Address", type: "email", required: true },
      { key: "emailVerificationStatus", label: "Email Verification Status", type: "status", readOnly: true },
      { key: "driversLicenceUpload", label: "Driver's Licence Upload", type: "file", required: true },
      { key: "passportUpload", label: "Passport Upload", type: "file" },
      { key: "idType", label: "ID Type", type: "select", required: true, options: ["Driver's Licence", "Passport", "National ID", "Other"] },
      { key: "idNumber", label: "ID Number", type: "text", required: true },
      { key: "expiryDate", label: "Expiry Date", type: "date", required: true },
    ],
  },
  {
    key: "business_information",
    title: "Business Information",
    description: "Legal, trading, tax, contact, and registration details.",
    fields: [
      { key: "legalBusinessName", label: "Legal Business Name", type: "text", required: true },
      { key: "tradingName", label: "Trading Name", type: "text" },
      { key: "abn", label: "ABN", type: "text" },
      { key: "acn", label: "ACN", type: "text" },
      { key: "businessStructure", label: "Business Structure", type: "select", required: true, options: ["Sole Trader", "Company", "Partnership", "Trust", "Non-profit", "Other"] },
      { key: "industry", label: "Industry", type: "text", required: true },
      { key: "businessPhone", label: "Business Phone", type: "tel" },
      { key: "businessEmail", label: "Business Email", type: "email", required: true },
      { key: "websiteUrl", label: "Website URL", type: "url" },
      { key: "businessAddress", label: "Business Address", type: "textarea", required: true },
      { key: "postalAddress", label: "Postal Address", type: "textarea" },
      { key: "businessRegistrationCertificateUpload", label: "Business Registration Certificate Upload", type: "file" },
    ],
  },
  {
    key: "proof_of_address",
    title: "Proof Of Address",
    description: "A recent document that confirms the business or account holder address.",
    fields: [
      { key: "proofOfAddressUpload", label: "Proof Of Address Upload", type: "file", required: true },
      { key: "documentType", label: "Document Type", type: "select", required: true, options: PROOF_OF_ADDRESS_DOCUMENT_TYPES },
      { key: "uploadDate", label: "Upload Date", type: "date", readOnly: true },
      { key: "verificationStatus", label: "Verification Status", type: "status", readOnly: true },
    ],
  },
  {
    key: "website_domain_information",
    title: "Website & Domain Information",
    description: "Access details needed for website setup, hosting, DNS, and launch support.",
    fields: [
      { key: "websiteUrl", label: "Website URL", type: "url" },
      { key: "domainRegistrar", label: "Domain Registrar", type: "text" },
      { key: "hostingProvider", label: "Hosting Provider", type: "text" },
      { key: "registrarLoginAvailable", label: "Registrar Login Available", type: "boolean" },
      { key: "hostingLoginAvailable", label: "Hosting Login Available", type: "boolean" },
      { key: "dnsAccessAvailable", label: "DNS Access Available", type: "boolean" },
      { key: "dnsAssistanceRequired", label: "DNS Assistance Required", type: "boolean" },
      { key: "websiteNotes", label: "Website Notes", type: "textarea" },
    ],
  },
  {
    key: "existing_software_migration",
    title: "Existing Software & Migration",
    description: "Current tools and migration requirements for setup planning.",
    fields: [
      { key: "currentCrm", label: "Current CRM", type: "text" },
      { key: "currentEmailMarketingPlatform", label: "Current Email Marketing Platform", type: "text" },
      { key: "currentSmsPlatform", label: "Current SMS Platform", type: "text" },
      { key: "currentWebsiteBuilder", label: "Current Website Builder", type: "text" },
      { key: "currentBookingSystem", label: "Current Booking System", type: "text" },
      { key: "currentAutomationPlatform", label: "Current Automation Platform", type: "text" },
      { key: "dataMigrationRequired", label: "Data Migration Required", type: "boolean" },
      { key: "migrationNotes", label: "Migration Notes", type: "textarea" },
    ],
  },
  {
    key: "email_sending_domain",
    title: "Email Sending Domain & DKIM",
    description: "Details needed to request and configure DKIM/SPF records with the email provider.",
    fields: [
      { key: "sendingDomain", label: "Sending Domain", type: "text", required: true },
      { key: "defaultFromName", label: "Default From Name", type: "text", required: true },
      { key: "defaultFromEmail", label: "Default From Email", type: "email", required: true },
      { key: "replyToEmail", label: "Reply-To Email", type: "email" },
      { key: "dnsProvider", label: "DNS Provider / Registrar", type: "text" },
      { key: "dnsAccessAvailable", label: "DNS Access Available", type: "boolean" },
      { key: "dkimRequestStatus", label: "DKIM Request Status", type: "status", readOnly: true },
      { key: "dkimRecords", label: "DKIM / SPF Records Supplied", type: "textarea" },
      { key: "emailProviderNotes", label: "Email Provider Notes", type: "textarea" },
    ],
  },
  {
    key: "sms_activation",
    title: "SMS Activation & Sender Details",
    description: "Business SMS sender information and activation details for SMSGlobal setup.",
    fields: [
      { key: "smsContactName", label: "SMS Contact Name", type: "text", required: true },
      { key: "smsContactEmail", label: "SMS Contact Email", type: "email", required: true },
      { key: "smsContactMobile", label: "SMS Contact Mobile", type: "tel", required: true },
      { key: "requestedSenderName", label: "Requested Sender Name", type: "text", required: true },
      { key: "smsUseCase", label: "SMS Use Case", type: "textarea", required: true },
      { key: "smsApplicationStatus", label: "SMS Application Status", type: "status", readOnly: true },
      { key: "smsSenderIdOrAccessCode", label: "SMS Sender ID / Access Code Supplied", type: "text" },
      { key: "smsProviderNotes", label: "SMS Provider Notes", type: "textarea" },
    ],
  },
  {
    key: "google_services",
    title: "Google Services",
    description: "Google account and property access readiness.",
    fields: [
      { key: "googleAccountEmail", label: "Google Account Email", type: "email" },
      { key: "googleBusinessProfileAccess", label: "Google Business Profile Access", type: "boolean" },
      { key: "googleAnalyticsAccess", label: "Google Analytics Access", type: "boolean" },
      { key: "googleSearchConsoleAccess", label: "Google Search Console Access", type: "boolean" },
      { key: "googleCalendarAccess", label: "Google Calendar Access", type: "boolean" },
    ],
  },
  {
    key: "social_media_accounts",
    title: "Social Media Accounts",
    description: "Public profiles and links used for marketing and integrations.",
    fields: [
      { key: "facebookBusinessPage", label: "Facebook Business Page", type: "url" },
      { key: "instagramAccount", label: "Instagram Account", type: "text" },
      { key: "linkedInBusinessPage", label: "LinkedIn Business Page", type: "url" },
      { key: "youtubeChannel", label: "YouTube Channel", type: "url" },
      { key: "tikTokAccount", label: "TikTok Account", type: "text" },
      { key: "otherSocialLinks", label: "Other Social Links", type: "textarea" },
    ],
  },
  {
    key: "payment_processing",
    title: "Payment Processing",
    description: "Payment provider readiness for billing, checkout, and automations.",
    fields: [
      { key: "stripeConnected", label: "Stripe Connected", type: "boolean" },
      { key: "paypalConnected", label: "PayPal Connected", type: "boolean" },
      { key: "squareConnected", label: "Square Connected", type: "boolean" },
      { key: "otherPaymentProvider", label: "Other Payment Provider", type: "text" },
      { key: "paymentSetupNotes", label: "Payment Setup Notes", type: "textarea" },
    ],
  },
  {
    key: "branding_assets",
    title: "Branding Assets",
    description: "Brand files and guidance for websites, campaigns, and creative work.",
    fields: [
      { key: "companyLogoUpload", label: "Company Logo Upload", type: "file" },
      { key: "brandColours", label: "Brand Colours", type: "textarea" },
      { key: "brandFonts", label: "Brand Fonts", type: "textarea" },
      { key: "styleGuideUpload", label: "Style Guide Upload", type: "file" },
      { key: "marketingMaterialUpload", label: "Marketing Material Upload", type: "file" },
      { key: "brandNotes", label: "Brand Notes", type: "textarea" },
    ],
  },
  {
    key: "onboarding_requirements",
    title: "Onboarding Requirements",
    description: "Priorities for setup, support, automation, and launch planning.",
    fields: [
      { key: "businessGoals", label: "Business Goals", type: "textarea", required: true },
      { key: "modulesToSetupFirst", label: "Modules To Setup First", type: "textarea", required: true },
      { key: "preferredContactMethod", label: "Preferred Contact Method", type: "select", options: ["Phone", "SMS", "Email", "Video Call"] },
      { key: "bestContactTime", label: "Best Contact Time", type: "text" },
      { key: "onboardingNotes", label: "Onboarding Notes", type: "textarea" },
    ],
  },
];

export function createEmptyVaultData() {
  return BUSINESS_PROFILE_SECTIONS.reduce((acc, section) => {
    acc[section.key] = section.fields.reduce((fieldAcc, field) => {
      fieldAcc[field.key] = field.type === "boolean" ? false : "";
      return fieldAcc;
    }, {});
    return acc;
  }, {});
}

export function calculateVaultCompletion(data = {}) {
  const requiredFields = BUSINESS_PROFILE_SECTIONS.flatMap((section) =>
    section.fields
      .filter((field) => field.required)
      .map((field) => ({ sectionKey: section.key, fieldKey: field.key }))
  );

  if (requiredFields.length === 0) return 100;

  const completed = requiredFields.filter(({ sectionKey, fieldKey }) => {
    const value = data?.[sectionKey]?.[fieldKey];
    return value !== undefined && value !== null && String(value).trim() !== "";
  }).length;

  return Math.round((completed / requiredFields.length) * 100);
}
