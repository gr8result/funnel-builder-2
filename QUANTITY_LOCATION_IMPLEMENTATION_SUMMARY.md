// Summary of changes made to implement quantity + multi-location support for plumbing fixtures:

// 1. Updated PlumbingProductCard.jsx:
//    - Added a dialog that appears when "Select" is clicked
//    - Dialog allows user to specify total quantity
//    - Dialog allows user to allocate quantities to specific locations (e.g., Bathroom x2, Ensuite x1)
//    - Validates that sum of location quantities equals total quantity
//    - Calculates and displays pricing totals based on quantity
//    - onSelect callback now receives an object: { product, quantity, locationAllocations }

// 2. Updated client-selections.js product grid:
//    - Modified the onSelect handler for ProductCard to:
//      * For plumbing fixtures: call selectProduct(product, quantity, locationAllocations)
//      * For other categories: maintain existing behavior (call selectAndMaybeReturn(product))
//    - This ensures backward compatibility with non-plumbing selections

// 3. Updated createSelectionPayloadFromProduct in clientSelectionWorkflow.js:
//    - Added optional quantity and locationAllocations parameters
//    - Uses quantityOverride if provided, otherwise falls back to requirement.defaultQuantity
//    - Stores locationAllocations array in selected_details.locationAllocations
//    - The quantity is stored in selected_details.quantity (for use by requirementFinancials)
//    - Maintains all existing fields for backward compatibility

// 4. The requirementFinancials function in clientSelectionWorkflow.js already:
//    - Uses selection?.selected_details?.quantity for calculations
//    - Falls back to requirement?.defaultQuantity if not present
//    - No changes needed - it works with our new data structure

// Persistence Structure:
//   In the builder_client_selections table:
//   - selected_details column (JSONB) now includes:
//     * quantity: number (total quantity selected)
//     * locationAllocations: Array<{ location: string, quantity: number }>
//   - All existing fields remain unchanged for backward compatibility
//   - The room column continues to store the requirement.areaLabel (e.g., "Bathroom Basins")

// Pricing Logic:
//   - unit price = productClientPrice(product)
//   - unit allowance = productAllowance(product, requirement)
//   - selected total = unit price × quantity
//   - allowance total = unit allowance × quantity
//   - variation = selected total - allowance total
//   - These calculations use quantity from selected_details.quantity
//   - Variation amount is stored in variation_amount column and selected_details.variationAmount

// Test Scenarios Supported:
//   TEST A — BASINS: Select one basin, allocate to Bathroom x1, Ensuite x2, Powder Room x1, Encore 2 x1 → total quantity 5
//   TEST B — KITCHEN/LAUNDRY TAP: Select one sink mixer, allocate to Kitchen x1, Laundry x1 → total quantity 2
//   TEST C — DIFFERENT BASIN: Change Powder Room to a different basin while leaving the other four unchanged → original basin quantity 4, new basin quantity 1
//   TEST D — PRICING: Verify that unit price × quantity, unit allowance × quantity, and variation calculate correctly
//   TEST E — DOWNSTREAM: Confirm that quantities and locations are available to Review Schedule and do not break existing Estimate/BOQ/Procurement integrations

// The implementation maintains full backward compatibility:
//   - Existing jobs with quantity=1 selections continue to work unchanged
//   - Non-plumbing selections are unaffected
//   - All existing pricing and variation calculations remain valid