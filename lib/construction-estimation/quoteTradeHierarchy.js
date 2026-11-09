// Which existing trade a Client Selections / room-tiling section is shown under in the Quotation
// Builder (8 Nov 2026). Display only: the generated section stays its own saved section with its own
// rows and subtotal; the trade heading shows its own subtotal plus its children, and the quote total
// still adds every section once. Names are compared in lower case with the "(nn)" number removed.
// A generated section with no rule here, or whose trade is not in the job, stays a main category.
export const CLIENT_SELECTION_TRADE_PARENTS = [
  { match: (name) => name.startsWith("tiling - "), parents: ["tiling"] },
  { match: (name) => name === "electrical - client selections" || name === "electrical - lighting - client selections", parents: ["electrical"] },
  { match: (name) => name === "plumbing fit off - client selections", parents: ["plumbing fittings & tapwear"] },
  { match: (name) => name === "plumbing - hot water - client selections", parents: ["hot water"] },
  { match: (name) => name === "fix out - client selections" || /^fix out - .+ - client selections$/.test(name), parents: ["fix out", "fix out materials"] },
  { match: (name) => name === "shower screens & mirrors - client selections", parents: ["mirrors & shower screens"] },
  { match: (name) => name === "stairs & balustrades - client selections", parents: ["stairs"] },
  { match: (name) => name === "floor coverings - client selections" || name === "floorcoverings - client selections", parents: ["floorcoverings"] },
  { match: (name) => name === "entry door furniture - client selections", parents: ["doors", "door furniture"] },
  { match: (name) => name === "air conditioning - client selections", parents: ["air conditioners"] },
  { match: (name) => name === "painting - client selections", parents: ["painter"] },
];

// Candidate trade names, in order of preference, for a generated section's base name.
export function clientSelectionTradeParentNames(baseName = "") {
  return CLIENT_SELECTION_TRADE_PARENTS.find((rule) => rule.match(String(baseName)))?.parents || [];
}
