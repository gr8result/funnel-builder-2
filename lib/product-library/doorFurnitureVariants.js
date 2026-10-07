// Display aliases only. Pearl, brushed, plated and stainless finishes remain distinct.
const aliases = {'matte black':'Matt black','matt black':'Matt black','satin chrome':'Satin chrome','bright chrome':'Bright chrome','polished chrome':'Bright chrome','chrome plate':'Bright chrome','chrome plated':'Bright chrome','satin chrome brushed':'Brushed satin chrome','brushed satin chrome':'Brushed satin chrome','satin chrome pearl':'Satin chrome pearl','satin nickel':'Satin nickel','polished brass':'Polished brass','antique brass':'Antique brass','gun metal':'Gunmetal','gunmetal':'Gunmetal','graphite':'Graphite','white':'White'};
export function normalizeFurnitureFinish(value='') {
 const text=String(value).trim().replace(/\s+/g,' ');
 return aliases[text.toLowerCase()] || (text ? text[0].toUpperCase()+text.slice(1).toLowerCase() : '');
}
export const furnitureEntity=p=>p?.metadata?.productEntity||p||{};
export function furnitureVariants(p) {return furnitureEntity(p).attributes?.controlledVariants||[];}
export function furnitureFinishes(p) {
 const e=furnitureEntity(p),a=e.attributes||{};
 return [...new Set((furnitureVariants(p).length?furnitureVariants(p).map(v=>v.finish):a.finishOptions||[e.finish]).map(normalizeFurnitureFinish).filter(Boolean))].sort();
}
export function furnitureFunctions(p) {
 const a=furnitureEntity(p).attributes||{};
 return [...new Set((furnitureVariants(p).length?furnitureVariants(p).map(v=>v.function):a.functionOptions||[a.function]).filter(Boolean))].sort();
}
export function matchingFurnitureVariants(p,filters={}) {
 return furnitureVariants(p).filter(v=>(!filters.function||v.function===filters.function)&&(!filters.finishes?.length||filters.finishes.includes(normalizeFurnitureFinish(v.finish))));
}
export function matchesFurnitureFilters(p,filters={}) {
 if(!filters.function&&!filters.finishes?.length)return true;
 if(furnitureVariants(p).length)return matchingFurnitureVariants(p,filters).length>0;
 return (!filters.function||furnitureFunctions(p).includes(filters.function))&&(!filters.finishes?.length||furnitureFinishes(p).some(f=>filters.finishes.includes(f)));
}
export function filteredFurnitureProduct(p,filters={}) {
 if(!furnitureVariants(p).length)return p;
 const variants=matchingFurnitureVariants(p,filters);
 return {...p,finish:[...new Set(variants.map(v=>normalizeFurnitureFinish(v.finish)))].sort().join(' / '),attributes:{...p.attributes,controlledVariants:variants,finishOptions:[...new Set(variants.map(v=>normalizeFurnitureFinish(v.finish)))],functionOptions:[...new Set(variants.map(v=>v.function))]}};
}
export const FURNITURE_SORT_OPTIONS=[['finish','Colour/Finish A–Z'],['finish-desc','Colour/Finish Z–A']];
