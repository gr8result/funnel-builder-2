import assert from "node:assert/strict";
import {
  compareWebsitePublishIntegrity,
  createPublicationPayload,
  getPublishedAssetValidationFailures,
} from "../lib/website-builder/publishConfig.js";

const project = {
  id: "2208a52a-8175-477e-823c-fc6de7fe4afe",
  name: "GR8 Result Digital Solutions",
  pages: [{ id: "home", name: "Home", slug: "home", order: 0 }],
  brandAssets: {
    images: [
      { id: "hero-image", name: "Hero", src: "https://cdn.example.com/hero.png", type: "image/png" },
      { id: "marquee-icon", name: "Marquee Icon", src: "https://cdn.example.com/icon.svg", type: "image/svg+xml" },
    ],
    videos: [
      { id: "hero-video", name: "Hero Video", src: "https://cdn.example.com/hero.mp4", type: "video/mp4" },
    ],
  },
  pageBlocks: {
    Home: [
      {
        id: "hero-1",
        type: "hero",
        props: {
          backgroundImage: "__WB_PRESERVE_DATA_URL__",
          backgroundImageAssetId: "hero-image",
          floatingImage: "/imported/gr8-services/social-media.jpg",
          imageUrl: "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1779254218148-ChatGPT-Image-May-20--2026--02_12_55-PM.png",
        },
      },
      {
        id: "marquee-1",
        type: "marquee-strip",
        props: {
          items: [
            {
              text: "AI Website Builder",
              iconUrl: "__WB_PRESERVE_DATA_URL__",
              iconUrlAssetId: "marquee-icon",
            },
          ],
        },
      },
      {
        id: "video-1",
        type: "video-hero",
        props: {
          videoUrl: "__WB_PRESERVE_DATA_URL__",
          videoUrlAssetId: "hero-video",
        },
      },
    ],
  },
  globalFooterBlock: {
    id: "global-footer",
    type: "footer",
    props: {
      navigationLinks: [{ label: "Home", href: "/" }],
      companyLinks: [{ label: "Privacy Policy", href: "/privacy-policy" }],
    },
  },
};

const publication = createPublicationPayload(project);
const publishedBlocks = publication.site_data.pageBlocks.Home;

assert.equal(publishedBlocks[0].props.backgroundImage, "https://cdn.example.com/hero.png");
assert.equal(publishedBlocks[0].props.backgroundImageAssetId, "hero-image");
assert.equal(publishedBlocks[0].props.floatingImage, "https://app.gr8result.digital/imported/gr8-services/social-media.jpg");
assert.equal(publishedBlocks[0].props.imageUrl, "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1779576621033-Funnels-and-leads.png");
assert.equal(publishedBlocks[1].props.items[0].iconUrl, "https://cdn.example.com/icon.svg");
assert.equal(publishedBlocks[1].props.items[0].iconImage, "https://cdn.example.com/icon.svg");
assert.equal(publishedBlocks[2].props.videoUrl, "https://cdn.example.com/hero.mp4");

assert.deepEqual(getPublishedAssetValidationFailures(publication.site_data.publication.assetValidationReport), []);
assert.equal(compareWebsitePublishIntegrity(project, publication.site_data).ok, true);

const unsafePublication = createPublicationPayload({
  ...project,
  brandAssets: {},
  pageBlocks: {
    Home: [
      {
        id: "unsafe-image",
        type: "hero",
        props: {
          backgroundImage: "data:image/png;base64,abc123",
          imageSrc: "blob:http://localhost:3000/asset-1",
          iconUrl: "http://localhost:3000/icon.svg",
          desktopVideo: "https://example.supabase.co/storage/v1/object/sign/assets/private-video.mp4?token=abc",
          posterUrl: "https://example.supabase.co/storage/v1/object/authenticated/assets/private-poster.jpg",
          items: [
            {
              mobileImage: "uploads/mobile.jpg",
            },
          ],
        },
      },
    ],
  },
});
const failures = getPublishedAssetValidationFailures(unsafePublication.site_data.publication.assetValidationReport);
assert.equal(failures[0]?.type, "inline-data-asset-url");
assert.deepEqual(
  failures.map((failure) => failure.type).sort(),
  [
    "blob-asset-url",
    "inline-data-asset-url",
    "localhost-asset-url",
    "private-storage-asset-url",
    "relative-asset-url",
    "signed-storage-asset-url",
  ].sort()
);
assert.equal(failures.length, 6);

console.log("Website publish integrity regression checks passed.");
