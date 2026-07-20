export function withProjectEstimateTemplateCopy(builder: any = {}, ownerId = "subscriber") {
  return {
    ...builder,
    sourceTemplateId: builder.sourceTemplateId || "approved-project-estimate",
    templateOwnerId: builder.templateOwnerId || ownerId,
    protectedMaster: false,
    savedAsSubscriberTemplate: true,
    updatedAt: new Date().toISOString(),
  };
}

export function projectEstimateEditorStorageKey(workbookId = "local") {
  return `project-estimate-editor:${workbookId}`;
}
