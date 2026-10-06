export const PORTAL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "Documents" },
  { key: "selections", label: "Selections" },
  { key: "variations", label: "Variations" },
  { key: "progress", label: "Progress" },
  { key: "messages", label: "Messages" },
  { key: "approvals", label: "Approvals" },
];

export const DOCUMENT_CATEGORY_LABELS = {
  estimate_snapshot: "Project Estimate",
  quote: "Formal Quote",
  contract: "Contract Documents",
  plan: "Plans",
  plans: "Plans",
  specification: "Specifications",
  specifications: "Specifications",
  selection: "Selections Schedule",
  variation: "Approved Variations",
  approval: "Approvals",
  photo: "Progress Reports",
  other: "Other Shared Documents",
  general: "Other Shared Documents",
};

export const SELECTION_STATUS_LABELS = {
  not_selected: "Not Started",
  pending: "Not Started",
  selected: "Submitted",
  changed: "Changes Requested",
  approved: "Approved",
  removed: "Locked",
  replaced: "Locked",
};

export const VARIATION_STATUS_LABELS = {
  submitted: "Awaiting Client Approval",
  sent: "Awaiting Client Approval",
  approved: "Approved",
  rejected: "Rejected",
  void: "Withdrawn",
  withdrawn: "Withdrawn",
};

export const EMPTY_PORTAL_DATA = {
  mode: "client",
  project: null,
  builder: null,
  settings: {},
  documents: [],
  selections: [],
  variations: [],
  approvals: [],
  progress: [],
  messages: [],
  clients: [],
};
