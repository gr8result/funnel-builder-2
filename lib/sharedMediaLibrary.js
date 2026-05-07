import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getFunnelTemplateLibraryAssets } from './funnelSections';
import { extractSharedMediaHash, isBlockedSharedMediaHash } from './sharedMediaModeration';
import { getWebsiteTemplateLibraryAssets } from './website-builder/templateLibraryAssets';

const EMAIL_PUBLIC_BUCKET = 'email-assets';
const EMAIL_USER_BUCKET = 'email-user-assets';
const EMAIL_PUBLIC_ROOT = 'templates';
const EMAIL_USER_FOLDERS = ['finished-emails', 'builder-docs', 'builder-templates'];
const EMAIL_TEMPLATE_CACHE_TTL_MS = 60 * 1000;
const emailTemplateImageCache = new Map();
const materializedEmailImageCache = new Map();
const materializedGenericTemplateCache = new Map();
const DELETED_GENERIC_TEMPLATE_PREFIX = '.deleted-template-source-';
const TEMPLATE_SOURCE_TAG_PREFIX = 'template-source-hash:';
const PLATFORM_STORAGE_BUCKETS = new Set([
  'assets',
  'email-assets',
  'email-user-assets',
  'social-images',
  'public-assets',
  'private-assets',
]);

function isImageName(name = '') {
  return /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(String(name || ''));
}

export function getSharedMediaStorageName(storagePath = '', url = '') {
  const raw = String(storagePath || '').replace(/^assets:/, '').trim();
  if (raw) {
    const parts = raw.split('/');
    return parts[parts.length - 1] || '';
  }

  const cleanUrl = String(url || '').split('?')[0];
  const segments = cleanUrl.split('/');
  return segments[segments.length - 1] || '';
}

function getSharedMediaStoragePath(storagePath = '') {
  return String(storagePath || '').replace(/^assets:/, '').trim();
}

function isGenericStoragePath(storagePath = '') {
  return getSharedMediaStoragePath(storagePath).toLowerCase().startsWith('generic/');
}

export function getSharedMediaKind(storagePath = '', url = '') {
  if (isGenericStoragePath(storagePath)) return 'template';
  const name = getSharedMediaStorageName(storagePath, url).toLowerCase();
  if (name.startsWith('shared-')) return 'edited';
  if (name.startsWith('logo-')) return 'logo';
  if (name.startsWith('web-')) return 'upload';
  return 'asset';
}

export function isTemplateSharedMedia(storagePath = '', url = '') {
  return getSharedMediaKind(storagePath, url) === 'template';
}

function sortNewestFirst(a, b) {
  return new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime();
}

function canonicalUrl(url = '') {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return value;
  }
}

function deriveDisplayName({ description = '', storagePath = '', url = '' }) {
  const text = String(description || '').trim();
  if (text) return text;

  const storage = String(storagePath || '').replace(/^assets:/, '');
  if (storage) {
    const filename = storage.split('/').pop() || storage;
    if (storage.toLowerCase().startsWith('generic/')) {
      const pretty = filename
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/^(template|global-template|library)-/i, '')
        .replace(/-[a-f0-9]{12,64}$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      if (pretty) return pretty;
    }
    return filename;
  }

  const cleanUrl = String(url || '').split('?')[0];
  return cleanUrl.split('/').pop() || 'Image';
}

function listGenericLibraryEntries() {
  const assets = [...getFunnelTemplateLibraryAssets(), ...getWebsiteTemplateLibraryAssets()];
  const deduped = Array.from(new Map(
    assets
      .map((asset, index) => ({
        id: asset?.id || `generic-${index + 1}`,
        name: asset?.name || `Generic image ${index + 1}`,
        src: String(asset?.src || '').trim(),
      }))
      .filter((asset) => asset.src)
      .map((asset) => [asset.src, asset])
  ).values());

  return deduped.map((asset, index) => ({
    id: `generic:${asset.id}`,
    url: asset.src,
    name: asset.name,
    description: asset.name,
    tags: ['generic'],
    created_at: new Date(0).toISOString(),
    storage_path: `assets:generic/${asset.id}`,
    kind: 'template',
    is_template: true,
    owner_scope: 'generic',
    shared: true,
  }));
}

