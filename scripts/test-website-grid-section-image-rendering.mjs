import assert from "node:assert/strict";
import {
  normalizeGridSectionImageUrl,
  resolveGridSectionItemImageUrl,
} from "../lib/website-builder/gridSectionImages.js";

const platformBase = "https://app.gr8result.digital";
const emailSmsImage = "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1779254187290-ChatGPT-Image-May-20--2026--03_08_59-PM.png";

const cards = [
  {
    title: "Email & SMS Marketing",
    image: emailSmsImage,
    expected: emailSmsImage,
  },
  {
    title: "Social Media",
    image: "/imported/gr8-services/social-media.jpg",
    expected: `${platformBase}/imported/gr8-services/social-media.jpg`,
  },
  {
    title: "CRM Software",
    image: "/imported/gr8-services/software.png",
    expected: `${platformBase}/imported/gr8-services/software.png`,
  },
  {
    title: "Website Builder",
    image: "/imported/gr8-services/websites.jpg",
    expected: `${platformBase}/imported/gr8-services/websites.jpg`,
  },
];

for (const card of cards) {
  assert.equal(
    resolveGridSectionItemImageUrl(card, null, { platformBase }),
    card.expected,
    `${card.title} image should resolve to the live-loadable URL`
  );
}

assert.equal(
  resolveGridSectionItemImageUrl({ title: "Alias", imageUrl: "/imported/gr8-services/social-media.jpg" }, null, { platformBase }),
  `${platformBase}/imported/gr8-services/social-media.jpg`
);

assert.equal(
  resolveGridSectionItemImageUrl({ title: "Alias", cardImage: "/imported/gr8-services/websites.jpg" }, null, { platformBase }),
  `${platformBase}/imported/gr8-services/websites.jpg`
);

assert.equal(normalizeGridSectionImageUrl("blob:http://localhost/example", platformBase), "");
assert.equal(normalizeGridSectionImageUrl("file:///tmp/image.png", platformBase), "");

console.log("Website Grid Section image rendering checks passed.");
