import assert from "node:assert/strict";
import fs from "node:fs";
import { mergeWebsiteBuilderAssetSources, normalizeSelectedAsset, normalizeWebsiteBuilderAssets } from "../lib/website-builder/mediaAssets.js";
import { collectVideoHeroMedia } from "../lib/website-builder/publishConfig.js";
import {
  mergeVideoHeroProps,
  normalizeVideoHeroBlock,
  normalizeVideoHeroBlocksForPersistence,
  resolveVideoHeroUrl,
  syncVideoHeroChaiDataBlocks,
} from "../lib/website-builder/videoHero.js";

const projectId = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const expectedUrl = "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1781469496342-opening-block-video1.mp4";
const modulesExpectedUrl = "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1781469561736-gr8-result-digital-solutions-modules1.mp4";
const currentModulesUrl = "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1786748330530-modules.mp4";
const staleModulesUrl = "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1786663183298-modules.mp4";
const homePath = `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/${projectId}/pages/home.json`;
const modulesPath = `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/${projectId}/pages/modules.json`;
const modulesEmergencyDraftPath = `website-builder-sites/_emergency-drafts/${projectId}/Modules.json`;

const legacyBlock = {
  id: 1781385365287,
  type: "video-hero",
  props: {
    videoSrc: expectedUrl,
    posterSrc: "",
    muted: false,
    loop: false,
  },
};

const normalized = normalizeVideoHeroBlock(legacyBlock);
assert.equal(normalized.props.videoUrl, expectedUrl);
assert.equal(normalized.props.videoSrc, undefined);
assert.equal(resolveVideoHeroUrl(normalized.props), expectedUrl);

const merged = mergeVideoHeroProps(
  { videoUrl: expectedUrl, videoStoragePath: "assets/project/video.mp4", muted: false },
  { title: "Edited title" },
);
assert.equal(merged.videoUrl, expectedUrl);
assert.equal(merged.videoStoragePath, "assets/project/video.mp4");
assert.equal(merged.muted, false);
assert.equal(merged.title, "Edited title");

const removed = mergeVideoHeroProps({ videoUrl: expectedUrl }, { videoUrl: "" }, { removeVideo: true });
assert.equal(removed.videoUrl, "");

const unsafeNormalized = normalizeVideoHeroBlock({
  id: "temp-video",
  type: "video-hero",
  props: {
    videoUrl: "blob:http://localhost:3000/temp-video",
    videoSrc: currentModulesUrl,
  },
});
assert.equal(unsafeNormalized.props.videoUrl, currentModulesUrl);

const modulesSaveBlocks = normalizeVideoHeroBlocksForPersistence([
  {
    id: "1781468862706",
    type: "video-hero",
    props: {
      videoUrl: currentModulesUrl,
      videoStoragePath: "35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1786748330530-modules.mp4",
      videoFileName: "modules.mp4",
      videoMimeType: "video/mp4",
      headline: "Modules",
    },
  },
  { id: "modules-copy", type: "text-section", props: { body: "Edited unrelated text" } },
]);
const staleChaiData = {
  blocks: [
    {
      id: "1781468862706",
      type: "video-hero",
      props: {
        videoUrl: staleModulesUrl,
        videoStoragePath: "35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1786663183298-modules.mp4",
      },
    },
  ],
  generatedAt: "2026-08-13T23:20:15.597Z",
};
const syncedChaiData = syncVideoHeroChaiDataBlocks(staleChaiData, modulesSaveBlocks);
assert.equal(syncedChaiData.blocks.length, 2);
assert.equal(syncedChaiData.blocks[0].props.videoUrl, currentModulesUrl);
assert.equal(syncedChaiData.blocks[0].props.videoStoragePath, "35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1786748330530-modules.mp4");
assert.equal(syncedChaiData.generatedAt, staleChaiData.generatedAt);

const freshChaiData = syncVideoHeroChaiDataBlocks(null, modulesSaveBlocks);
assert.equal(freshChaiData.blocks[0].props.videoUrl, currentModulesUrl);

const savedAfterUnrelatedEdit = mergeVideoHeroProps(modulesSaveBlocks[0].props, { headline: "Updated Modules heading" });
assert.equal(savedAfterUnrelatedEdit.videoUrl, currentModulesUrl);

