# Inclusions & Selections Architecture

Inclusions & Selections uses the Product Library as the source of selectable product options.

The Product Library provides:

- approved selection requirement families from the source CSV
- exact area/category/family context
- organisation-scoped supplier catalogues
- stable quote/source linkage for future export

The Quotation Builder remains unchanged. Quote rows, formulas, rates, layouts and calculations are not modified by the Product Library.

Future completed selections can export:

- quote item code or approved source key
- selected product code
- area and room
- quantity and unit
- selected variant
- selected price
- allowance and variation
- supplier
- notes

This task does not implement the final Quotation Builder import.
