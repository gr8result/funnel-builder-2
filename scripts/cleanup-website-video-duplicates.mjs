import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnvFile(path.resolve(process.cwd(), '.env.local'));
loadDotEnvFile(path.resolve(process.cwd(), '.env'));

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const byName = args.has('--by-name');
const listOnly = args.has('--list');
const userArg = process.argv.find((arg) => arg.startsWith('--user='));
const targetUserId = userArg ? userArg.slice('--user='.length).trim() : '';
const removeArg = process.argv.find((arg) => arg.startsWith('--remove='));
const explicitRemoveNames = removeArg
  ? removeArg.slice('--remove='.length).split(',').map((name) => name.trim()).filter(Boolean)
  : [];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const VIDEO_RE = /\.(mp4|webm|mov|m4v)$/i;

function originalVideoKey(name = '') {
  return String(name || '')
    .replace(/^web-\d+-/i, '')
    .replace(/^video-\d+-/i, '')
    .replace(/^upload-\d+-/i, '')
    .toLowerCase();
}

function sortNewestFirst(left, right) {
  const leftTime = new Date(left.created_at || left.updated_at || left.name || 0).getTime() || 0;
  const rightTime = new Date(right.created_at || right.updated_at || right.name || 0).getTime() || 0;
  if (rightTime !== leftTime) return rightTime - leftTime;
  return String(right.name || '').localeCompare(String(left.name || ''));
}

async function listTopLevelFolders() {
  const { data, error } = await supabase.storage.from('assets').list('', {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  return (data || []).filter((entry) => entry?.id === null && entry?.name);
}

async function listUserVideos(userId) {
  const { data, error } = await supabase.storage.from('assets').list(`${userId}/`, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  return (data || []).filter((entry) => VIDEO_RE.test(String(entry?.name || '')));
}

async function hashStorageObject(objectPath) {
  const { data, error } = await supabase.storage.from('assets').download(objectPath);
  if (error) throw error;
  const buffer = Buffer.from(await data.arrayBuffer());
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const folders = targetUserId ? [{ name: targetUserId }] : await listTopLevelFolders();
const duplicateGroups = [];
const removePaths = [];
const listedVideos = [];

for (const folder of folders) {
  const userId = folder.name;
  const videos = await listUserVideos(userId);
  listedVideos.push(...videos.map((video) => ({
    userId,
    name: video.name,
    created_at: video.created_at || '',
    updated_at: video.updated_at || '',
    size: video.metadata?.size || video.metadata?.contentLength || null,
  })));
  if (listOnly) continue;
  if (explicitRemoveNames.length) {
    const wanted = new Set(explicitRemoveNames);
    removePaths.push(...videos
      .filter((video) => wanted.has(video.name))
      .map((video) => `${userId}/${video.name}`));
    continue;
  }
  const groupedVideos = new Map();

  for (const video of videos) {
    const objectPath = `${userId}/${video.name}`;
    const key = byName ? originalVideoKey(video.name) : await hashStorageObject(objectPath);
    if (!key) continue;
    if (!groupedVideos.has(key)) groupedVideos.set(key, []);
    groupedVideos.get(key).push(video);
  }

  for (const [key, group] of groupedVideos.entries()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(sortNewestFirst);
    const keep = sorted[0];
    const extras = sorted.slice(1);
    duplicateGroups.push({
      userId,
      duplicateKey: byName ? key : `${key.slice(0, 12)}...`,
      mode: byName ? 'name' : 'content-hash',
      count: group.length,
      keep: keep.name,
      remove: extras.map((entry) => entry.name),
    });
    removePaths.push(...extras.map((entry) => `${userId}/${entry.name}`));
  }
}

if (listOnly) {
  console.log(JSON.stringify({
    mode: 'list',
    videoCount: listedVideos.length,
    videos: listedVideos,
  }, null, 2));
  process.exit(0);
}

if (explicitRemoveNames.length) {
  console.log(JSON.stringify({
    mode: apply ? 'apply-explicit-remove' : 'dry-run-explicit-remove',
    requested: explicitRemoveNames,
    removePaths,
  }, null, 2));
  if (apply && removePaths.length) {
    const { error } = await supabase.storage.from('assets').remove(removePaths);
    if (error) throw error;
    console.log(`Removed ${removePaths.length} requested video file(s).`);
  } else if (!apply) {
    console.log('Dry run only. Re-run with --apply to delete these videos.');
  }
  process.exit(0);
}

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  duplicateMode: byName ? 'name' : 'content-hash',
  duplicateGroupCount: duplicateGroups.length,
  duplicateFileCount: removePaths.length,
  duplicateGroups,
}, null, 2));

if (apply && removePaths.length) {
  const { error } = await supabase.storage.from('assets').remove(removePaths);
  if (error) throw error;
  console.log(`Removed ${removePaths.length} duplicate video file(s).`);
} else if (!apply) {
  console.log('Dry run only. Re-run with --apply to delete duplicate videos.');
}
