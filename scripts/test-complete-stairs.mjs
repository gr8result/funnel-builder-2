import assert from 'node:assert/strict';import fs from 'node:fs';
import {getMasterProducts} from '../lib/product-library/catalogueService.js';
import {getProductLibraryRoomCategory,productBelongsToRoomCategory} from '../lib/product-library/productLibraryTaxonomy.js';
import {productsForRequirement,INTERIOR_REQUIREMENTS} from '../lib/builders/clientSelectionWorkflow.js';
import {isCompleteStair,stairOptions,compatibleStairOptions,reconcileStairConfiguration,prepareStairSelection,validateStairStep,stairPricing} from '../lib/product-library/stairSelection.js';
import {connectInternalSelectionsToQuotation} from '../lib/product-library/internalSelection.js';
const all=getMasterProducts(),stairs=all.filter(isCompleteStair),category=getProductLibraryRoomCategory('stair-components');
assert.equal(category.name,'Stairs');assert.equal(stairs.length,8);assert.equal(all.filter(p=>productBelongsToRoomCategory(p,category)).length,8);assert.equal(productsForRequirement(all,INTERIOR_REQUIREMENTS.find(r=>r.requirementKey==='stairs')).length,8);
const polished=stairs.find(p=>p.attributes.constructionType==='closed-polished'),options=stairOptions(polished);assert.equal(options.configurations.length,5);assert.equal(options.species.length,9);assert.equal(options.balustrades.length,14);
const pics=[...stairs.map(p=>p.primaryImageUrl),...options.configurations.map(p=>p.imageUrl)];assert.equal(new Set(pics).size,13);assert.equal(new Set(options.species.map(p=>p.imageUrl)).size,9);
for(const image of [...pics,...options.species.map(p=>p.imageUrl),...options.balustrades.map(p=>p.imageUrl)])assert(fs.existsSync('public'+image),image);
for(const name of ['Jarrah','Durian','Kwila','Blackbutt','Spotted Gum','Tasmanian Oak','Victorian Ash','American Oak','Pine']){const s=options.species.find(s=>s.name===name);assert(s&&s.description&&s.typicalUse&&s.sourceUrl&&s.imageStatus&&s.availabilityStatus);assert.equal(s.priceAdjustment,null);if(['Durian','Kwila'].includes(name))assert.equal(s.sourceUrl,'https://stairpro.com.au/node/25');}
const c={productId:polished.productId,configurationId:'l-shaped',flights:2,risers:17,widthMm:1000,floorHeightMm:3000,quantity:1,supplier:'StairPro',speciesId:'durian',finishId:'clear',balustradeId:'glass-timber',balustradeLengthLm:4,handrailMaterialId:'timber',handrailProfile:'Round',handrailFinish:'Clear polished'};
assert.equal(validateStairStep(polished,c,5),'');const selected=prepareStairSelection(polished,c);assert.equal(selected.stairConfiguration.timberSpecies,'Durian');assert.equal(selected.stairConfiguration.timberSpeciesImage,options.species[0].imageUrl);assert.equal(selected.selectedCost,null);
const carpet=stairs.find(p=>p.attributes.constructionType==='closed-carpet'),changed=reconcileStairConfiguration(carpet,c);assert.equal(changed.speciesId,'');assert.equal(changed.finishId,'');assert.equal(changed.balustradeId,c.balustradeId);assert.equal(changed.handrailProfile,c.handrailProfile);assert.equal(changed.widthMm,c.widthMm);assert.equal(compatibleStairOptions(carpet,changed).species.length,0);
assert.throws(()=>prepareStairSelection(polished,{...c,risers:0}));assert.throws(()=>prepareStairSelection(polished,{...c,balustradeId:'glass-metal',handrailMaterialId:'timber'}));
const configured={...polished,attributes:{...polished.attributes,builderAllowance:12000,pricingMode:'allowance',upgradePrices:[{optionId:'durian',amount:450},{optionId:'clear',amount:800},{optionId:'glass-timber',amount:2000},{optionId:'timber',amount:250}]}};
assert.equal(stairPricing(configured,c).totalKnown,15500);
for(const product of [polished,configured]){const option=prepareStairSelection(product,c);const quote=connectInternalSelectionsToQuotation({quotation:{}},{rooms:[{rows:[{guidedSelection:{...option,requirementKey:'stairs',requirementLabel:'Stairs',selectedPrice:option.selectedCost,imageReference:option.imageUrl}}]}]}).quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows;assert.equal(quote.length,1);assert.equal(quote[0].productId,polished.productId);assert.equal(quote[0].timberSpecies,'Durian');assert.equal(quote[0].stairUpgradeCosts.length,4);assert.equal(quote[0].excelRate,product===polished?2600:15500);}
console.log(JSON.stringify({passed:true,stairConstructions:8,plans:5,species:9,balustrades:14,compatibilityAndSingleQuoteSelection:true,legacyEstimatingRecordsRetained:all.filter(p=>p.familyKey==='stairs'&&p.attributes.estimatingOnly).length}));

assert.equal(options.balustrades.filter(b=>b.allowanceRate!=null).length,10);
for(const p of stairs){const config={...c,productId:p.productId,speciesId:'',finishId:p.attributes.finishIds[0]};assert.equal(Boolean(validateStairStep(p,config,1)),p.attributes.requiresExposedTimberSpecies);}
assert.throws(()=>prepareStairSelection(polished,{...c,balustradeLengthLm:0}));
assert.equal(stairPricing(polished,c).knownAllowanceTotal,2600);
assert.equal(stairPricing(polished,c).upgrades.find(u=>u.group==='Handrail').amount,0);
assert.equal(stairPricing(polished,{...c,balustradeId:'channel-glass',balustradeLengthLm:2.5}).knownAllowanceTotal,2250);
assert.equal(stairPricing(polished,{...c,balustradeId:'semi-frameless-glass',balustradeLengthLm:2}).upgrades.find(u=>u.group==='Balustrade').quotationItem,'SEMI FRAMELESS GLASS BALUSTRADE');
for(const [id,rate] of Object.entries({'painted-timber':325,timber:450,aluminium:350,'vertical-steel':425,wire:400,'semi-frameless-glass':525,'frameless-glass':700,'channel-glass':900,'glass-timber':650,'decorative-steel':550}))assert.equal(options.balustrades.find(b=>b.id===id).allowanceRate,rate);
const selectionBook=configuration=>{const option=prepareStairSelection(polished,configuration);return {rooms:[{rows:[{guidedSelection:{...option,requirementKey:'stairs',imageReference:option.imageUrl}}]}]};};
const first=connectInternalSelectionsToQuotation({quotation:{}},selectionBook({...c,quantity:2}));const firstRow=first.quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows[0];assert.equal(firstRow.qty*firstRow.excelRate,5200);firstRow.manualRate=9000;
const same=connectInternalSelectionsToQuotation(first,selectionBook({...c,quantity:2}));assert.equal(same.quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows[0].manualRate,9000);
const changedQuote=connectInternalSelectionsToQuotation(first,selectionBook({...c,quantity:2,balustradeLengthLm:5}));const changedRow=changedQuote.quotation['INTERNAL PRODUCTS - CLIENT SELECTIONS'].rows[0];assert.equal(changedRow.manualRate,'');assert.equal(changedRow.excelRate,3250);assert.equal(changedRow.priceStatus,'Partial allowance — stair quote required');