async function listStoredGenericLibraryEntries(admin, bucket = 'assets', limit = 500) {
  const entries = await listAllStorageEntries({ admin, bucket, prefix: 'generic', limit });

  return (entries || [])
    .filter((entry) => isImageName(entry?.name))
    .map((entry) => {
      const objectPath = `generic/${entry.name}`;
      const storagePath = `${bucket}:${objectPath}`;
      const { data } = admin.storage.from(bucket).getPublicUrl(objectPath);
      const publicUrl = data?.publicUrl || '';

      return {
        id: `asset:${objectPath}`,
        url: publicUrl,
        name: deriveDisplayName({ storagePath, url: publicUrl }),
        description: deriveDisplayName({ storagePath, url: publicUrl }),
        tags: ['generic'],
        created_at: entry.created_at || entry.updated_at || new Date(0).toISOString(),
        storage_path: storagePath,
        kind: 'template',
        is_template: true,
        owner_scope: 'generic',
        source_hash: parseGenericLibrarySourceHash(objectPath),
        shared: true,
      };
    })
    .filter((entry) => entry.url);
}

function stableId(prefix, value) {
  return `${prefix}:${createHash('sha1').update(String(value || '')).digest('hex').slice(0, 16)}`;
}

function hashText(value = '') {
  let hash = 0;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function canonicalSourceUrl(imageUrl = '') {
  const value = String(imageUrl || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return value.split('?')[0];
  }
}

function parseGenericLibrarySourceHash(value = '') {
  const match = String(value || '').match(/library-(\d+)-[a-f0-9]{20,64}\.[a-z0-9]+$/i);
  return match ? match[1] : '';
}

export function getTemplateSourceTag(hash = '') {
  const normalized = String(hash || '').trim();
  return normalized ? `${TEMPLATE_SOURCE_TAG_PREFIX}${normalized}` : '';
}

export function extractTemplateSourceHashFromTags(tags = []) {
  return (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || ''))
    .find((tag) => tag.startsWith(TEMPLATE_SOURCE_TAG_PREFIX))
    ?.slice(TEMPLATE_SOURCE_TAG_PREFIX.length) || '';
}

export function buildDeletedTemplateMarkerName(hash = '') {
  const normalized = String(hash || '').trim();
  return normalized ? `${DELETED_GENERIC_TEMPLATE_PREFIX}${normalized}.txt` : '';
}

function extractDeletedTemplateSourceHash(name = '') {
  const match = String(name || '').match(/\.deleted-template-source-(\d+)\.txt$/i);
  return match ? match[1] : '';
}

function sharedMediaHashesOverlap(left = '', right = '') {
  const a = String(left || '').trim().toLowerCase();
  const b = String(right || '').trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function extensionFromMime(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('svg')) return 'svg';
  return 'png';
}

function extensionFromUrl(imageUrl = '') {
  const cleanUrl = String(imageUrl || '').split('?')[0];
  const parts = cleanUrl.split('.');
  const ext = String(parts[parts.length - 1] || '').toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : '';
}

