export type ProjectEstimateEditorFieldType = "text" | "textarea" | "image" | "linkedField" | "static";

export type ProjectEstimateEditorField = {
  blockId: string;
  label: string;
  type: ProjectEstimateEditorFieldType;
  contentKey?: string;
  helpText?: string;
};

export type ProjectEstimateBlockDefault = {
  id: string;
  type: string;
  order: number;
  content?: Record<string, any>;
  design?: Record<string, any>;
};

export type ProjectEstimatePageDefinition = {
  id: string;
  navigationTitle: string;
  version: number;
  defaultContent: Record<string, any>;
  defaultBlocks: ProjectEstimateBlockDefault[];
  editorFields: ProjectEstimateEditorField[];
  validate?: (content: Record<string, any>) => string[];
  Component: (props: any) => JSX.Element;
};

export type EstimatePageProps = {
  content?: Record<string, any>;
  jobData?: Record<string, any>;
  selectedBlockId?: string;
  onSelectBlock?: (blockId: string) => void;
  [key: string]: any;
};
