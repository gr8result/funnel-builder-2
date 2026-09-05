// Compact schedule data only. This module never reads storage or plan pixels.
export function importedExteriorEntryDoors({project={},projectInfo={},workbook={},snapshot={}}={}) {
  const metadata=project?.source_metadata||project?.metadata||project?.project_metadata||{};
  const sources=[metadata.doorSchedule,metadata.windowSchedule,metadata.takeoffSchedule,projectInfo.doorSchedule,projectInfo.windowSchedule,projectInfo.basicProjectMeasurements,workbook.takeoffSchedule,workbook.takeoffEngine?.takeoffSchedule,workbook.jobSetupPayload?.takeoffSchedule,workbook.jobSetup?.takeoffSchedule,snapshot.takeoffSchedule];
  const rowsOf=s=>Array.isArray(s)?s:s?.items||s?.rows||s?.openings||s?.doors||s?.projectTotals?.doors||s?.currentSheet?.doors||[];
  for(const source of sources){const rows=rowsOf(source);const doors=rows.filter(r=>{
    const text=[r.section,r.category,r.type,r.doorType,r.doorStyle,r.description,r.location,r.room].filter(Boolean).join(' ');
    return !/garage|internal|interior|screen|sliding|subtotal/i.test(text)&&(/entry.?door|entrance|external.?door|exterior.?door/i.test(text)||(r.isExterior===true&&/door/i.test(text)));
  }).map(r=>({id:String(r.stableOpeningId||r.openingId||r.doorId||r.itemId||r.id||r.mark||''),doorReference:String(r.mark||r.reference||r.doorReference||r.id||''),level:String(r.level||r.floor||r.levelName||''),location:String(r.location||r.room||r.roomName||''),quantity:Number(r.quantity||r.qty)||1,width:r.widthMm||r.width||null,height:r.heightMm||r.height||null,source:'takeoff_schedule'})).filter(r=>r.id);
    if(doors.length)return [...new Map(doors.map(d=>[d.id,d])).values()];
  }
  return [];
}
// Read adapters only: opening a page never creates or migrates saved records.
export function entryDoorDetails(book={}) {
  const rows=(book?.rooms||[]).flatMap(r=>r.rows||[]).filter(r=>r.guidedRequirementKey==='entry-door'||(r.guidedSelection||r.selected_details)?.requirementKey==='entry-door');
  return rows.map(r=>r.guidedSelection||r.selected_details||{}).sort((a,b)=>Number(Boolean(b.productCode||b.entryDoors?.length))-Number(Boolean(a.productCode||a.entryDoors?.length)));
}
export function selectionsFromDoorDetails(details={}) {
  const selections=details.entryDoors||[];
  const door=details.door||{id:'manual-entry-door:primary',doorReference:'Entry Door',location:details.location||details.room||'Entry',level:details.level||'',quantity:Number(details.quantity)||1,source:'manual'};
  if(!details.productCode||selections.some(s=>s.door?.id===door.id))return selections;
  return [...selections,{...details,entryDoors:undefined,door}];
}
export function entryDoorBookCandidates(workbook={}) {
  return [workbook.clientSelectionsBook,workbook.selectionsBook,workbook.builderSelectionsBook,workbook.selections?.book,workbook.data?.clientSelectionsBook,workbook.data?.selectionsBook,workbook.selectionSchedule,workbook.selectionSchedules].filter(b=>Array.isArray(b?.rooms));
}
export function resolveExteriorEntryDoors(context={}) {
  const details=[context.details,...entryDoorDetails(context.book),...entryDoorBookCandidates(context.workbook).flatMap(entryDoorDetails)].filter(Boolean);
  const saved=new Map();const appliedDrafts=new Set();
  for(const d of details){
    for(const selection of selectionsFromDoorDetails(d)){if(selection.door?.id&&!saved.has(selection.door.id))saved.set(selection.door.id,{...selection.door});}
    for(const [id,draft] of Object.entries(d.entryDoorDrafts||{})){if(appliedDrafts.has(id))continue;appliedDrafts.add(id);if(!saved.has(id))saved.set(id,{id,doorReference:'Entry Door',location:'Entry',level:'',quantity:1,source:'manual',...draft.Door});else if(draft.Door)saved.set(id,{...saved.get(id),...draft.Door});}
  }
  const key=d=>[d.level,d.location].map(v=>String(v||'').trim().toLowerCase()).join('|');
  const unmatched=[];
  for(const imported of importedExteriorEntryDoors(context)){
    const match=saved.get(imported.id)||[...saved.values()].find(d=>d.importedDoorId===imported.id)||([...saved.values()].filter(d=>d.location&&key(d)===key(imported)).length===1?[...saved.values()].find(d=>d.location&&key(d)===key(imported)):null);
    if(match){saved.set(match.id,{...imported,...match,importedDoorId:imported.id,importedQuantity:imported.quantity});}
    else {saved.set(imported.id,imported);unmatched.push(imported.id);}
  }
  return {doors:[...saved.values()],unmatchedImportedDoorIds:unmatched};
}
export function exteriorEntryDoors(context={}) { return resolveExteriorEntryDoors(context).doors; }
export function defaultManualEntryDoor() { return {id:'manual-entry-door:primary',doorReference:'Entry Door',location:'Entry',level:'',quantity:1,source:'manual'}; }
export function patchEntryDoorDraft(book,doorId,patch) {
  const rows=(book?.rooms||[]).flatMap(r=>r.rows||[]);
  const target=rows.find(r=>selectionsFromDoorDetails(r.guidedSelection||{}).some(s=>s.door.id===doorId))||rows.find(r=>r.guidedSelection?.productCode&&r.guidedSelection?.requirementKey==='entry-door')||rows.find(r=>r.guidedRequirementKey==='entry-door'||r.guidedSelection?.requirementKey==='entry-door');
  const update=row=>{const d=row.guidedSelection||{};return {...row,guidedRequirementKey:'entry-door',guidedSelection:{...d,requirementKey:'entry-door',activeEntryDoorId:doorId,entryDoorDrafts:{...d.entryDoorDrafts,[doorId]:{...d.entryDoorDrafts?.[doorId],...patch}}}};};
  if(!target){const room={id:'manual-exterior-doors',name:'Exterior',rows:[update({id:'manual-entry-door-row'})]};return {...book,rooms:[...(book?.rooms||[]),room],updatedAt:new Date().toISOString()};}
  return {...book,rooms:book.rooms.map(r=>({...r,rows:(r.rows||[]).map(row=>row===target?update(row):row)})),updatedAt:new Date().toISOString()};
}
export function entryDoorHardwareLine(door,product,finish,options={}) {
  if(!door?.id||!product?.productCode)throw Error('A scheduled door and furniture product are required.');
  if(product.finishOptions?.length&&!product.finishOptions.includes(finish))throw Error('Choose a published finish for this product.');
  const quantity=Number(options.quantity ?? door.quantity);
  if(!Number.isFinite(quantity)||quantity<=0)throw Error('Quantity must be greater than zero.');
  const rate=typeof product.selectedCost==='number'&&Number.isFinite(product.selectedCost)?product.selectedCost:null;
  return {id:`entry-door-furniture:${door.id}`,lineType:'entry_door_furniture',doorId:door.id,doorScheduleId:door.id,doorReference:door.doorReference,level:door.level,location:door.location,room:door.location,brand:product.brand,supplier:product.supplier,productId:product.id||product.productCode,productCode:product.productCode,model:product.model,sku:product.manufacturerSku||'',range:product.range||'',productName:product.productName,finish:finish||'',size:options.size||'',lockType:options.lockType||product.lockingType||'',quantity,unitRate:rate,totalAllowance:rate===null?null:rate*quantity,roomArea:'Exterior',category:'Door Furniture',selectedAt:options.selectedAt||'',imageUrl:product.finishImages?.[finish]||product.imageUrl,description:product.clientExplanation||'',rate,amount:rate===null?null:rate*quantity,rateStatus:rate===null?'Rate required':'Verified rate',selectionStatus:'selected',status:'selected',manufacturerProductUrl:product.productUrl};
}
export function upsertEntryDoorSelection(existing=[],selection) {
  if(!selection?.door?.id)throw Error('Missing scheduled door identity.');
  return [...existing.filter(s=>s.door.id!==selection.door.id),selection];
}
export function entryDoorSelectionSchedules(entryDoors=[]) {
  const furniture=entryDoors.filter(s=>s.entryDoorFurniture).map(s=>entryDoorHardwareLine(s.door,s.entryDoorFurniture,s.furnitureFinish,s.hardwareOptions));
  // Independent line objects; consumers cannot change another schedule's data.
  return {entryDoorFurnitureSchedule:furniture,procurementSchedule:furniture.map(r=>({...r})),quotationSchedule:furniture.map(r=>({...r})),supplierPurchaseOrderSchedule:furniture.map(r=>({...r}))};
}
export function connectEntryDoorFurnitureSchedules(workbook,book) {
  const selections=(book.rooms||[]).flatMap(r=>r.rows||[]).flatMap(r=>(r.guidedSelection||r.selected_details||{}).entryDoors||[]);
  if(!selections.length&&!workbook.entryDoorFurnitureSchedule?.length)return workbook;
  const schedules=entryDoorSelectionSchedules(selections);
  const sectionKey='ENTRY DOOR FURNITURE - CLIENT SELECTIONS';
  const section=workbook.quotation?.[sectionKey]||{};
  const oldRows=section.rows||[];
  const rows=schedules.quotationSchedule.map(line=>{
    const previous=oldRows.find(r=>r.id===line.id&&r.productCode===line.productCode&&r.finish===line.finish)||{};
    return {...previous,id:line.id,source:'client-selections-entry-door-furniture',code:line.productCode,item:[line.doorReference,line.level,line.location,line.productName,line.finish].filter(Boolean).join(' — '),description:line.description,unit:'EACH',qty:line.quantity,quantity:line.quantity,excelRate:line.rate??'',manualRate:previous.manualRate??'',cost:'',importedCost:'',priceStatus:line.rateStatus,sourceOfRate:'Rate required',included:true,active:true,productCode:line.productCode,productName:line.productName,brand:line.brand,sku:line.sku||line.model,model:line.model,finish:line.finish,productImageUrl:line.imageUrl,doorReference:line.doorReference,level:line.level,location:line.location,selectionStatus:line.selectionStatus,productLibrarySnapshot:{...line}};
  });
  const procurement=workbook.procurement||{};
  const items=(procurement.items||[]).filter(r=>r.source!=='client-selections-entry-door-furniture');
  for(const line of schedules.procurementSchedule){const previous=(procurement.items||[]).find(r=>r.id===line.id&&r.productCode===line.productCode&&r.finish===line.finish)||{};
    items.push({...previous,...line,source:'client-selections-entry-door-furniture',sectionName:sectionKey,itemDescription:[line.doorReference,line.productName,line.finish].filter(Boolean).join(' — '),qty:line.quantity,unit:'EACH',estimatedRate:line.rate,estimatedTotal:line.amount,procurementCategory:'Door Hardware',orderStatus:previous.orderStatus||'Not Started',notes:[line.level,line.location,line.lockType,line.rateStatus].filter(Boolean).join('; ')});
  }
  return {...workbook,...schedules,quotation:{...workbook.quotation,[sectionKey]:{...section,rows:[...oldRows.filter(r=>r.source!=='client-selections-entry-door-furniture'),...rows]}},procurement:{...procurement,items}};
}