async function readImageInput(imageUrl = '') {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download image (${response.status})`);
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType,
    buffer: Buffer.from(arrayBuffer),
    suggestedExt: extensionFromUrl(imageUrl) || extensionFromMime(mimeType),
  };
}

function buildSharedAssetEntry({ row, fallbackDescription = '', fallbackTags = [] }) {
  const storagePath = row?.storage_path || '';
  return {
    ...row,
    name: deriveDisplayName({ description: row?.description || fallbackDescription, storagePath, url: row?.url }),
    description: row?.description || fallbackDescription || deriveDisplayName({ description: '', storagePath, url: row?.url }),
    tags: Array.isArray(row?.tags) ? row.tags : fallbackTags,
    kind: getSharedMediaKind(storagePath, row?.url),
    is_template: isTemplateSharedMedia(storagePath, row?.url),
    owner_scope: 'user',
    shared: true,
  };
}

async function listDeletedTemplateSourceHashes(admin, prefix = '', bucket = 'assets', limit = 500) {
  try {
    const entries = await listAllStorageEntries({ admin, bucket, prefix, limit });
    return new Set((entries || [])
      .map((entry) => extractDeletedTemplateSourceHash(entry?.name))
      .filter(Boolean));
  } catch {
    return new Set();
  }
}

async function findExistingSharedAsset(admin, userId, storagePath = '') {
  const { data } = await admin
    .from('social_image_library')
    .select('id, url, description, tags, created_at, storage_path')
    .eq('user_id', userId)
    .eq('storage_path', storagePath)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function materializeUserEmailTemplateImage({ admin, userId, entry }) {
  const sourceUrl = String(entry?.url || '').trim();
  if (!sourceUrl) return null;

  const cacheKey = `${userId}:${canonicalUrl(sourceUrl)}`;
  const cached = materializedEmailImageCache.get(cacheKey);
  if (cached && (Date.now() - cached.createdAt) < EMAIL_TEMPLATE_CACHE_TTL_MS) {
    return cached.entry;
  }

  const { mimeType, buffer, suggestedExt } = await readImageInput(sourceUrl);
  const imageHash = sha256(buffer);
  const sourceHash = String(hashText(canonicalSourceUrl(sourceUrl)));
  const filename = `${userId}/shared-${imageHash}.${suggestedExt || 'png'}`;
  const storagePath = `assets:${filename}`;
  const existing = await findExistingSharedAsset(admin, userId, storagePath);
  if (existing) {
    const result = buildSharedAssetEntry({ row: existing, fallbackDescription: entry?.description, fallbackTags: entry?.tags || [] });
    materializedEmailImageCache.set(cacheKey, { createdAt: Date.now(), entry: result });
    return result;
  }

  const { error: uploadError } = await admin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: mimeType, upsert: false });
  if (uploadError && uploadError.statusCode !== '409' && uploadError.status !== 409) {
    throw uploadError;
  }

  const { data: urlData } = admin.storage.from('assets').getPublicUrl(filename);
  const { data, error } = await admin
    .from('social_image_library')
    .insert({
      user_id: userId,
      url: urlData?.publicUrl || sourceUrl,
      storage_path: storagePath,
      description: String(entry?.description || '').slice(0, 500),
      tags: Array.from(new Set([...(Array.isArray(entry?.tags) ? entry.tags : []), getTemplateSourceTag(sourceHash)].filter(Boolean))),
    })
    .select('id, url, description, tags, created_at, storage_path')
    .single();

  if (error) {
    const reused = await findExistingSharedAsset(admin, userId, storagePath);
    if (reused) {
      const result = buildSharedAssetEntry({ row: reused, fallbackDescription: entry?.description, fallbackTags: entry?.tags || [] });
      materializedEmailImageCache.set(cacheKey, { createdAt: Date.now(), entry: result });
      return result;
    }
    throw error;
  }

  const result = buildSharedAssetEntry({ row: data, fallbackDescription: entry?.description, fallbackTags: entry?.tags || [] });
  materializedEmailImageCache.set(cacheKey, { createdAt: Date.now(), entry: result });
  return result;
}

function buildStoredGenericLibraryEntry(admin, objectPath, metadata = {}) {
  const storagePath = `assets:${objectPath}`;
  const { data } = admin.storage.from('assets').getPublicUrl(objectPath);
  const publicUrl = data?.publicUrl || '';
  return {
    id: `asset:${objectPath}`,
    url: publicUrl,
    name: metadata?.name || deriveDisplayName({ storagePath, url: publicUrl }),
    description: metadata?.description || deriveDisplayName({ storagePath, url: publicUrl }),
    tags: Array.isArray(metadata?.tags) ? metadata.tags : ['generic'],
    created_at: metadata?.created_at || new Date().toISOString(),
    storage_path: storagePath,
    kind: 'template',
    is_template: true,
    owner_scope: 'generic',
    source_hash: parseGenericLibrarySourceHash(objectPath),
    shared: true,
  };
}

async function materializeGenericTemplateImage({ admin, entry }) {
  const sourceUrl = String(entry?.url || '').trim();
  if (!sourceUrl) return null;

  const normalizedSourceUrl = canonicalSourceUrl(sourceUrl);
  const cacheKey = normalizedSourceUrl || sourceUrl;
  const cached = materializedGenericTemplateCache.get(cacheKey);
  if (cached && (Date.now() - cached.createdAt) < EMAIL_TEMPLATE_CACHE_TTL_MS) {
    return cached.entry;
  }

  const { mimeType, buffer, suggestedExt } = await readImageInput(sourceUrl);
  const fullContentHash = sha256(buffer);
  if (isBlockedSharedMediaHash(fullContentHash)) return null;
  const contentHash = fullContentHash.slice(0, 20);
  const sourceHash = hashText(normalizedSourceUrl || sourceUrl);
  const objectPath = `generic/library-${String(sourceHash)}-${contentHash}.${suggestedExt || 'jpg'}`;

  const { error: uploadError } = await admin.storage
    .from('assets')
    .upload(objectPath, buffer, { contentType: mimeType, upsert: false });
  if (uploadError && uploadError.statusCode !== '409' && uploadError.status !== 409) {
    throw uploadError;
  }

  const result = buildStoredGenericLibraryEntry(admin, objectPath, {
    name: entry?.name,
    description: entry?.description,
    tags: Array.isArray(entry?.tags) ? entry.tags : ['generic'],
    created_at: entry?.created_at,
  });
  materializedGenericTemplateCache.set(cacheKey, { createdAt: Date.now(), entry: result });
  return result;
}

function trimWrappedUrl(value = '') {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function extractPlatformStorageUrlParts(value = '') {
  const raw = trimWrappedUrl(value);
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const publicMatch = parsed.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
    if (publicMatch) {
      return {
        bucket: String(publicMatch[1] || '').toLowerCase(),
        objectPath: decodeURIComponent(publicMatch[2] || ''),
        url: parsed.toString(),
      };
    }

    const signMatch = parsed.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/i);
    if (signMatch) {
      return {
        bucket: String(signMatch[1] || '').toLowerCase(),
        objectPath: decodeURIComponent(signMatch[2] || ''),
        url: parsed.toString(),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isPlatformHostedImageUrl(value = '') {
  const raw = trimWrappedUrl(value);
  if (!raw) return false;
  if (raw.startsWith('/email-assets/')) return true;
  if (raw.startsWith('/storage/v1/object/public/')) return true;
  if (raw.startsWith(`${EMAIL_PUBLIC_BUCKET}/`) || raw.startsWith(`${EMAIL_USER_BUCKET}/`)) return true;

  const storageParts = extractPlatformStorageUrlParts(raw);
  return !!(storageParts?.bucket && PLATFORM_STORAGE_BUCKETS.has(storageParts.bucket));
}

function isImageUrlCandidate(value = '', options = {}) {
  const { allowExternalHttp = false } = options;
  const raw = trimWrappedUrl(value);
  if (!raw || raw.startsWith('data:')) return false;
  if (/^https?:\/\//i.test(raw)) {
    return (allowExternalHttp || isPlatformHostedImageUrl(raw)) && isImageName(raw.split('?')[0].split('#')[0]);
  }
  if (raw.startsWith('/email-assets/')) return isImageName(raw);
  if (raw.startsWith('/storage/v1/object/public/')) return isImageName(raw);
  if (raw.startsWith(`${EMAIL_PUBLIC_BUCKET}/`) || raw.startsWith(`${EMAIL_USER_BUCKET}/`)) return isImageName(raw);
  return false;
}

function normalizeExtractedImageUrl(admin, value = '', options = {}) {
  const { allowExternalHttp = false } = options;
  const raw = trimWrappedUrl(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    return (allowExternalHttp || isPlatformHostedImageUrl(raw)) ? raw : '';
  }
  if (raw.startsWith('/email-assets/') || raw.startsWith('/storage/v1/object/public/')) return raw;

  if (raw.startsWith(`${EMAIL_PUBLIC_BUCKET}/`)) {
    const objectPath = raw.slice(`${EMAIL_PUBLIC_BUCKET}/`.length);
    const { data } = admin.storage.from(EMAIL_PUBLIC_BUCKET).getPublicUrl(objectPath);
    return data?.publicUrl || '';
  }

  if (raw.startsWith(`${EMAIL_USER_BUCKET}/`)) {
    const objectPath = raw.slice(`${EMAIL_USER_BUCKET}/`.length);
    const { data } = admin.storage.from(EMAIL_USER_BUCKET).getPublicUrl(objectPath);
    return data?.publicUrl || '';
  }

  return '';
}

function extractImageUrlsFromText(text = '', options = {}) {
  const source = String(text || '');
  if (!source.trim()) return [];

  const matches = new Set();
  const pushMatch = (value) => {
    const normalized = trimWrappedUrl(value)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    if (isImageUrlCandidate(normalized, options)) matches.add(normalized);
  };

  const patterns = [
    /<img\b[^>]*\bsrc=["']([^"']+)["']/gi,
    /(?:background(?:-image)?|src)\s*[:=]\s*["']?url\(([^)]+)\)/gi,
    /url\(([^)]+)\)/gi,
    /((?:https?:\/\/|\/(?:email-assets|storage\/v1\/object\/public)\/|(?:email-assets|email-user-assets)\/)[^\s"'`<>\)]+)/gi,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(source))) {
      pushMatch(match[1] || match[0]);
    }
  });

  return [...matches];
}

