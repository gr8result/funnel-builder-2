# Inclusions & Selections Product Picker

Stage 3 now follows the practical room workflow:

1. Open a room, such as Kitchen.
2. Click a Selection Item, such as Oven.
3. A large product picker modal opens.
4. Compatible Product Library items are shown.
5. Filter by search, brand, supplier, tier, width, fuel type and availability.
6. Choose a required variant where needed.
7. Click Select.
8. The product is assigned to that exact room requirement, priced and saved.

The modal uses the shared `ProductSelectionCatalogueAdapter` boundary. The development adapter supplies realistic demonstration products, all labelled as demonstration and indicative pricing.

The selection service still creates the draft `ProjectSelection`, room location, allowance, selected price, GST and variation. The UI hides internal model names behind user-facing labels: Room or Area, Selection Item, Selected Product and Applied Locations.

Apply To uses the existing compatibility preview and only offers compatible room requirements.
