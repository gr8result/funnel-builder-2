import {PRICE_STATES, productPriceIncludesGst} from '../builders/clientSelectionWorkflow.js';
import {furnitureVariants} from './doorFurnitureVariants.js';
import {resolveProductPrice} from './catalogueModel.js';
import {getMasterProducts} from './catalogueService.js';
export const INTERNAL_SELECTION_KEYS=['internal-doors','door-hardware','skirting','architraves','stairs','robes'];
export function internalRequirementMatchesRow(row,requirementKey) {
 const assigned=row.guidedSelection?.requirementKey||row.guidedRequirementKey;
 if(assigned)return assigned===requirementKey;
 const label=String(row.item||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const aliases={'internal-doors':['internal-doors','internal-door','door'],'door-hardware':['door-hardware','internal-door-furniture'],skirting:['skirting'],architraves:['architraves','architrave']};
 return (aliases[requirementKey]||[]).includes(label);
}
export function internalProductOptions(product={}) {
 const entity=product.metadata?.productEntity||product;const a=entity.attributes||{};
 return {size:a.sizeOptions||[entity.size].filter(Boolean),finish:a.finishOptions||[entity.finish].filter(Boolean),glazing:a.glazingOptions||[],function:a.functionOptions||[],length:a.lengthOptions||[]};
}
export function prepareRobeSlidingDoorSystem(product={}, choices={}) {
 const entity=product.metadata?.productEntity||product;const attributes=entity.attributes||{};
 if(attributes.catalogueSection!=='robe-sliding-doors')throw Error('Choose a verified robe or linen sliding door product.');
 const dimension=(key,label,limits)=>{const value=Number(choices[key]);if(!Number.isFinite(value)||value<=0)throw Error(`Enter the measured ${label} in millimetres.`);if(limits?.minimum&&value<limits.minimum||limits?.maximum&&value>limits.maximum)throw Error(`${label} is outside the supplier's published size range.`);return Math.round(value);};
 const frameColour=String(choices.frameColour||'').trim();const insertMaterial=String(choices.insertMaterial||'').trim();const insertColour=String(choices.insertColour||'').trim();
 if(!choices.locationId||!String(choices.location||'').trim())throw Error('Choose the robe or linen location.');
 const widthTopMm=dimension('widthTopMm','top opening width',attributes.openingWidthMm);
 const widthBottomMm=dimension('widthBottomMm','bottom opening width',attributes.openingWidthMm);
 const heightLeftMm=dimension('heightLeftMm','left opening height',attributes.openingHeightMm);
 const heightRightMm=dimension('heightRightMm','right opening height',attributes.openingHeightMm);
 if(!attributes.frameColours?.includes(frameColour))throw Error('Choose a frame colour published for this supplier system.');
 if(!attributes.insertMaterials?.includes(insertMaterial))throw Error('Choose an insert material published for this supplier system.');
 if(insertMaterial==='Vinyl'&&!attributes.vinylInsertColours?.includes(insertColour))throw Error('Choose a vinyl insert colour published for this supplier system.');
 const quantity=Math.max(1,Math.floor(Number(choices.quantity)||1));
 const quoteReference=String(choices.quoteReference||'').trim();
 const supplierConfirmed=choices.supplierConfirmed===true;
 const panelConfiguration=String(choices.panelConfiguration||'').trim();
 const configurationComplete=Boolean(choices.trackConfiguration&&(attributes.panelCount||panelConfiguration)&&supplierConfirmed&&quoteReference);
 return {
  id:String(choices.id||`robe-door:${entity.productId||product.productId}:${choices.locationId}`),
    productId:entity.productId||product.productId||product.id,productCode:entity.sku||product.sku||'',sku:entity.sku||product.sku||'',
  productName:entity.productName||product.productName||'',brand:entity.brand||product.brand||'',supplier:entity.supplier||product.supplier||'',
  officialProductUrl:entity.officialProductUrl||product.officialProductUrl||'',imageUrl:entity.primaryImageUrl||product.imageUrl||product.primaryImageUrl||'',
    locationId:String(choices.locationId),location:String(choices.location).trim(),quantity,unit:'EACH',panelCount:Number(attributes.panelCount)||null,panelConfiguration,
  widthTopMm,widthBottomMm,heightLeftMm,heightRightMm,frameColour,insertMaterial,insertColour,
  trackConfiguration:String(choices.trackConfiguration||'').trim(),supplierConfirmed,quoteReference,
  publishedListedPriceAUD:attributes.publishedListedPriceAUD??null,priceIncludesGst:true,selectedPrice:null,priceStatus:'quote_required',
  configurationComplete,status:configurationComplete?'CONFIRMED':'REQUIRES_CONFIRMATION',source:'verified-product-library',
 };
}
export function prepareInternalSelection(product,choices={}) {
 const entity=product.metadata?.productEntity||product;const options=internalProductOptions(product);const selected={};
 const variants=furnitureVariants(product);
 const variant=variants.length?(choices.variantId?variants.find(v=>v.variantId===choices.variantId):variants.find(v=>(!choices.function||v.function===choices.function)&&(!choices.finish||v.finish===choices.finish))):null;
 if(variants.length&&!variant)throw Error('Choose a published function and finish combination.');
 if(variant){choices={...choices,function:variant.function,finish:variant.finish};selected.variantId=variant.variantId;selected.variantCode=variant.productCode;selected.imageUrl=variant.imageUrl||entity.primaryImageUrl;}
 for(const [key,values] of Object.entries(options)){const value=choices[key]??values[0]??'';if(values.length&&!values.includes(value))throw Error(`Choose a published ${key} option.`);selected[key]=value;}
 const quantity=Number(choices.quantity??1);if(!Number.isFinite(quantity)||quantity<=0)throw Error('Quantity must be greater than zero.');
 const sized=entity.attributes?.sizePrices?.find(p=>p.size===selected.size);const price=variant?.priceStatus==='current'?variant.price:sized?.price??resolveProductPrice(entity).price;
 const priceState=price==null?PRICE_STATES.quoteRequired:PRICE_STATES.current;
 const gstBasis = typeof sized?.gst === 'string' ? sized.gst === 'inclusive' : productPriceIncludesGst(entity);
 return {...product,productId:entity.productId||product.productId||product.id,productCode:entity.productCode,...selected,quantity,unit:entity.priceUnit||'EACH',selectedCost:price,priceIncludesGst:gstBasis,priceState,priceStatus:price==null?'quote_required':'current',internalCatalogueSelection:true,metadata:{...product.metadata,productEntity:{...entity,...selected,clientPrice:price,priceStatus:price==null?'quote_required':'current',attributes:{...entity.attributes,selectedGlazing:selected.glazing,selectedFunction:selected.function,selectedLength:selected.length}}}};
}
// A selection saved without a price (captured before the Product Library had one) takes the current
// Product Library price. A price captured at selection time is never replaced. Size-priced products
// are skipped: their price depends on the chosen size, which only the selection snapshot knows.
function livePrice(productId){if(!productId)return null;const p=getMasterProducts().find(x=>x.productId===productId||x.productCode===productId);return p&&!p.attributes?.sizePrices?.length?resolveProductPrice(p).price:null;}
// Consumers store chosen snapshots, never another editable catalogue.
export function connectInternalSelectionsToQuotation(workbook,book) {
 const rows=(book?.rooms||[]).flatMap(r=>r.rows||[]).filter(r=>INTERNAL_SELECTION_KEYS.includes(r.guidedSelection?.requirementKey)&&r.guidedSelection?.productId);
 const sectionName='INTERNAL PRODUCTS - CLIENT SELECTIONS';const source='client-selections-internal-product';
 const previous=workbook.quotation?.[sectionName]||{};
 if(!rows.length&&!(previous.rows||[]).some(r=>r.source===source))return workbook;
 const lines=rows.flatMap(row=>{
  const selection=row.guidedSelection;
  const systems=selection.requirementKey==='robes'&&Array.isArray(selection.robeSlidingDoorSystems)?selection.robeSlidingDoorSystems:[null];
  return systems.map((system,index)=>{
   const s=system?{...selection,...system,quantity:system.quantity||1}:selection;
   const id=system?`internal-selection:robes:${system.id||system.locationId||index}`:`internal-selection:${s.requirementKey}`;
   const old=(previous.rows||[]).find(r=>r.id===id&&r.productId===s.productId&&r.size===s.size&&r.finish===s.finish)||{};
   const robeConfigurationChanged=Boolean(system&&old.robeDoorSystem&&JSON.stringify(old.robeDoorSystem)!==JSON.stringify(system));
   const publishedPrice=s.stairConfiguration?(s.stairConfiguration.pricing.totalKnown??(s.stairConfiguration.pricing.knownAllowanceTotal>0?s.stairConfiguration.pricing.knownAllowanceTotal:null)):s.priceState===PRICE_STATES.current?s.selectedPrice:livePrice(s.productId);
   // Quotation Builder adds GST to its base rates. Retain the published inclusive price in the snapshot.
   const price=publishedPrice==null?null:s.priceIncludesGst?Math.round(publishedPrice/1.1*10000)/10000:publishedPrice;
   const opening=system?`Opening: ${system.widthTopMm}/${system.widthBottomMm} x ${system.heightLeftMm}/${system.heightRightMm} mm; frame: ${system.frameColour}; insert: ${system.insertMaterial}${system.insertColour?` ${system.insertColour}`:''}; track: ${system.trackConfiguration}`:'';
   const description=[s.description||row.description||'',system&&`Location: ${system.location}`,opening].filter(Boolean).join(' | ');
   return {...old,id,source,item:[s.requirementLabel,s.productName,s.size,s.finish,s.glazing,s.function,s.length].filter(Boolean).join(' / '),description,productId:s.productId,productCode:s.productCode,productName:s.productName,brand:s.brand,model:s.model||s.panelConfiguration,range:s.range,productImageUrl:s.imageReference||s.imageUrl,imageUrl:s.imageReference||s.imageUrl,size:s.size,finish:s.finish,function:s.function,variantId:s.variantId,variantCode:s.variantCode,stairConfiguration:s.stairConfiguration,stairUpgradeCosts:s.stairUpgradeCosts,timberSpecies:s.stairConfiguration?.timberSpecies,timberSpeciesImage:s.stairConfiguration?.timberSpeciesImage,unit:s.unit||'EACH',qty:s.quantity||1,quantity:s.quantity||1,excelRate:price??'',manualRate:robeConfigurationChanged||s.stairConfiguration&&JSON.stringify(old.stairConfiguration)!==JSON.stringify(s.stairConfiguration)?'':old.manualRate??'',cost:'',priceStatus:system?'Quote required':s.stairConfiguration?(price==null?'Quote required':s.stairConfiguration.pricing.baseAmount==null?'Partial allowance — stair quote required':s.stairConfiguration.pricing.pricingMode==='starting_price'?'Starting price':'Builder allowance'):price==null?'Quote required':'Current Price',included:true,active:true,robeDoorSystem:system||null,productLibrarySnapshot:{...selection,...(system||{}),catalogueOwner:'product-library'}};
  });
 });
 return {...workbook,quotation:{...workbook.quotation,[sectionName]:{...previous,rows:[...(previous.rows||[]).filter(r=>r.source!==source),...lines]}}};
}