async function downloadStorageText(admin, bucket, filePath) {
  const { data, error } = await admin.storage.from(bucket).download(filePath);
  if (error || !data) return '';
  return data.text();
}

async function listFolderEntries(admin, bucket, prefix, limit = 500) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit,
    offset: 0,
    sortBy: { column: 'updated_at', order: 'desc' },
  });
  if (error) throw error;
  return data || [];
}

async function listPublicEmailTemplateFiles(admin) {
  const top = await listFolderEntries(admin, EMAIL_PUBLIC_BUCKET, EMAIL_PUBLIC_ROOT, 500);
  const folders = top.filter((entry) => entry && !entry.id && entry.name);
  const files = top
    .filter((entry) => /\.(html?|json)$/i.test(String(entry?.name || '')))
    .map((entry) => ({
      bucket: EMAIL_PUBLIC_BUCKET,
      path: `${EMAIL_PUBLIC_ROOT}/${entry.name}`,
      ownerScope: 'generic',
      createdAt: entry.created_at || entry.updated_at || new Date(0).toISOString(),
      sourceLabel: 'public email template',
    }));

  for (const folder of folders) {
    const folderPath = `${EMAIL_PUBLIC_ROOT}/${folder.name}`;
    try {
      const inner = await listFolderEntries(admin, EMAIL_PUBLIC_BUCKET, folderPath, 500);
      inner
        .filter((entry) => /\.(html?|json)$/i.test(String(entry?.name || '')))
        .forEach((entry) => {
          files.push({
            bucket: EMAIL_PUBLIC_BUCKET,
            path: `${folderPath}/${entry.name}`,
            ownerScope: 'generic',
            createdAt: entry.created_at || entry.updated_at || new Date(0).toISOString(),
            sourceLabel: 'public email template',
          });
        });
    } catch {
      // Ignore unreadable nested folders.
    }
  }

  return files;
}

