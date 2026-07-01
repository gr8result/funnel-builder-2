const BASE_DEVELOPER_EMAILS = [
  'admin@gr8result.com',
  'developer@gr8result.com',
  'grant@gr8result.com',
  'support@gr8result.com',
  'support@waiteandsea.com.au',
];

const BASE_DEVELOPER_EMAIL_DOMAINS = [
  'gr8result.com',
  'gr8result.com.au',
  'waiteandsea.com.au',
];

function parseDeveloperEmails(value = '') {
  return String(value || '')
    .split(/[;,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function parseDeveloperDomains(value = '') {
  return String(value || '')
    .split(/[;,\s]+/)
    .map((entry) => entry.trim().toLowerCase().replace(/^@+/, ''))
    .filter(Boolean);
}

const DEVELOPER_EMAILS = Array.from(new Set([
  ...BASE_DEVELOPER_EMAILS,
  ...parseDeveloperEmails(process.env.DEVELOPER_EMAILS || process.env.NEXT_PUBLIC_DEVELOPER_EMAILS || ''),
]));

const DEVELOPER_EMAIL_DOMAINS = Array.from(new Set([
  ...BASE_DEVELOPER_EMAIL_DOMAINS,
  ...parseDeveloperDomains(process.env.DEVELOPER_EMAIL_DOMAINS || process.env.NEXT_PUBLIC_DEVELOPER_EMAIL_DOMAINS || ''),
]));

export { DEVELOPER_EMAILS };
export { DEVELOPER_EMAIL_DOMAINS };

export function isDeveloperEmail(email = '') {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  if (DEVELOPER_EMAILS.includes(normalized)) return true;

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex === -1) return false;

  const domain = normalized.slice(atIndex + 1);
  return DEVELOPER_EMAIL_DOMAINS.includes(domain);
}
