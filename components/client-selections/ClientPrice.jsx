// Client price privacy for Client Selections.
//
// The client never sees the full price of an item, an allowance amount, or the builder's cost. In
// client view every price is shown only as the DIFFERENCE from the item's allowance - an upgrade
// (+$126.00), a downgrade (-$84.00) or "Included in your allowance" - in client dollars: the
// builder's margin and GST added to the cost difference (clientPriceOfCost, the quotation's own
// settings). Builder view keeps the full figures.
//
// The context defaults to CLIENT view, so a screen without a provider shows no prices.
import { createContext, useContext } from "react";
import { clientPriceOfCost } from "../../lib/builders/selectionVariationPricing.js";

export const ClientPriceContext = createContext({ clientView: true, rules: null });
export const useClientPriceView = () => useContext(ClientPriceContext);

const format = (value) => `$${Math.abs(value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The client amount (inc GST, margin included) of a cost difference ex GST; null when unknown.
export function clientDifferenceIncGst(costDifferenceExGst, rules = null) {
  if (costDifferenceExGst === null || costDifferenceExGst === undefined || costDifferenceExGst === "") return null;
  const cost = Number(costDifferenceExGst);
  if (!Number.isFinite(cost)) return null;
  return Math.abs(cost) < 0.005 ? 0 : clientPriceOfCost(cost, rules).incGst;
}

export function formatClientDifference(amountIncGst, { pending = "Price difference to be confirmed" } = {}) {
  if (amountIncGst === null || amountIncGst === undefined || !Number.isFinite(Number(amountIncGst))) return pending;
  const amount = Number(amountIncGst);
  if (Math.abs(amount) < 0.005) return "Included in your allowance";
  return amount > 0 ? `Upgrade +${format(amount)}` : `Downgrade -${format(amount)}`;
}

// A cost difference (ex GST, as saved on a selection) shown as the client's upgrade / downgrade.
// In builder view `builder` (the existing full display) is rendered unchanged.
export function ClientDifference({ costExGst, builder = null, pending }) {
  const { clientView, rules } = useClientPriceView();
  if (!clientView) return builder;
  const amount = clientDifferenceIncGst(costExGst, rules);
  const tone = amount > 0 ? "upgrade" : amount < 0 ? "downgrade" : "";
  return <span className={`clientPriceDifference ${tone}`} data-testid="client-price-difference">{formatClientDifference(amount, pending ? { pending } : {})}</span>;
}

// A full price, allowance or total: rendered in builder view only. In client view `replacement`
// (usually a ClientDifference) or nothing.
export function HideFromClient({ children, replacement = null }) {
  const { clientView } = useClientPriceView();
  return clientView ? replacement : children;
}