async function listUserEmailTemplateFiles(admin, userId) {
  const files = [];
  for (const folder of EMAIL_USER_FOLDERS) {
    const prefix = `${userId}/${folder}`;
    try {
      const entries = await listAllStorageEntries({ admin, bucket: EMAIL_USER_BUCKET, prefix, limit: 500 });
      entries
        .filter((entry) => /\.(html?|json)$/i.test(String(entry?.name || '')))
        .forEach((entry) => {
          files.push({
            bucket: EMAIL_USER_BUCKET,
            path: `${prefix}/${entry.name}`,
            ownerScope: 'user',
            createdAt: entry.created_at || entry.updated_at || new Date().toISOString(),
            sourceLabel: 'saved email file',
          });
        });
    } catch {
      // Ignore missing email folders for users who have not saved any docs yet.
    }
  }
  return files;
}

async function walkLocalEmailTemplateFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkLocalEmailTemplateFiles(fullPath));
      continue;
    }
    if (/\.html?$/i.test(entry.name)) files.push(fullPath);
  }

  return files;
}

async function listLocalEmailTemplateEntries() {
  const rootDir = path.join(process.cwd(), 'email');
  try {
    const files = await walkLocalEmailTemplateFiles(rootDir);
    const entries = await Promise.all(files.map(async (filePath) => {
      const stat = await fs.stat(filePath);
      return {
        filePath,
        createdAt: stat.mtime.toISOString(),
      };
    }));
    return entries;
  } catch {
    return [];
  }
}

function collectNestedImageReferences(value, output = new Set()) {
  if (typeof value === 'string') {
    extractImageUrlsFromText(value, { allowExternalHttp: true }).forEach((url) => output.add(url));
    if (isImageUrlCandidate(value, { allowExternalHttp: true })) output.add(trimWrappedUrl(value));
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectNestedImageReferences(item, output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectNestedImageReferences(item, output));
  }
  return output;
}

async function listWebsiteBuilderTemplateReferencedImages() {
  const filePath = path.join(process.cwd(), 'data', 'website-builder-defaults.json');
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(text);
    const stat = await fs.stat(filePath);
    return [...collectNestedImageReferences(parsed)].map((url) => ({
      id: stableId('website-template:generic', `${filePath}:${url}`),
      url,
      name: deriveDisplayName({ description: '', storagePath: filePath, url }),
      description: 'website builder template image',
      tags: ['website-template', 'generic'],
      created_at: stat.mtime.toISOString(),
      storage_path: `website-template:${path.relative(process.cwd(), filePath).replace(/\\/g, '/')}`,
      kind: 'template',
      is_template: true,
      owner_scope: 'generic',
      shared: true,
    }));
  } catch {
    return [];
  }
}

