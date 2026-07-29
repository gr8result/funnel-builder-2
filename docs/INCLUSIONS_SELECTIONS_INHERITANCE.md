# Inclusions Selections Inheritance

Date: 2026-07-29

## Purpose

Inheritance lets builders define sensible defaults without copying selections manually into every room.

## Precedence

The resolver uses this order, lowest to highest:

1. Builder default
2. Project default
3. Area group default
4. Area default
5. Requirement override

A direct project selection always wins over inherited defaults.

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
