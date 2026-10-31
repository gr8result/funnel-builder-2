// Server-side validation of a public enquiry. Pure functions; the API route does the I/O.
//
// Spam protection is layered: a hidden honeypot field, a signed render token that proves the form was loaded at least
// a few seconds earlier from this page, per-IP rate limiting (in the route), and strict field validation.

import crypto from 'node:crypto';
import { cleanText } from './pageModel.js';

export const MIN_FILL_MS = 2500;
export const MAX_TOKEN_AGE_MS = 1000 * 60 * 60 * 24;
export const HONEYPOT_FIELD = 'company_website';

function secret() {
  const raw = process.env.LANDING_PAGE_FORM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!raw) throw new Error('Form signing secret is not configured');
  return crypto.createHash('sha256').update(`landing-form:${raw}`).digest();
}

export function signFormToken(pageId, now = Date.now()) {
  const payload = `${pageId}.${now}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${now}.${sig}`;
}

export function verifyFormToken(token, pageId, now = Date.now()) {
  const [tsRaw, sig] = String(token || '').split('.');
  const ts = Number(tsRaw);
  if (!ts || !sig) return { ok: false, reason: 'missing-token' };
  const expected = crypto.createHmac('sha256', secret()).update(`${pageId}.${ts}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'bad-token' };
  if (now - ts < MIN_FILL_MS) return { ok: false, reason: 'too-fast' };
  if (now - ts > MAX_TOKEN_AGE_MS) return { ok: false, reason: 'expired' };
  return { ok: true };
}

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;

export function validateSubmission(form, body = {}) {
  const errors = {};
  const values = {};
  const input = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const fields = Array.isArray(form?.fields) ? form.fields : [];
  const allowed = new Set(fields.map((f) => f.key));

  for (const f of fields) {
    const raw = input[f.key];
    const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
    if (!value) { if (f.required) errors[f.key] = `${f.label} is required`; continue; }
    const max = f.type === 'textarea' ? 4000 : 300;
    if (value.length > max) { errors[f.key] = `${f.label} is too long`; continue; }
    if (f.type === 'email' && !EMAIL_RE.test(value)) { errors[f.key] = 'Enter a valid email address'; continue; }
    if (f.type === 'tel' && !/^[+\d][\d\s()-]{5,24}$/.test(value)) { errors[f.key] = 'Enter a valid phone number'; continue; }
    if (f.type === 'select' && Array.isArray(f.options) && f.options.length && !f.options.includes(value)) { errors[f.key] = `Choose an option for ${f.label}`; continue; }
    values[f.key] = cleanText(value, max);
  }
  const unknown = Object.keys(input).filter((k) => !allowed.has(k));
  const intent = fields.find((field) => field.key === 'enquiry_intent');
  if (intent?.options?.includes('Pre-launch registration') && !values.enquiry_intent && !errors.enquiry_intent) values.enquiry_intent = 'Pre-launch registration';
  if (!values.email && !errors.email) errors.email = 'Email is required';
  const consent = !!body.consent;
  if (form?.consent?.enabled && form.consent.required && !consent) errors.consent = 'Please confirm you agree to be contacted';
  const idempotencyKey = String(body.idempotencyKey || '');
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(idempotencyKey)) errors._form = 'Invalid submission key';
  return { ok: Object.keys(errors).length === 0, errors, values, consent, idempotencyKey, ignoredFields: unknown };
}

export function isHoneypotTripped(body = {}) {
  return String(body[HONEYPOT_FIELD] || body.fields?.[HONEYPOT_FIELD] || '').trim() !== '';
}

const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'referrer', 'landing_url'];
export function cleanAttribution(input = {}) {
  const out = {};
  for (const k of ATTR_KEYS) {
    const v = input?.[k];
    if (v != null && String(v).trim()) out[k] = cleanText(String(v).trim(), 300);
  }
  return out;
}

export function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`lp-ip:${ip}:${new Date().toISOString().slice(0, 7)}`).digest('hex').slice(0, 32);
}

// Name for the CRM: a "name" field, else first+last, else nothing.
export function contactName(values) {
  return values.name || [values.first_name, values.last_name].filter(Boolean).join(' ') || '';
}
