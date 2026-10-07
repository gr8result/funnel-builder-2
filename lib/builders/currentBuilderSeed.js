// Verified against the current commercial projects and existing Johnson job recovery fixtures.
// This is a migration profile for one builder, never a platform default.
export const CURRENT_BUILDER_WORKSPACE_ID = '846885cd-25b9-4eca-b9f9-3fd02f5882d8';
export function currentBuilderScheduleSeeds(workspaceId) {
  if (workspaceId !== CURRENT_BUILDER_WORKSPACE_ID) return [];
  return ['Classic Inclusions', 'Premier Inclusions', 'Premium Inclusions'].map(name => ({
    workspace_id: workspaceId, name, display_name: name, version: 1, active: true,
    metadata: { seed: 'current-builder-foundation', mappingStatus: 'UNMAPPED' },
  }));
}
