import { useState } from "react";
import { ProductBrowser, FLOORING_BROWSER_CSS } from "../client-selections/FlooringSelectionWorkflow.jsx";
import { flooringCountsByType, isFlooringProduct } from "../../lib/product-library/flooringCatalogue.js";

export default function FlooringLibraryBrowser({ products = [] }) {
  const [type, setType] = useState("carpet");
  const flooring = products.filter(isFlooringProduct);
  return <section className="fl-shell" data-testid="product-library-flooring-browser">
    <style>{FLOORING_BROWSER_CSS}</style>
    <ProductBrowser type={type} products={flooring} counts={flooringCountsByType(flooring)} onType={setType} />
  </section>;
}