const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
const homeBlocks = Array.isArray(home.blocks) ? home.blocks : [];
const homeBlock = homeBlocks.find((block) => String(block?.id || "") === "1781385365287");
assert.ok(homeBlock, "Affected Home Video Hero block is present");
assert.equal(homeBlock.type, "video-hero");
assert.equal(homeBlock.props.videoUrl, expectedUrl);
assert.equal(homeBlock.props.videoSrc, undefined);
assert.equal(homeBlock.props.posterSrc, undefined);

const chaiBlock = home?.chaiData?.blocks?.find((block) => String(block?.id || "") === "1781385365287");
assert.ok(chaiBlock, "Affected Home Video Hero block is present in chaiData");
assert.equal(chaiBlock.props.videoUrl, expectedUrl);
assert.equal(chaiBlock.props.videoSrc, undefined);

const modules = JSON.parse(fs.readFileSync(modulesPath, "utf8"));
const modulesBlocks = Array.isArray(modules.blocks) ? modules.blocks : [];
const modulesVideoBlock = modulesBlocks.find((block) => String(block?.type || "") === "video-hero");
assert.ok(modulesVideoBlock, "Modules page Video Hero block is present");
assert.equal(resolveVideoHeroUrl(modulesVideoBlock.props), modulesExpectedUrl);
const normalizedModulesBlock = normalizeVideoHeroBlock(modulesVideoBlock);
assert.equal(normalizedModulesBlock.props.videoUrl, modulesExpectedUrl);
assert.equal(normalizedModulesBlock.props.videoSrc, undefined);

const publishedModulesVideo = collectVideoHeroMedia({ Modules: [normalizedModulesBlock] })[0];
assert.equal(publishedModulesVideo.pageName, "Modules");
assert.equal(publishedModulesVideo.videoSrc, modulesExpectedUrl);

if (fs.existsSync(modulesEmergencyDraftPath)) {
  const draft = JSON.parse(fs.readFileSync(modulesEmergencyDraftPath, "utf8"));
  const draftVideoBlock = (Array.isArray(draft.blocks) ? draft.blocks : []).find((block) => String(block?.type || "") === "video-hero");
  assert.ok(draftVideoBlock, "Modules emergency draft Video Hero block is present");
  assert.ok(draftVideoBlock.props.videoUrl, "Modules emergency draft keeps canonical videoUrl");
  const collectedDraftVideo = collectVideoHeroMedia({ Modules: [draftVideoBlock] })[0];
  assert.equal(collectedDraftVideo.videoSrc, draftVideoBlock.props.videoUrl);
  if (draftVideoBlock.props.videoStoragePath) {
    assert.equal(collectedDraftVideo.videoStoragePath, draftVideoBlock.props.videoStoragePath);
  }
  if (draftVideoBlock.props.videoFileName) {
    assert.equal(collectedDraftVideo.videoFileName, draftVideoBlock.props.videoFileName);
  }
  if (draftVideoBlock.props.videoMimeType) {
    assert.equal(collectedDraftVideo.videoMimeType, draftVideoBlock.props.videoMimeType);
  }
}

const selectedVideo = normalizeSelectedAsset({
  name: "modules.mp4",
  type: "video/mp4",
  url: modulesExpectedUrl,
  storage_path: "35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1781469561736-gr8-result-digital-solutions-modules1.mp4",
});
assert.equal(selectedVideo.storagePath, selectedVideo.storage_path);
assert.equal(selectedVideo.src, modulesExpectedUrl);

const normalizedAssets = normalizeWebsiteBuilderAssets({ videos: [selectedVideo] });
assert.equal(normalizedAssets.videos[0].storagePath, selectedVideo.storagePath);

const mergedAssets = mergeWebsiteBuilderAssetSources({ videos: [selectedVideo] }, { videos: [selectedVideo] });
assert.equal(mergedAssets.videos.length, 1);
assert.equal(mergedAssets.videos[0].storagePath, selectedVideo.storagePath);

console.log(JSON.stringify({
  projectId,
  page: "Home",
  blockId: homeBlock.id,
  blockType: homeBlock.type,
  videoUrl: homeBlock.props.videoUrl,
  modulesPageVideoUrl: modulesExpectedUrl,
  canonicalHomeBlock: true,
  canonicalChaiBlock: true,
  modulesVideoNormalized: true,
  modulesVideoAssetMetadataRetained: true,
}, null, 2));
