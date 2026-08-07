export type CanvaImportedElement = {
  sourceElementId: string;
  type: string;
  name?: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked: boolean;
  groupPath: string[];
  children?: CanvaImportedElement[];
  text?: string;
  richTextRuns?: Array<{
    start: number;
    end: number;
    fontFamily?: string;
    fontRef?: string;
    fontSize?: number;
    fontWeight?: number | string;
    fontStyle?: string;
    textDecoration?: string;
    colour?: string;
    letterSpacing?: number;
  }>;
  textAlign?: string;
  verticalAlign?: string;
  lineHeight?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  fit?: "cover" | "contain" | "fill";
  crop?: unknown;
  mask?: unknown;
  unsupported?: boolean;
};

export type CanvaImportedPage = {
  sourcePageId: string;
  pageIndex: number;
  width: number;
  height: number;
  background?: unknown;
  renderedPageAsset?: {
    sourceElementId: string;
    fileName?: string;
    mimeType?: string;
    publicUrl?: string;
    base64?: string;
  };
  elements: CanvaImportedElement[];
};

export type CanvaImportManifest = {
  schemaVersion: 1;
  source: "canva-app-design-editing-api";
  designId: string;
  designName: string;
  exportedAt: string;
  pageSize?: { width: number; height: number };
  pages: CanvaImportedPage[];
};
