export const EXTERIOR_HARDWARE_BRANDS=['Lockwood','Gainsborough','Lemaar','Zanda'];
export function exteriorHardwareType(product={}) {
 const t=[product.handleStyle,product.hardwareType,product.attributes?.hardwareType,product.productName].filter(Boolean).join(' ').toLowerCase();
 if(/smart|digital|electronic/.test(t))return 'Smart lock';
 if(/deadbolt/.test(t))return 'Deadbolt';
 if(/key.in.knob/.test(t))return 'Key-in-knob';
 if(/key.in.lever|lever.*entrance/.test(t))return 'Lever entrance set';
 if(/kit/.test(t))return 'Entrance kit';
 if(/pull/.test(t))return 'Pull handle';
 if(/mortice|cylinder|latch/.test(t)&&!/set|combination/.test(t))return 'Locks, latches & cylinders';
 return 'Entrance set';
}
export function exteriorHardwarePage(products,brand,type,page=0,pageSize=12) {
 const matching=products.filter(p=>p.brand===brand&&exteriorHardwareType(p)===type);
 return {total:matching.length,pages:Math.ceil(matching.length/pageSize),products:matching.slice(page*pageSize,(page+1)*pageSize)};
}
export function matchesDoorGlassType(option,type) {
 const text=[option.name,option.classification].join(' ').toLowerCase();
 if(type==='Clear')return /clear/.test(text);
 if(type==='Translucent')return /translucent/.test(text);
 if(type==='Frosted')return /frost|etch/.test(text);
 if(type==='Obscure/privacy')return /obscure|pattern|cathedral|rice|privacy/.test(text);
 if(type==='Grey tinted')return /grey|gray/.test(text);
 return true;
}
