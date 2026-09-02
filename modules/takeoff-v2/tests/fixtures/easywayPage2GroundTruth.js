// Ground-truth fixture for the Easyway Page 2 plan used by the takeoff wall
// detector probes. Coordinates are canonical unrotated PDF page coordinates
// (points), never screen/container coordinates. This file is test-only: the
// production detector must not import it or use these walls as output.

export const easywayPage2GroundTruth = {
  planName: "Easyway Page 2 - Ground Floor Plan",
  source: "C:/Users/grant/Downloads/2 GROUND FLOOR PLAN.pdf",
  pageNumber: 1,
  pageSize: { width: 842, height: 1191 },
  scale: { mmPerDocumentUnit: 35.278 },
  exteriorWallBands: [
    { id: "ext-family-west", kind: "exterior", thicknessMm: 230, start: { x: 285, y: 401 }, end: { x: 463, y: 401 }, notes: "Family/dining upper west exterior run" },
    { id: "ext-alfresco-top", kind: "exterior", thicknessMm: 230, start: { x: 470, y: 418 }, end: { x: 611, y: 418 }, notes: "Alfresco/family upper exterior run" },
    { id: "ext-alfresco-east", kind: "exterior", thicknessMm: 230, start: { x: 614, y: 422 }, end: { x: 614, y: 609 }, notes: "Alfresco/family east exterior face" },
    { id: "ext-east-media", kind: "exterior", thicknessMm: 230, start: { x: 701, y: 610 }, end: { x: 701, y: 763 }, notes: "Media/study east exterior return" },
    { id: "ext-south-main", kind: "exterior", thicknessMm: 230, start: { x: 256, y: 763 }, end: { x: 701, y: 763 }, notes: "Southern exterior run across garage/foyer/study" },
    { id: "ext-garage-west", kind: "exterior", thicknessMm: 230, start: { x: 256, y: 612 }, end: { x: 256, y: 763 }, notes: "Garage west exterior wall" },
    { id: "ext-laundry-west", kind: "exterior", thicknessMm: 230, start: { x: 285, y: 498 }, end: { x: 285, y: 612 }, notes: "Laundry/garage west exterior segment" },
    { id: "ext-entry-recess", kind: "exterior", thicknessMm: 230, start: { x: 548, y: 723 }, end: { x: 611, y: 723 }, notes: "Entry/study recessed exterior segment" },
    { id: "ext-foyer-recess-west", kind: "exterior", thicknessMm: 230, start: { x: 548, y: 684 }, end: { x: 548, y: 723 }, notes: "Foyer recess vertical exterior return" },
    { id: "ext-media-west", kind: "exterior", thicknessMm: 230, start: { x: 548, y: 565 }, end: { x: 548, y: 684 }, notes: "Media west exterior/internal boundary run" },
  ],
  interiorWallBands: [
    { id: "int-family-dining", kind: "interior", thicknessMm: 90, start: { x: 612, y: 422 }, end: { x: 612, y: 613 }, notes: "Kitchen/pantry/family vertical partition" },
    { id: "int-pantry-north", kind: "interior", thicknessMm: 90, start: { x: 613, y: 614 }, end: { x: 667, y: 614 }, notes: "Pantry horizontal partition" },
    { id: "int-pantry-south", kind: "interior", thicknessMm: 90, start: { x: 617, y: 610 }, end: { x: 696, y: 610 }, notes: "Pantry/media horizontal run" },
    { id: "int-laundry-east", kind: "interior", thicknessMm: 90, start: { x: 356, y: 522 }, end: { x: 356, y: 635 }, notes: "Laundry/workshop partition" },
    { id: "int-workshop-north", kind: "interior", thicknessMm: 90, start: { x: 356, y: 522 }, end: { x: 454, y: 522 }, notes: "Workshop north wall" },
    { id: "int-workshop-east-angled", kind: "interior", thicknessMm: 90, start: { x: 454, y: 522 }, end: { x: 523, y: 590 }, notes: "Workshop angled wall" },
    { id: "int-powder-linen-west", kind: "interior", thicknessMm: 90, start: { x: 336, y: 448 }, end: { x: 336, y: 522 }, notes: "Powder/linen west partition" },
    { id: "int-linen-south", kind: "interior", thicknessMm: 90, start: { x: 336, y: 448 }, end: { x: 470, y: 448 }, notes: "Linen/dining horizontal partition" },
    { id: "int-stairs-east", kind: "interior", thicknessMm: 90, start: { x: 548, y: 510 }, end: { x: 548, y: 670 }, notes: "Stairs/media vertical partition" },
    { id: "int-media-north", kind: "interior", thicknessMm: 90, start: { x: 548, y: 565 }, end: { x: 702, y: 565 }, notes: "Media room north wall" },
    { id: "int-foyer-study", kind: "interior", thicknessMm: 90, start: { x: 548, y: 723 }, end: { x: 702, y: 723 }, notes: "Foyer/study partition" },
    { id: "int-study-west", kind: "interior", thicknessMm: 90, start: { x: 548, y: 723 }, end: { x: 548, y: 763 }, notes: "Study west/foyer return" },
  ],
  corners: [
    { id: "corner-family-west-top", type: "external", point: { x: 285, y: 401 } },
    { id: "corner-family-alfresco", type: "external", point: { x: 614, y: 422 } },
    { id: "corner-alfresco-east", type: "external", point: { x: 614, y: 609 } },
    { id: "corner-media-east-south", type: "external", point: { x: 701, y: 763 } },
    { id: "corner-garage-south-west", type: "external", point: { x: 256, y: 763 } },
    { id: "corner-entry-reentrant", type: "reentrant", point: { x: 548, y: 723 } },
  ],
  junctions: [
    { id: "t-pantry-kitchen", type: "T", point: { x: 612, y: 614 } },
    { id: "t-media-stairs", type: "T", point: { x: 548, y: 565 } },
    { id: "x-stair-core", type: "X", point: { x: 548, y: 670 } },
    { id: "t-laundry-workshop", type: "T", point: { x: 356, y: 522 } },
  ],
  endpoints: [
    { id: "end-garage-door-left", type: "opening_jamb", point: { x: 256, y: 763 } },
    { id: "end-garage-door-right", type: "opening_jamb", point: { x: 454, y: 763 } },
    { id: "end-study-entry", type: "opening_jamb", point: { x: 611, y: 723 } },
  ],
  openings: [
    { id: "garage-door-main", openingType: "garage-door", wallId: "ext-south-main", start: { x: 256, y: 763 }, end: { x: 454, y: 763 }, widthMm: 7000 },
    { id: "window-family-east", openingType: "window", wallId: "ext-alfresco-east", start: { x: 614, y: 475 }, end: { x: 614, y: 530 }, widthMm: 1900 },
    { id: "window-media-east", openingType: "window", wallId: "ext-east-media", start: { x: 701, y: 650 }, end: { x: 701, y: 705 }, widthMm: 1900 },
    { id: "door-foyer-entry", openingType: "door", wallId: "ext-entry-recess", start: { x: 570, y: 723 }, end: { x: 610, y: 723 }, widthMm: 1200 },
  ],
};

export function allGroundTruthWalls(fixture = easywayPage2GroundTruth) {
  return [...fixture.exteriorWallBands, ...fixture.interiorWallBands];
}