export function furnitureProductOption(product) {
  const a=product.attributes||{};
  const publishedFinishes=(a.finishOptions||product.finishOptions||(product.finish?[product.finish]:[])).flatMap(f=>String(f).split(',')).map(f=>f.trim()).filter(Boolean);
  const exactFinish=publishedFinishes.find(f=>(product.productName||'').toLowerCase().endsWith(' - '+f.toLowerCase()));
  return {...product,id:product.productId||product.id,manufacturerSku:product.manufacturerSku||product.sku||'',imageUrl:product.primaryImageUrl||product.primaryImage||product.imageUrl||'',productUrl:product.officialProductUrl||product.officialProductURL||'',finishOptions:exactFinish?[exactFinish]:publishedFinishes,sizeOptions:a.sizeOptions||(a.dimensions?[a.dimensions]:product.size?[product.size]:[]),lockOptions:a.lockingOptions||(a.lockingType?[a.lockingType]:[]),lockingType:a.lockingType||'',clientExplanation:product.description||a.clientExplanation||'',selectedCost:product.priceStatus==='price_pending'||a.rateStatus==='Rate required'?null:(product.clientPrice??product.builderCost??null)};
}
export function doorFurnitureSelections(book) {
  return entryDoorDetails(book).flatMap(selectionsFromDoorDetails);
}
export function updateDoorFurnitureBook(book,doors,product,options,{remove=false}={}) {
  if(!doors.length)throw Error('Choose an exterior entry door from this job.');
  let found=false;
  const eligible=(book?.rooms||[]).flatMap(r=>r.rows||[]).filter(r=>r.guidedRequirementKey==='entry-door'||r.guidedSelection?.requirementKey==='entry-door');
  const target=eligible.find(r=>selectionsFromDoorDetails(r.guidedSelection||{}).some(s=>doors.some(d=>d.id===s.door.id)))||eligible.find(r=>r.guidedSelection?.productCode)||eligible[0];
  const patchRow=row=>{
    found=true;
    const details=row.guidedSelection||row.selected_details||{};
    let entryDoors=selectionsFromDoorDetails(details);
    for(const door of doors){
      const previous=entryDoors.find(s=>s.door.id===door.id)||{};
      if(remove){entryDoors=entryDoors.map(s=>s.door.id===door.id?{...s,entryDoorFurniture:null,furnitureFinish:'',hardwareOptions:null}:s);continue;}
      entryDoorHardwareLine(door,product,options.finish,options);
      const draft=details.entryDoorDrafts?.[door.id]||{};
      entryDoors=upsertEntryDoorSelection(entryDoors,{...previous,door,requirementKey:'entry-door',supplier:draft.Supplier||previous.supplier,range:draft.Range||previous.range,productCode:draft.ProductCode||previous.productCode,productName:draft.ProductName||previous.productName||draft.ProductCode,imageReference:draft.ImageReference||previous.imageReference||'',brand:previous.brand||draft.Supplier,size:draft.Size||previous.size,configuration:draft.Configuration||previous.configuration,finish:draft.Finish||previous.finish,glazing:draft.Glazing||previous.glazing,entryDoorFurniture:{...product,lockingType:options.lockType||product.lockingType},furnitureFinish:options.finish,hardwareOptions:{...options,selectedAt:new Date().toISOString()},status:'selected'});
    }
    return {...row,guidedRequirementKey:'entry-door',guidedSelection:{...details,requirementKey:'entry-door',activeEntryDoorId:doors[0].id,entryDoors,...entryDoorSelectionSchedules(entryDoors)}};
  };
  const rooms=(book?.rooms||[]).map(room=>({...room,rows:(room.rows||[]).map(row=>!found&&row===target?patchRow(row):row)}));
  if(!found){const row=patchRow({id:'guided-entry-door',label:'Entry Doors',category:'Entry Doors'});const exterior=rooms.find(r=>r.areaKey==='exterior'||/^exterior$/i.test(r.name||r.title||''));if(exterior)exterior.rows.push(row);else rooms.push({id:'guided-exterior',name:'Exterior',areaKey:'exterior',rows:[row]});}
  return {...book,documentType:book?.documentType||'luxury_selections_book',rooms,updatedAt:new Date().toISOString()};
}
