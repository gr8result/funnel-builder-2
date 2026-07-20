import assert from "node:assert/strict";
import fs from "node:fs";
import { mergeVideoHeroProps, normalizeVideoHeroBlock, resolveVideoHeroUrl } from "../lib/website-builder/videoHero.js";

const projectId = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const expectedUrl = "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1781469496342-opening-block-video1.mp4";
const homePath = `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/${projectId}/pages/home.json`;

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

console.log(JSON.stringify({
  projectId,
  page: "Home",
  blockId: homeBlock.id,
  blockType: homeBlock.type,
  videoUrl: homeBlock.props.videoUrl,
  canonicalHomeBlock: true,
  canonicalChaiBlock: true,
}, null, 2));
