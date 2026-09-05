import {PRICE_STATES} from '../builders/clientSelectionWorkflow.js';
export const INTERNAL_SELECTION_KEYS=['internal-doors','door-hardware','skirting','architraves'];
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
 for(const [key,values] of Object.entries(options)){const value=choices[key]??values[0]??'';if(values.length&&!values.includes(value))throw Error(`Choose a published ${key} option.`);selected[key]=value;}
 const quantity=Number(choices.quantity??1);if(!Number.isFinite(quantity)||quantity<=0)throw Error('Quantity must be greater than zero.');
 const sized=entity.attributes?.sizePrices?.find(p=>p.size===selected.size);const price=sized?.price??(entity.priceStatus==='current'?(entity.clientPrice??entity.rrp):null);
 const priceState=price==null?PRICE_STATES.quoteRequired:PRICE_STATES.current;
 return {...product,productId:entity.productId||product.productId||product.id,productCode:entity.productCode,...selected,quantity,unit:entity.priceUnit||'EACH',selectedCost:price,priceIncludesGst:sized?.gst==='inclusive',priceState,priceStatus:price==null?'quote_required':'current',internalCatalogueSelection:true,metadata:{...product.metadata,productEntity:{...entity,...selected,clientPrice:price,priceStatus:price==null?'quote_required':'current',attributes:{...entity.attributes,selectedGlazing:selected.glazing,selectedFunction:selected.function,selectedLength:selected.length}}}};
}
// Consumers store chosen snapshots, never another editable catalogue.
export function connectInternalSelectionsToQuotation(workbook,book) {
 const rows=(book?.rooms||[]).flatMap(r=>r.rows||[]).filter(r=>INTERNAL_SELECTION_KEYS.includes(r.guidedSelection?.requirementKey)&&r.guidedSelection?.productId);
 const sectionName='INTERNAL PRODUCTS - CLIENT SELECTIONS';const source='client-selections-internal-product';
 const previous=workbook.quotation?.[sectionName]||{};
 if(!rows.length&&!(previous.rows||[]).some(r=>r.source===source))return workbook;
 const lines=rows.map(row=>{const s=row.guidedSelection;const old=(previous.rows||[]).find(r=>r.id===`internal-selection:${s.requirementKey}`&&r.productId===s.productId&&r.size===s.size&&r.finish===s.finish)||{};const publishedPrice=s.priceState===PRICE_STATES.current?s.selectedPrice:null;
 // Quotation Builder adds GST to its base rates. Retain the published inclusive price in the snapshot.
 const price=publishedPrice==null?null:s.priceIncludesGst?Math.round(publishedPrice/1.1*10000)/10000:publishedPrice;
 return {...old,id:`internal-selection:${s.requirementKey}`,source,item:[s.requirementLabel,s.productName,s.size,s.finish,s.glazing,s.function,s.length].filter(Boolean).join(' / '),description:s.description||row.description||'',productId:s.productId,productCode:s.productCode,productName:s.productName,brand:s.brand,model:s.model,range:s.range,productImageUrl:s.imageReference,imageUrl:s.imageReference,size:s.size,finish:s.finish,unit:s.unit||'EACH',qty:s.quantity||1,quantity:s.quantity||1,excelRate:price??'',manualRate:old.manualRate??'',cost:'',priceStatus:price==null?'Quote required':'Current Price',included:true,active:true,productLibrarySnapshot:{...s,catalogueOwner:'product-library'}};});
 return {...workbook,quotation:{...workbook.quotation,[sectionName]:{...previous,rows:[...(previous.rows||[]).filter(r=>r.source!==source),...lines]}}};
}
