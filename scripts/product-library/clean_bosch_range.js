const fs = require('fs');
const path = require('path');

// Load the existing Bosch appliance range JSON
const filePath = path.resolve(__dirname, '../../data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json');
let productData;

try {
  const data = fs.readFileSync(filePath, 'utf8');
  productData = JSON.parse(data);
} catch (err) {
  console.error('Error reading the Bosch appliance range file:', err);
  return;
}

// Define the cleanup modifications
productData.products = productData.products.map(product => {
  // Remove disclaimers and boilerplate text from descriptions
  product.description = product.description.replace(/(ALL PRICES .+?MISPRINTS\.)/g, '')
    .replace(/\n/g, ' ').trim().replace(/^\s+|\s+$/g, '');

  // Enhanced feature cleaning logic
  const validFeatures = product.features.filter(feature => {
    // Define a set of recognized non-product feature terms
    const invalidTerms = [
      /^Outdoor/, /Heating/, /Audio/, /Colour/, /Brand/, /Taren Point/, /Commercial Equipment/, /Products/,
      /account/i, /cart/i, /login/i, /register/i, /contact/i, /showroom/i, /delivery/i, /freight/i,
      /finance/i, /navigation/i, /terms/i, /privacy/i, /Harvey Norman/i, /breadcrumb/i,
      /categories/i
    ];

    // Test if any invalid term matches the current feature
    return !invalidTerms.some(term => term.test(feature));
  });

  product.features = validFeatures.length ? validFeatures : [];
  // Correct the known problematic categories
  const categoryMap = {
    'CMA583MB0B': 'Microwave',
    'BIC7101B1A': 'Warming Drawer',
    'BIC9101B1': 'Warming Drawer',
    'BVE9101B1': 'Vacuum Drawer',
    'HSB738357A': 'Freestanding Cooker'
  };
  product.category_key = categoryMap[product.manufacturerModel] || product.category_key;

  // Correct fuel type for known items
  if (product.manufacturerModel === 'HSB738357A') {
    product.fuelOrEnergyType = 'Multi-Fuel';
    product.configuration = 'Gas & Electric';
  }

  // Correct finishes if sourced
  const finishMap = {
    'PBH6B5K90A': 'Stainless Steel',
    'PKE611CA2A': 'Black Glass',
    'PKE611BA2A': 'Black Glass',
    'PUG611AA5H': 'Black Glass'
  };
  product.finish = finishMap[product.manufacturerModel] || product.finish;

  // Width validation and cleanup
  const confirmedWidths = {
    'CMA583MB0B': 594
  };
  if (!(product.manufacturerModel in confirmedWidths) || product.widthMm !== confirmedWidths[product.manufacturerModel]) {
    product.width = null;
    product.widthMm = null;
  }

  // Update the image status for known technical drawings
  if (product.manufacturerModel === 'PUG611AA5H') {
    product.image_status = 'technical-drawing-verified';
  }
  return product;
});

// Write the modified data back to the JSON file
try {
  fs.writeFileSync(filePath, JSON.stringify(productData, null, 2));
  console.log('Bosch JSON cleanup successful.');
} catch (err) {
  console.error('Error writing cleaned Bosch appliance range to file:', err);
}