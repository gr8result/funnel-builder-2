import test from 'node:test';
import assert from 'node:assert/strict';
import { nonStealingLock } from '../lib/nonStealingLock.js';
import { blankDocument, copyDocument, validateDocument } from '../lib/projectEstimate/pageBuilderStore.js';
test('overlapping operations serialize and rejection releases the queue',async()=>{
  const events=[];
  await Promise.allSettled([nonStealingLock('same',-1,async()=>{events.push('start');await new Promise(r=>setTimeout(r,10));events.push('end');throw Error('failed');}),nonStealingLock('same',-1,async()=>events.push('next'))]);
  assert.deepEqual(events,['start','end','next']);
});
test('browser lock acquisition never steals or executes after rejected acquisition',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');let executed=false;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(name,options)=>{assert.equal(options.steal,undefined);throw Error('Rejected lock');}}}});
  try{await assert.rejects(nonStealingLock('test',10,()=>executed=true),/Rejected/);assert.equal(executed,false);}finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
test('template instances have separate identity and nested content',()=>{
  const original=blankDocument('workspace','job');original.kind='template';original.pages[0].blocks.push({id:'text',type:'text',text:'Master'});
  const copy=copyDocument(original,{workspace:'workspace',job:'other'});copy.pages[0].blocks[0].text='Changed';
  assert.notEqual(copy.id,original.id);assert.equal(original.pages[0].blocks[0].text,'Master');assert.equal(copy.job,'other');
});
test('missing, corrupt and cross-job records cannot be loaded as blank',()=>{
  assert.throws(()=>validateDocument(null,'w','j'));
  const doc=blankDocument('w','j');assert.throws(()=>validateDocument(doc,'w','other'),/identity/);
  assert.throws(()=>validateDocument({...doc,pages:null},'w','j'),/corrupted/);
});
