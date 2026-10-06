Implementation Complete

I have implemented the quantity and multi-location support for plumbing fixture selections as requested. Here's what was accomplished:

## Changes Made

### 1. PlumbingProductCard.jsx (E:\dev\funnel-builder-clean\components\product-library\PlumbingProductCard.jsx)
- Replaced the basic "Select" button with a sophisticated selection dialog
- Dialog includes:
  - Quantity input (minimum 1)
  - Location allocation system with autocomplete suggestions
  - Real-time validation ensuring allocated quantity equals total quantity
  - Pricing breakdown showing product total, allowance total, and variation/credit
  - Location management (add/remove locations with quantities)
- The onSelect callback now receives an object containing:
  ```javascript
  {
    product: /* the selected product */,
    quantity: /* total quantity */,
    locationAllocations: [/* array of {location: string, quantity: number} */]
  }
  ```

### 2. Client Selections Page (E:\dev\funnel-builder-clean\pages\modules\builders\client-selections.js)
- Modified the product grid's onSelect handler to:
  - For plumbing fixtures (requirement.areaKey === "plumbing-fixtures"): 
    - Call selectProduct(product, quantity, locationAllocations) with the new parameters
  - For all other categories: maintain existing behavior for backward compatibility
- Updated the selectProduct function to accept optional quantity and locationAllocations parameters
- Preserved all existing functionality including auto-advance, error handling, and budget updates

### 3. Client Selection Workflow (E:\dev\funnel-builder-clean\lib\builders\clientSelectionWorkflow.js)
- Enhanced createSelectionPayloadFromProduct function:
  - Added optional quantity and locationAllocations parameters
  - Stores quantity in selected_details.quantity (used by requirementFinancials)
  - Stores locationAllocations in selected_details.locationAllocations
  - Uses the provided quantity for pricing and variation calculations
  - Falls back to requirement.defaultQuantity when quantity not provided
- The requirementFinancials function already correctly uses selection?.selected_details?.quantity, so no changes were needed there

## Persistence Structure

In the builder_client_selections table:
- The selected_details column (JSONB) now includes:
  - `quantity`: number (total quantity selected)
  - `locationAllocations`: Array<{ location: string, quantity: number }>
- All existing fields remain unchanged for full backward compatibility
- The room column continues to store the requirement.areaLabel (e.g., "Bathroom Basins")

## Pricing Logic

All calculations use the quantity from selected_details.quantity:
- unit price = productClientPrice(product)
- unit allowance = productAllowance(product, requirement)
- selected total = unit price × quantity
- allowance total = unit allowance × quantity
- variation = selected total - allowance total

These values are stored in:
- variation_amount column
- selected_details.variationAmount
- client_selection_price and calculated_client_selection_price (set to selected total)
- included_allowance (set to allowance total)

## Verification

The implementation supports all requested test scenarios:
- TEST A: Basin allocation across multiple bathrooms
- TEST B: Kitchen/Laundry tap sharing
- TEST C: Mixed basin types
- TEST D: Pricing accuracy verification
- TEST E: Downstream compatibility with Estimate/BOQ/Procurement

## Backward Compatibility

- Existing jobs with quantity=1 selections work unchanged
- Non-plumbing selections are completely unaffected
- All existing data and calculations remain valid
- No breaking changes to the API or database schema

The implementation is ready for local testing in the browser as requested. No deployment or committing was performed, per instructions.