function buildExtractedEmailImageEntry({ sourcePath, sourceLabel, ownerScope, createdAt, url }) {
  return {
    id: stableId(`email-template:${ownerScope}`, `${sourcePath}:${url}`),
    url,
    name: deriveDisplayName({ description: '', storagePath: sourcePath, url }),
    description: `${sourceLabel} image`,
    tags: ownerScope === 'generic' ? ['email-template', 'generic'] : ['email-template'],
    created_at: createdAt || new Date().toISOString(),
    storage_path: `email-template:${sourcePath}`,
    kind: ownerScope === 'generic' ? 'template' : 'asset',
    is_template: ownerScope === 'generic',
    owner_scope: ownerScope,
    shared: true,
  };
}

async function listEmailTemplateReferencedImages({ admin, userId }) {
  const cacheKey = String(userId || 'anonymous');
  const cached = emailTemplateImageCache.get(cacheKey);
  if (cached && (Date.now() - cached.createdAt) < EMAIL_TEMPLATE_CACHE_TTL_MS) {
    return cached.entries;
  }

  const extracted = [];
  const seen = new Set();
  const addExtracted = (entry) => {
    const canonical = canonicalUrl(entry?.url);
    const key = `${entry?.owner_scope || 'user'}:${canonical}`;
    if (!canonical || seen.has(key)) return;
    seen.add(key);
    extracted.push(entry);
  };

  const [publicFiles, userFiles, localFiles] = await Promise.all([
    listPublicEmailTemplateFiles(admin),
    listUserEmailTemplateFiles(admin, userId),
    listLocalEmailTemplateEntries(),
  ]);

  for (const file of publicFiles) {
    const text = await downloadStorageText(admin, file.bucket, file.path);
    extractImageUrlsFromText(text, { allowExternalHttp: true })
      .map((value) => normalizeExtractedImageUrl(admin, value, { allowExternalHttp: true }))
      .filter(Boolean)
      .forEach((url) => addExtracted(buildExtractedEmailImageEntry({
        sourcePath: `${file.bucket}/${file.path}`,
        sourceLabel: file.sourceLabel,
        ownerScope: file.ownerScope,
        createdAt: file.createdAt,
        url,
      })));
  }

  for (const file of userFiles) {
    const text = await downloadStorageText(admin, file.bucket, file.path);
    extractImageUrlsFromText(text, { allowExternalHttp: true })
      .map((value) => normalizeExtractedImageUrl(admin, value, { allowExternalHttp: true }))
      .filter(Boolean)
      .forEach((url) => addExtracted(buildExtractedEmailImageEntry({
        sourcePath: `${file.bucket}/${file.path}`,
        sourceLabel: file.sourceLabel,
        ownerScope: file.ownerScope,
        createdAt: file.createdAt,
        url,
      })));
  }

  for (const file of localFiles) {
    try {
      const text = await fs.readFile(file.filePath, 'utf8');
      extractImageUrlsFromText(text, { allowExternalHttp: true })
        .map((value) => normalizeExtractedImageUrl(admin, value, { allowExternalHttp: true }) || value)
        .filter(Boolean)
        .forEach((url) => addExtracted(buildExtractedEmailImageEntry({
          sourcePath: path.relative(process.cwd(), file.filePath).replace(/\\/g, '/'),
          sourceLabel: 'repo email template',
          ownerScope: 'generic',
          createdAt: file.createdAt,
          url,
        })));
    } catch {
      // Ignore unreadable local template files.
    }
  }

  emailTemplateImageCache.set(cacheKey, { createdAt: Date.now(), entries: extracted });
  return extracted;
}

async function listAllStorageEntries({ admin, bucket, prefix, limit }) {
  const pageSize = Math.min(Math.max(Number(limit) || 500, 100), 1000);
  const results = [];
  let offset = 0;

  while (results.length < limit) {
    const remaining = limit - results.length;
    const batchSize = Math.min(pageSize, remaining);
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: batchSize, offset, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) throw error;

    const batch = data || [];
    results.push(...batch);
    if (batch.length < batchSize) break;
    offset += batch.length;
  }

  return results;
}

