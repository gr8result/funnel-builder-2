// Which guided requirement a Selections Book row belongs to.
//
// A row that a guided workflow has written is OWNED by that requirement: its
// guidedSelection.requirementKey (the saved selection) or, failing that, its guidedRequirementKey.
// An owned row must never be matched to a different requirement by its display label. Before this
// rule, an Entry Door saved into the row labelled "Bricks" was still found by the Bricks card
// (label match), so the Bricks card showed a Corinthian entry door.

export function selectionRowOwner(row = {}) {
  return String(row?.guidedSelection?.requirementKey || row?.guidedRequirementKey || "").trim();
}

// ownerAliases: keys that legitimately denote the same requirement (e.g. a legacy "entry-doors").
export function rowOwnedByOtherRequirement(row = {}, requirementKey = "", ownerAliases = []) {
  const owner = selectionRowOwner(row);
  if (!owner || !requirementKey) return false;
  if (owner === requirementKey) return false;
  return !ownerAliases.includes(owner);
}

export function rowOwnedByRequirement(row = {}, requirementKey = "") {
  return Boolean(requirementKey) && selectionRowOwner(row) === requirementKey;
}
