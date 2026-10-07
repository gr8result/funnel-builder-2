import {PRICE_STATES} from '../builders/clientSelectionWorkflow.js';
export const STAIR_STEPS=['Choose stair type','Choose timber species / finish','Choose balustrade type'];
export const stairEntity=p=>p?.metadata?.productEntity||p||{};
export const isCompleteStair=p=>stairEntity(p).attributes?.completeStairCatalogue===true;
export const stairOptions=p=>stairEntity(p).attributes?.stairOptions||{species:[],finishes:[],configurations:[],balustrades:[],handrails:[],suppliers:[]};
export function compatibleStairOptions(p,c={}) {
 const a=stairEntity(p).attributes||{},o=stairOptions(p),bal=o.balustrades.find(b=>b.id===c.balustradeId);
 const species=o.species.filter(s=>a.speciesIds?.includes(s.id)),selectedSpecies=species.find(s=>s.id===c.speciesId);
 return {...o,species,finishes:o.finishes.filter(f=>a.finishIds?.includes(f.id)&&(!selectedSpecies||selectedSpecies.finishIds.includes(f.id))),configurations:o.configurations.filter(v=>a.configurationIds?.includes(v.id)),handrails:o.handrails.filter(h=>bal?.handrailMaterialIds.includes(h.id))};
}
export function reconcileStairConfiguration(p,c={}) {
 const next={...c,productId:stairEntity(p).productId},o=compatibleStairOptions(p,c);
 for(const [key,list] of [['configurationId','configurations'],['speciesId','species'],['finishId','finishes'],['balustradeId','balustrades'],['handrailMaterialId','handrails']])if(!o[list].some(v=>v.id===next[key]))next[key]='';
 const h=o.handrails.find(h=>h.id===next.handrailMaterialId);if(!h?.profiles.includes(next.handrailProfile))next.handrailProfile='';if(!h?.finishes.includes(next.handrailFinish))next.handrailFinish='';
 return next;
}
export function validateStairStep(p,c,step) {
 if(!isCompleteStair(p))return 'Choose a complete stair construction type.';
 const o=compatibleStairOptions(p,c);
 if(step>=0){if(!o.configurations.some(v=>v.id===c.configurationId))return 'Choose a compatible plan configuration.';for(const [key,label] of [['flights','number of flights'],['risers','number of risers'],['widthMm','stair width'],['floorHeightMm','floor-to-floor height'],['quantity','quantity']])if(!Number.isFinite(Number(c[key]))||Number(c[key])<=0||(['flights','risers','quantity'].includes(key)&&!Number.isInteger(Number(c[key]))))return `Enter a positive ${['flights','risers','quantity'].includes(key)?'whole number for':'value for'} ${label}.`;if(!o.suppliers.includes(c.supplier))return 'Choose the intended supplier.';}
 if(step>=1){if((stairEntity(p).attributes.requiresExposedTimberSpecies||c.speciesId)&&!o.species.some(v=>v.id===c.speciesId))return 'Choose a compatible timber species.';if(!o.finishes.some(v=>v.id===c.finishId))return 'Choose a compatible stair finish.';}
 if(step>=2){const bal=o.balustrades.find(v=>v.id===c.balustradeId);if(!bal)return 'Choose a balustrade option.';if(bal.allowanceRate!=null&&(!Number.isFinite(Number(c.balustradeLengthLm))||Number(c.balustradeLengthLm)<=0))return 'Enter a positive balustrade length per stair.';const h=o.handrails.find(v=>v.id===c.handrailMaterialId);if(!h||!h.profiles.includes(c.handrailProfile)||!h.finishes.includes(c.handrailFinish))return 'Choose a compatible handrail material, profile and finish.';}
 return '';
}
export function stairPricing(p,c) {
 const e=stairEntity(p),a=e.attributes||{},o=stairOptions(p);const value=a.builderAllowance??a.startingPrice??e.builderPrice??e.clientPrice;
 const base=value==null||value===''?null:Number(value);const pricingMode=base==null?'quote_required':a.pricingMode==='starting_price'||a.startingPrice!=null?'starting_price':'allowance';
 const choices=[['Timber species',o.species,c.speciesId],['Stair finish',o.finishes,c.finishId],['Balustrade',o.balustrades,c.balustradeId],['Handrail',o.handrails,c.handrailMaterialId]];
 const bal=o.balustrades.find(v=>v.id===c.balustradeId);
 const upgrades=choices.filter(([,list,id])=>list.some(v=>v.id===id)).map(([label,list,id])=>{
  const option=list.find(v=>v.id===id),override=a.upgradePrices?.find(v=>v.optionId===id&&(!v.group||v.group===label));
  const rate=label==='Balustrade'&&override?.amount==null?option.allowanceRate:null;
  const quantity=rate!=null?Number(c.balustradeLengthLm):null;
  const value=override?.amount??(rate!=null?(Number.isFinite(quantity)&&quantity>0?Math.round(rate*quantity*100)/100:null):label==='Handrail'&&bal?.includesStandardHandrail?0:option.priceAdjustment);
  return {group:label,optionId:id,canonicalOptionId:option.canonicalOptionId,label:option.name,amount:value==null||value===''?null:Number(value),rate:rate??null,quantity,unit:rate!=null?'LM':'SET',priceIncludesGst:false,quotationItem:option.quotationItem,familyKey:option.familyKey,status:value==null||value===''?'quote_required':label==='Handrail'&&value===0?'included_in_balustrade':'builder_defined'};
 });
 const knownAllowanceTotal=(base??0)+upgrades.reduce((n,v)=>n+(v.amount??0),0);
 return {pricingMode,baseAmount:base,upgrades,knownAllowanceTotal,totalKnown:base==null?null:knownAllowanceTotal,pendingUpgrades:upgrades.some(v=>v.amount==null),priceIncludesGst:false};
}
export function prepareStairSelection(product,configuration) {
 const error=validateStairStep(product,configuration,2);if(error)throw Error(error);
 const e=stairEntity(product),a=e.attributes,o=stairOptions(product),c={...configuration};
 const species=o.species.find(s=>s.id===c.speciesId),plan=o.configurations.find(s=>s.id===c.configurationId),finish=o.finishes.find(s=>s.id===c.finishId),bal=o.balustrades.find(s=>s.id===c.balustradeId),handrail=o.handrails.find(s=>s.id===c.handrailMaterialId),pricing=stairPricing(product,c);
 const snapshot={...c,constructionType:a.constructionType,constructionLabel:a.constructionLabel,planConfiguration:plan.name,flights:Number(c.flights),risers:Number(c.risers),widthMm:Number(c.widthMm),floorHeightMm:Number(c.floorHeightMm),treadRiserTreatment:a.treadRiserTreatment,timberSpecies:species?.name||'Decorative species not required',timberSpeciesImage:species?.imageUrl||'',timberSpeciesSourceUrl:species?.sourceUrl||'',timberApplications:species?['treads',...(a.constructionType==='closed-polished'?['risers','strings']:a.constructionType==='open-timber'?['strings']:[]),...(handrail.id==='timber'?['handrail']:[])]:[],finish:finish.name,balustradeLengthLm:bal.allowanceRate!=null?Number(c.balustradeLengthLm):null,balustradeType:bal.name,balustradeImage:bal.imageUrl,handrailType:handrail.name,image:e.primaryImageUrl,pricing,quantity:Number(c.quantity)};
 const description=[a.constructionLabel,plan.name,`${c.flights} flights; ${c.risers} risers${c.stairHeight?.actualRiserHeightMm?` @ ${(Math.round(c.stairHeight.actualRiserHeightMm*10)/10).toFixed(1)} mm`:''}; ${c.widthMm} mm wide; ${c.floorHeightMm} mm floor-to-floor${c.stairHeight?.ceilingHeightMm&&c.stairHeight?.floorThicknessMm?` (${c.stairHeight.ceilingHeightMm} mm ceiling + ${c.stairHeight.floorThicknessMm} mm floor system${c.stairHeight.ceilingHeightOverridden||c.stairHeight.floorThicknessOverridden?', manual override':', from Job Setup'})`:''}`,a.treadRiserTreatment,snapshot.timberSpecies,finish.name,bal.name+(bal.allowanceRate!=null?` (${c.balustradeLengthLm} lm per stair at AUD ${bal.allowanceRate}/lm, ex GST builder allowance)`:''),`${handrail.name} / ${c.handrailProfile} / ${c.handrailFinish}`,`Supplier: ${c.supplier}`,`Upgrades: ${pricing.upgrades.map(v=>`${v.group} (${v.label}): ${v.amount==null?'Quote required':`AUD ${v.amount.toFixed(2)}`}`).join('; ')}`].join('. ');
 return {...product,productId:e.productId,productCode:e.productCode,productName:e.productName,brand:e.brand,model:e.model,supplier:c.supplier,description,configuration:plan.name,finish:finish.name,size:`${c.widthMm} mm × ${c.floorHeightMm} mm`,imageUrl:e.primaryImageUrl,quantity:Number(c.quantity),unit:'SET',selectedCost:pricing.totalKnown,priceState:pricing.totalKnown==null?PRICE_STATES.quoteRequired:PRICE_STATES.allowanceOnly,priceStatus:pricing.pricingMode,stairConfiguration:snapshot,stairUpgradeCosts:pricing.upgrades,internalCatalogueSelection:true,metadata:{...product.metadata,productEntity:e}};
}
