import assert from 'node:assert/strict';
import {entryDoorDraftAfterChoice as choose,nextIncompleteEntryDoorStep as next} from '../lib/builders/entryDoorProgression.js';
const required={size:true,configuration:true,finish:true,glazing:true,hardwareFinish:true};
let state={HardwareOptions:{quantity:1}};
for(const [patch,expected] of [[{Supplier:'Hume'},'range'],[{Range:'Savoy 1200'},'design'],[{ProductCode:'XS26'},'size'],[{Size:'1200'},'configuration'],[{Configuration:'Single'},'finish'],[{Finish:'Natural'},'glazing'],[{GlazingConfirmed:true},'glass-type'],[{Glazing:'Grey Tint'},'hardware'],[{Hardware:'1140LIASCV',FurnitureFinish:'Satin Chrome'},'hardware'],[{HardwareConfirmed:true},'review']]) {
 state=choose(state,patch);assert.equal(next(state,required),expected);
}
const edited=choose(state,{Finish:'Painted'});
assert.equal(next(edited,required),'glazing');assert.equal(edited.Glazing,'');assert.equal(edited.HardwareConfirmed,false);
assert.equal(state.Glazing,'Grey Tint','confirmed original is not mutated');
assert.equal(next({...state,HardwareOptions:{quantity:0}},required),'hardware');
assert.equal(next({...state,FurnitureFinish:''},required),'hardware');
assert.equal(next({...state,Glazing:'',GlazingConfirmed:false},{...required,glazing:false}),'review','a solid model skips glass');
assert.equal(next({...state,Glazing:'',GlazingConfirmed:false},required),'glazing','required glass never skips');
console.log('PASS saved-state progression, finish invalidation, solid-door skips, and incomplete review guards');
