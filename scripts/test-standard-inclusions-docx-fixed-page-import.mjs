import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { importDocxAsStandardDocumentPreview, emuToDocumentUnits, twipsToDocumentUnits, documentUnitsToTwips } from "../lib/standard-inclusions/docxImport.js";

globalThis.DOMParser = new JSDOM("").window.DOMParser;
globalThis.btoa = globalThis.btoa || ((value) => Buffer.from(value, "binary").toString("base64"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function buildDesignedDocxFixture() {
  const zip = new JSZip();
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
      <Pages>9</Pages>
    </Properties>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
    </Relationships>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  zip.file("word/numbering.xml", `<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  zip.file("word/media/image1.png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <w:body>
        <w:p>
          <w:r><w:t>Designed page heading</w:t></w:r>
        </w:p>
        <w:p>
          <w:r>
            <w:drawing>
              <wp:anchor behindDoc="0" relativeHeight="251659264">
                <wp:positionH relativeFrom="page"><wp:posOffset>914400</wp:posOffset></wp:positionH>
                <wp:positionV relativeFrom="page"><wp:posOffset>1828800</wp:posOffset></wp:positionV>
                <wp:extent cx="2743200" cy="1371600"/>
                <wp:wrapSquare/>
                <wp:docPr id="1" name="Hero image"/>
                <a:graphic>
                  <a:graphicData>
                    <pic:pic>
                      <pic:blipFill><a:blip r:embed="rIdImage1"/></pic:blipFill>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
                <w:txbxContent>
                  <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>Keep this textbox together</w:t></w:r></w:p>
                  <w:p><w:r><w:t>Second textbox paragraph</w:t></w:r></w:p>
                </w:txbxContent>
              </wp:anchor>
            </w:drawing>
          </w:r>
        </w:p>
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/>
        </w:sectPr>
      </w:body>
    </w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}

async function buildNinePageAnchoredDocxFixture() {
  const zip = new JSZip();
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
      <Pages>9</Pages>
    </Properties>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      ${Array.from({ length: 9 }, (_, index) => `<Relationship Id="rIdImage${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${index + 1}.png"/>`).join("")}
    </Relationships>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  zip.file("word/numbering.xml", `<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  for (let index = 0; index < 9; index += 1) {
    zip.file(`word/media/image${index + 1}.png`, Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, index]));
  }
  const pageParagraphs = Array.from({ length: 9 }, (_, index) => `
    <w:p>
      <w:r>
        <w:drawing>
          <wp:anchor behindDoc="0" relativeHeight="${251659264 + index}">
            <wp:positionH relativeFrom="page"><wp:posOffset>914400</wp:posOffset></wp:positionH>
            <wp:positionV relativeFrom="page"><wp:posOffset>914400</wp:posOffset></wp:positionV>
            <wp:extent cx="914400" cy="914400"/>
            <wp:wrapNone/>
            <wp:docPr id="${index + 1}" name="Page ${index + 1} image"/>
            <a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rIdImage${index + 1}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic>
            <w:txbxContent><w:p><w:r><w:t>Page ${index + 1} overlay textbox</w:t></w:r></w:p></w:txbxContent>
          </wp:anchor>
        </w:drawing>
      </w:r>
    </w:p>`).join("");
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <w:body>
        ${pageParagraphs}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/>
        </w:sectPr>
      </w:body>
    </w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}

async function buildMismatchedFlowDocxFixture() {
  const zip = new JSZip();
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
      <Pages>9</Pages>
    </Properties>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  zip.file("word/numbering.xml", `<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>A short ordinary flow document.</w:t></w:r></w:p>
        <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
      </w:body>
    </w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}

const bytes = await buildDesignedDocxFixture();
const file = new File([bytes], "standard-inclusions-designed.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});
const uploaded = [];
const preview = await importDocxAsStandardDocumentPreview(file, {
  uploadAsset: async (dataUrl) => {
    uploaded.push(dataUrl);
    return `https://assets.example.test/docx-image-${uploaded.length}.png`;
  },
});

assert(Math.round(emuToDocumentUnits(914400)) === 96, "1 inch in EMUs must convert to 96 document units");
assert(Math.round(twipsToDocumentUnits(1440)) === 96, "1 inch in twips must convert to 96 document units");
assert(Math.round(documentUnitsToTwips(96)) === 1440, "96 document units must convert back to 1440 twips");
assert(preview.layoutMode === "fixed-page", "Designed DOCX must import in fixed-page mode");
assert(preview.sourcePageCount === 9, "Source page count must come from docProps/app.xml");
assert(preview.pageCount === 9, "Fixed-page importer must preserve the 9 source pages");
assert(!preview.validation?.mismatch, "Matching fixed-page import must not be blocked");
assert(preview.textBoxCount === 1, "Text boxes must be detected");
assert(preview.floatingImageCount === 1, "Anchored floating images must be detected");
assert(uploaded.length === 1, "Anchored image must upload once");

const firstPageObjects = preview.document.pages[0].objects;
const anchoredImage = firstPageObjects.find((object) => object.type === "image" && object.data?.docxFixedElement);
const textBox = firstPageObjects.find((object) => object.type === "text" && object.data?.blockType === "textBox");
assert(anchoredImage?.data?.imageRef?.startsWith("https://assets.example.test/"), "Imported image must store a URL, not base64");
assert(anchoredImage.x === 96 && anchoredImage.y === 192, "Anchored image must preserve page-relative EMU position");
assert(textBox?.data?.text?.includes("Keep this textbox together"), "Text box text must stay in one positioned object");
assert(!firstPageObjects.some((object) => object.data?.text?.includes("Second textbox paragraph") && object.data?.blockType !== "textBox"), "Text-box paragraphs must not enter main flow");

const ninePageBytes = await buildNinePageAnchoredDocxFixture();
const ninePagePreview = await importDocxAsStandardDocumentPreview(new File([ninePageBytes], "nine-page-designed.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}), {
  uploadAsset: async () => "https://assets.example.test/nine-page-image.png",
});
assert(ninePagePreview.pageCount === 9, "Designed DOCX with 9 source pages must import as exactly 9 pages");
assert(ninePagePreview.validation?.mismatch === false, "9-page fixed import must not trigger page-count mismatch");
assert(ninePagePreview.document.pages.every((page) => page.objects.some((object) => object.data?.docxFixedElement)), "Source-order fixed-page fallback must distribute anchored elements across all 9 pages");
assert(!ninePagePreview.document.pages.some((page) => page.objects.some((object) => object.type === "spacer")), "Anchor-only paragraphs must not become fake spacer objects");

const mismatchBytes = await buildMismatchedFlowDocxFixture();
const mismatchPreview = await importDocxAsStandardDocumentPreview(new File([mismatchBytes], "stale-page-count-flow.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}), {
  uploadAsset: async () => "",
});
assert(mismatchPreview.layoutMode === "flow", "Plain documents must still use flow mode");
assert(mismatchPreview.validation?.mismatch, "Page-count mismatch must be rejected by review metadata");
assert(mismatchPreview.validation?.message.includes("Source: 9 pages"), "Mismatch message must show source page count");

console.log("Standard Inclusions DOCX fixed-page import tests passed.");
