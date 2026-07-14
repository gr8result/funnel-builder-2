import { hydrateDocument, serializeDocument } from "../core/documentState.js";
import { resolveDynamicText } from "../fields/workbookFieldResolver.js";

export function renderDocumentForPdf(document, workbook = null) {
  const hydrated = hydrateDocument(document);
  const serialised = serializeDocument(hydrated);
  return {
    ...serialised,
    pages: serialised.pages.map((page) => ({
      ...page,
      objects: page.objects.map((object) => ({
        ...object,
        renderedText: object.data?.text ? resolveDynamicText(object.data.text, workbook) : undefined,
      })),
    })),
  };
}
