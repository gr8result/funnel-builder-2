# Product Library Selections CSV Format

Use these columns for Product Library imports that should be available to Inclusions & Selections:

```csv
product_code,product_name,brand,range,model,description,category,subcategory,product_type,requirement_tags,compatible_area_types,tier,supplier,supplier_sku,builder_cost,client_price,allowance,currency,gst_treatment,colour,finish,size,width,fuel_type,mounting_type,installation_type,image_url_or_reference,product_url,active_status,availability_status
```

## Validation

The import preview validates:

- `product_name`
- `category`
- `subcategory`
- `requirement_tags`
- known machine-readable tags
- `tier`
- `supplier`

Use comma, semicolon or pipe separators for `requirement_tags`.

Example:

```csv
OV-WVE9516SD,Westinghouse 900 mm built-in oven,Westinghouse,,WVE9516SD,Demonstration product,Kitchen Appliances,Oven,Built-in Oven,"appliance,oven,built-in-oven,900mm",Kitchen,Premier,Harvey Norman Commercial,HNC-WVE9516SD,890,1250,1200,AUD,gst_inclusive,Stainless Steel,Stainless Steel,900 mm,900 mm,Electric,Built-in,Built-in,demo://appliance/oven,https://example.com/demo-product,active,available
```
