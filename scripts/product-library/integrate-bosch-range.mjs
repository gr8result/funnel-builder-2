import { readFileSync, writeFileSync } from 'fs';

// Load and parse the JSON files
const catalogueFilePath = 'data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json';
const boschRangeFilePath = 'data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json';
const catalogue = JSON.parse(readFileSync(catalogueFilePath, 'utf8'));
const boschRange = JSON.parse(readFileSync(boschRangeFilePath, 'utf8'));

// Step 1 - Gather facts about the current catalogue
const currentProductCount = catalogue.products.length;
const currentBrands = [...new Set(catalogue.products.map(prod => prod.brandName))];
const boschProductsInCatalogue = catalogue.products.filter(prod => prod.brandName.toLowerCase().includes('bosch'));
const boschProductModelsToCheck = ['HBA534BS0A', 'PCR6A5B90A', 'DWP66BC50A', 'SMS4HTI01A', 'BFL523MS0A'];
const boschProductsStatus = boschProductModelsToCheck.map(model => ({
  model,
  existsInCatalogue: boschProductsInCatalogue.some(prod => prod.manufacturerModel === model),
}));
const overlapBoschModels = boschRange.products.filter(boschProd => 
  catalogue.products.some(catProd => catProd.manufacturerModel === boschProd.manufacturerModel)
);
const categoryIds = [...new Set(catalogue.products.map(prod => prod.categoryId))];
const representativeProducts = categoryIds.map(categoryId => (
  catalogue.products.find(prod => prod.categoryId === categoryId)
));
const existingBrandStructure = catalogue.products.find(prod => prod.brandName === 'Blanco') || {};

const productIdCounts = catalogue.products.reduce((acc, curr) => {
  acc[curr.productId] = (acc[curr.productId] || 0) + 1;
  return acc;
}, {});
const duplicateProductIds = Object.keys(productIdCounts).filter(productId => productIdCounts[productId] > 1);

const modelCombinationCounts = catalogue.products.reduce((acc, { brandName, manufacturerModel }) => {
  const key = `${brandName}_${manufacturerModel}`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
const duplicateModelCombinations = Object.keys(modelCombinationCounts).filter(key => modelCombinationCounts[key] > 1);

// Log the results for step 1
console.log('Current Product Count:', currentProductCount);
console.log('Current Brands:', currentBrands);
console.log('Bosch Products in Catalogue:', boschProductsInCatalogue);
console.log('Bosch Products Status:', boschProductsStatus);
console.log('Overlapping Bosch Models:', overlapBoschModels);
console.log('Category IDs:', categoryIds);
console.log('Representative Products:', representativeProducts);
console.log('Existing Brand Structure (Blanco Example):', existingBrandStructure);
console.log('Duplicate Product IDs:', duplicateProductIds);
console.log('Duplicate Model Combinations:', duplicateModelCombinations);

// Step 3 - Perform Bosch Integration
function integrateBosch() {
  const newBoschProducts = boschRange.products.map(boschProd => {
    const productTypeMap = {
      'CMA583MB0B': 'microwave',
      'BIC7101B1A': 'warming-drawer',
      'BIC9101B1': 'warming-drawer',
      'BVE9101B1': 'vacuum-drawer',
      'HSB738357A': 'freestanding-cooker'
    };

    const familyIdMap = {
      'microwave': 'microwaves',
      'warming-drawer': 'warming-drawers',
      'vacuum-drawer': 'vacuum-drawers',
      'freestanding-cooker': 'cookers',
    };

    const productCategory = productTypeMap[boschProd.manufacturerModel] || boschProd.family_key;
    const isSelectable = !['vacuum-drawer', 'warming-drawer'].includes(productCategory);

    const newProduct = {
      productId: `product:${familyIdMap[productCategory] || 'appliances'}:${boschProd.manufacturer.toLowerCase()}:${boschProd.model.toLowerCase()}`,
      schemaVersion: catalogue.schemaVersion,
      categoryId: 'category:appliances',
      familyId: familyIdMap[productCategory] || boschProd.family_key,
      productType: productCategory,
      brandId: 'brand:bosch',
      brandName: 'Bosch',
      manufacturerModel: boschProd.manufacturerModel,
      productName: boschProd.product_name,
      shortDescription: boschProd.product_name,
      fullDescription: boschProd.description,
      specifications: {
        family: boschProd.family_key,
        manufacturerModel: boschProd.manufacturerModel,
        width: boschProd.width,
        widthMm: boschProd.widthMm || null,
      },
      selectable: isSelectable,
      active: typeof boschProd.active === 'string' ? boschProd.active.toLowerCase() === 'true' : boschProd.active,
      // ... existing code to complete
    };
    return newProduct;
  }).filter(newProduct => {
    // Check for duplicates based on model
    return !catalogue.products.some(catalogueProd => catalogueProd.manufacturerModel === newProduct.manufacturerModel);
  });

  catalogue.products.push(...newBoschProducts);
  writeFileSync(catalogueFilePath, JSON.stringify(catalogue, null, 2));
  console.log(`Integrated ${newBoschProducts.length} new Bosch products.`);
}

integrateBosch();