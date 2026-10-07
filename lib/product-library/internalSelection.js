import {PRICE_STATES} from '../builders/clientSelectionWorkflow.js';
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
 return {...product,productId:entity.productId||product.productId||product.id,productCode:entity.productCode,...selected,quantity,unit:entity.priceUnit||'EACH',selectedCost:price,priceIncludesGst:sized?.gst==='inclusive'||entity.attributes?.priceIncludesGst===true,priceState,priceStatus:price==null?'quote_required':'current',internalCatalogueSelection:true,metadata:{...product.metadata,productEntity:{...entity,...selected,clientPrice:price,priceStatus:price==null?'quote_required':'current',attributes:{...entity.attributes,selectedGlazing:selected.glazing,selectedFunction:selected.function,selectedLength:selected.length}}}};
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
 const lines=rows.map(row=>{const s=row.guidedSelection;const old=(previous.rows||[]).find(r=>r.id===`internal-selection:${s.requirementKey}`&&r.productId===s.productId&&r.size===s.size&&r.finish===s.finish)||{};const publishedPrice=s.stairConfiguration?(s.stairConfiguration.pricing.totalKnown??(s.stairConfiguration.pricing.knownAllowanceTotal>0?s.stairConfiguration.pricing.knownAllowanceTotal:null)):s.priceState===PRICE_STATES.current?s.selectedPrice:livePrice(s.productId);
 // Quotation Builder adds GST to its base rates. Retain the published inclusive price in the snapshot.
 const price=publishedPrice==null?null:s.priceIncludesGst?Math.round(publishedPrice/1.1*10000)/10000:publishedPrice;
 return {...old,id:`internal-selection:${s.requirementKey}`,source,item:[s.requirementLabel,s.productName,s.size,s.finish,s.glazing,s.function,s.length].filter(Boolean).join(' / '),description:s.description||row.description||'',productId:s.productId,productCode:s.productCode,productName:s.productName,brand:s.brand,model:s.model,range:s.range,productImageUrl:s.imageReference,imageUrl:s.imageReference,size:s.size,finish:s.finish,function:s.function,variantId:s.variantId,variantCode:s.variantCode,stairConfiguration:s.stairConfiguration,stairUpgradeCosts:s.stairUpgradeCosts,timberSpecies:s.stairConfiguration?.timberSpecies,timberSpeciesImage:s.stairConfiguration?.timberSpeciesImage,unit:s.unit||'EACH',qty:s.quantity||1,quantity:s.quantity||1,excelRate:price??'',manualRate:s.stairConfiguration&&JSON.stringify(old.stairConfiguration)!==JSON.stringify(s.stairConfiguration)?'':old.manualRate??'',cost:'',priceStatus:s.stairConfiguration?(price==null?'Quote required':s.stairConfiguration.pricing.baseAmount==null?'Partial allowance — stair quote required':s.stairConfiguration.pricing.pricingMode==='starting_price'?'Starting price':'Builder allowance'):price==null?'Quote required':'Current Price',included:true,active:true,productLibrarySnapshot:{...s,catalogueOwner:'product-library'}};});
 return {...workbook,quotation:{...workbook.quotation,[sectionName]:{...previous,rows:[...(previous.rows||[]).filter(r=>r.source!==source),...lines]}}};
}