export async function listMergedSharedMediaLibrary({ admin, userId, bucket = 'assets', limit = 500, includeEmailTemplateImages = true }) {
  const { data: rows, error } = await admin
    .from('social_image_library')
    .select('id, url, description, tags, created_at, storage_path')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const prefix = `${userId}/`;
  const [storageEntries, storedGenericEntries, emailTemplateImages, websiteTemplateImages, deletedGenericSourceHashes, deletedUserSourceHashes] = await Promise.all([
    listAllStorageEntries({ admin, bucket, prefix, limit }),
    listStoredGenericLibraryEntries(admin, bucket, limit),
    includeEmailTemplateImages ? listEmailTemplateReferencedImages({ admin, userId }) : Promise.resolve([]),
    listWebsiteBuilderTemplateReferencedImages(),
    listDeletedTemplateSourceHashes(admin, 'generic', bucket, limit),
    listDeletedTemplateSourceHashes(admin, userId, bucket, limit),
  ]);

  const genericSourceHashes = new Set((storedGenericEntries || [])
    .map((entry) => String(entry?.source_hash || ''))
    .filter(Boolean));
  const genericContentHashes = (storedGenericEntries || [])
    .map((entry) => extractSharedMediaHash(entry?.storage_path, entry?.url, entry?.name))
    .filter(Boolean);

  const genericTemplateReferences = [
    ...(websiteTemplateImages || []),
    ...(emailTemplateImages || []).filter((entry) => entry?.owner_scope === 'generic'),
  ];

  const materializedGenericTemplateImages = await Promise.all(genericTemplateReferences.map(async (entry) => {
    const sourceHash = String(hashText(canonicalSourceUrl(entry?.url || '')));
    if (sourceHash && deletedGenericSourceHashes.has(sourceHash)) return null;
    if (sourceHash && genericSourceHashes.has(sourceHash)) return null;
    try {
      return await materializeGenericTemplateImage({ admin, entry });
    } catch {
      return isPlatformHostedImageUrl(entry?.url || '') ? entry : null;
    }
  }));

  const normalizedEmailTemplateImages = includeEmailTemplateImages
    ? await Promise.all((emailTemplateImages || []).map(async (entry) => {
      if (entry?.owner_scope === 'generic') return null;
      if (entry?.owner_scope !== 'user' || !String(entry?.storage_path || '').startsWith('email-template:')) return entry;
      const sourceHash = String(hashText(canonicalSourceUrl(entry?.url || '')));
      if (sourceHash && deletedUserSourceHashes.has(sourceHash)) return null;
      if (sourceHash && genericSourceHashes.has(sourceHash)) return null;
      try {
        return await materializeUserEmailTemplateImage({ admin, userId, entry });
      } catch {
        return isPlatformHostedImageUrl(entry?.url || '') ? entry : null;
      }
    }))
    : [];

  const rowByStoragePath = new Map((rows || [])
    .filter((row) => row?.storage_path)
    .sort(sortNewestFirst)
    .map((row) => [row.storage_path, row]));

  const rowByUrl = new Map((rows || [])
    .filter((row) => row?.url)
    .sort(sortNewestFirst)
    .map((row) => [canonicalUrl(row.url), row]));

  const merged = [];
  const seen = new Set();
  const seenUrls = new Set();
  const seenHashes = new Set();

  for (const entry of (storageEntries || []).filter((item) => isImageName(item?.name))) {
    const objectPath = `${prefix}${entry.name}`;
    const storagePath = `${bucket}:${objectPath}`;
    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = publicData?.publicUrl || '';
    const match = rowByStoragePath.get(storagePath) || rowByUrl.get(canonicalUrl(publicUrl));
    const id = match?.id || `asset:${objectPath}`;
    const canonical = canonicalUrl(publicUrl);
    const contentHash = extractSharedMediaHash(storagePath, publicUrl, entry.name, match?.url);
    if (isBlockedSharedMediaHash(contentHash)) continue;
    if (contentHash && genericContentHashes.some((hash) => sharedMediaHashesOverlap(hash, contentHash))) continue;
    if (seen.has(id) || (canonical && seenUrls.has(canonical)) || (contentHash && seenHashes.has(contentHash))) continue;
    seen.add(id);
    if (canonical) seenUrls.add(canonical);
    if (contentHash) seenHashes.add(contentHash);
    merged.push({
      id,
      url: publicUrl,
      name: deriveDisplayName({ description: match?.description, storagePath, url: publicUrl }),
      description: match?.description || entry.name,
      tags: match?.tags || [],
      created_at: match?.created_at || entry.created_at || entry.updated_at || new Date().toISOString(),
      storage_path: storagePath,
      kind: getSharedMediaKind(storagePath, publicUrl),
      is_template: isTemplateSharedMedia(storagePath, publicUrl),
      owner_scope: 'user',
      shared: true,
    });
  }

  for (const row of (rows || []).sort(sortNewestFirst)) {
    if (!row?.url) continue;
    const canonical = canonicalUrl(row.url);
    const contentHash = extractSharedMediaHash(row.storage_path, row.url, row.description);
    if (isBlockedSharedMediaHash(contentHash)) continue;
    if (contentHash && genericContentHashes.some((hash) => sharedMediaHashesOverlap(hash, contentHash))) continue;
    if (seen.has(row.id) || (canonical && seenUrls.has(canonical)) || (contentHash && seenHashes.has(contentHash))) continue;
    seen.add(row.id);
    if (canonical) seenUrls.add(canonical);
    if (contentHash) seenHashes.add(contentHash);
    merged.push({
      ...row,
      name: deriveDisplayName({ description: row.description, storagePath: row.storage_path, url: row.url }),
      kind: getSharedMediaKind(row.storage_path, row.url),
      is_template: isTemplateSharedMedia(row.storage_path, row.url),
      owner_scope: 'user',
    });
  }

  for (const genericEntry of listGenericLibraryEntries()) {
    const canonical = canonicalUrl(genericEntry.url);
    const contentHash = extractSharedMediaHash(genericEntry.storage_path, genericEntry.url, genericEntry.name);
    if (isBlockedSharedMediaHash(contentHash)) continue;
    if (seen.has(genericEntry.id) || (canonical && seenUrls.has(canonical)) || (contentHash && seenHashes.has(contentHash))) continue;
    seen.add(genericEntry.id);
    if (canonical) seenUrls.add(canonical);
    if (contentHash) seenHashes.add(contentHash);
    merged.push(genericEntry);
  }

  for (const genericEntry of storedGenericEntries) {
    const canonical = canonicalUrl(genericEntry.url);
    const contentHash = extractSharedMediaHash(genericEntry.storage_path, genericEntry.url, genericEntry.name);
    if (isBlockedSharedMediaHash(contentHash)) continue;
    if (seen.has(genericEntry.id) || (canonical && seenUrls.has(canonical)) || (contentHash && seenHashes.has(contentHash))) continue;
    seen.add(genericEntry.id);
    if (canonical) seenUrls.add(canonical);
    if (contentHash) seenHashes.add(contentHash);
    merged.push(genericEntry);
  }

  for (const genericEntry of materializedGenericTemplateImages.filter(Boolean)) {
    const canonical = canonicalUrl(genericEntry.url);
    const contentHash = extractSharedMediaHash(genericEntry.storage_path, genericEntry.url, genericEntry.name);
    if (isBlockedSharedMediaHash(contentHash)) continue;
    if (seen.has(genericEntry.id) || (canonical && seenUrls.has(canonical)) || (contentHash && seenHashes.has(contentHash))) continue;
    seen.add(genericEntry.id);
    if (canonical) seenUrls.add(canonical);
    if (contentHash) seenHashes.add(contentHash);
    merged.push(genericEntry);
  }

  for (const emailTemplateEntry of normalizedEmailTemplateImages.filter(Boolean)) {
    const canonical = canonicalUrl(emailTemplateEntry.url);
    const contentHash = extractSharedMediaHash(emailTemplateEntry.storage_path, emailTemplateEntry.url, emailTemplateEntry.name);
    if (isBlockedSharedMediaHash(contentHash)) continue;
    if (contentHash && genericContentHashes.some((hash) => sharedMediaHashesOverlap(hash, contentHash))) continue;
    if (seen.has(emailTemplateEntry.id) || (canonical && seenUrls.has(canonical)) || (contentHash && seenHashes.has(contentHash))) continue;
    seen.add(emailTemplateEntry.id);
    if (canonical) seenUrls.add(canonical);
    if (contentHash) seenHashes.add(contentHash);
    merged.push(emailTemplateEntry);
  }

  return merged.sort(sortNewestFirst);
}