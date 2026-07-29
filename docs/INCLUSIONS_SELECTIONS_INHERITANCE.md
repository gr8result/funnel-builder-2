# Inclusions Selections Inheritance

Date: 2026-07-29

## Purpose

Inheritance lets builders define sensible defaults without copying selections manually into every room.

## Precedence

Selection inheritance in later stages uses this order, lowest to highest:

1. Builder default
2. Project default
3. Area group default
4. Area default
5. Requirement override

A direct project selection always wins over inherited defaults.

## Template Stage Precedence

Room template and inclusion tier assignment uses this Stage 2 order, lowest to highest:

1. Project default
2. AreaGroup override
3. AreaType override
4. ProjectArea override

AreaTemplate and InclusionTier remain separate values. Resetting a ProjectArea override returns to AreaType, then AreaGroup, then Project default.

## Reset Behaviour

Resetting an override removes the direct selection from consideration and resolves the effective value from defaults again. Reset does not delete defaults.

## Apply-To Behaviour

`previewApplySelection` returns compatibility results before anything is saved. `applySelectionPreview` creates draft selection records only for compatible targets.

Supported scopes:

- `single_requirement`
- `same_area_type`
- `same_category`
- `whole_project`

Bulk application remains requirement-first. It cannot create areas, invent requirements, or force incompatible products onto a room.

## Stage 3 Workspace Apply-To

The Stage 3 workspace expands the visible Apply To scopes through `previewApplyTo` and `applySelectionToTargets`:

- `this_requirement`
- `this_room`
- `selected_rooms`
- `all_rooms_of_area_type`
- `all_rooms_in_area_group`
- `every_compatible_requirement`

The preview lists compatible, incompatible and skipped targets before mutation. Applying a selection creates or replaces draft ProjectSelection records only for compatible, selected targets and creates traceable SelectionLocations for each changed requirement.

## Stage 3 Reset

`resetSelectionToInherited` removes the draft ProjectSelection for a requirement. The workspace then displays the next effective inherited template/tier source from Stage 2. Reset does not approve, snapshot or export a selection.
