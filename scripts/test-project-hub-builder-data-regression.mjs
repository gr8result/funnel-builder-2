import assert from "node:assert/strict";
import fs from "node:fs";

const visualBuilder = fs.readFileSync("pages/modules/website-builder/visual-builder.js", "utf8");
const publishEndpoint = fs.readFileSync("pages/api/websites/publish.js", "utf8");

assert.match(visualBuilder, /function countBuilderMediaReferences/);
assert.match(visualBuilder, /function countBuilderFullWidthSettings/);
assert.match(visualBuilder, /remoteHasMoreMedia/);
assert.match(visualBuilder, /remoteHasMoreFullWidthSettings/);

assert.match(publishEndpoint, /PROJECT_HUB_DRAFT_MEDIA_REGRESSION/);
assert.match(publishEndpoint, /PROJECT_HUB_PUBLISH_MEDIA_NORMALIZATION_REGRESSION/);
assert.match(publishEndpoint, /PROJECT_HUB_PUBLISH_READBACK_MEDIA_MISSING/);
assert.match(publishEndpoint, /Publish blocked: current draft appears incomplete compared with the live version\./);
assert.match(publishEndpoint, /Published website verification failed\. The published Project Hub page is missing saved images\./);
assert.match(publishEndpoint, /countProjectHubMediaReferences/);
assert.match(publishEndpoint, /collectProjectHubMediaReferences/);

console.log("Project Hub builder-data regression guards passed.");
