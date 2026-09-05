import fs from 'node:fs';
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
dotenv.config({path:'.env.local',quiet:true});
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const result={checkedAt:new Date().toISOString(),books:[],selections:[]};
const {data:rows,error}=await db.from('builder_selection_books').select('id,project_id,workspace_id,updated_at').order('updated_at',{ascending:false}).limit(30);if(error)result.bookError=error.message;
for(const row of rows||[]){const {data,error}=await db.from('builder_selection_books').select('book_data').eq('id',row.id).single();if(error)continue;const doors=(data?.book_data?.rooms||[]).flatMap(r=>(r.rows||[]).filter(v=>v.guidedRequirementKey==='entry-door'||v.guidedSelection?.requirementKey==='entry-door'||/entry.?door/i.test(v.category||v.item||'')).map(v=>({rowId:v.id,selectedProduct:v.selectedProduct,productModel:v.productModel,guidedSelection:v.guidedSelection})));if(doors.length)result.books.push({...row,doors});}
const {data:selections,error:se}=await db.from('builder_client_selections').select('id,project_id,workspace_id,updated_at,selected_details,selected_product_name').order('updated_at',{ascending:false}).limit(60);if(se)result.selectionError=se.message;else result.selections=(selections||[]).filter(r=>r.selected_details?.requirementKey==='entry-door'||r.selected_details?.entryDoors?.length);
fs.mkdirSync('test-artifacts/manual-entry-door-recovery',{recursive:true});fs.writeFileSync('test-artifacts/manual-entry-door-recovery/server-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,books:result.books.map(b=>({...b,doors:b.doors.map(d=>({rowId:d.rowId,selectedProduct:d.selectedProduct,productCode:d.guidedSelection?.productCode,productName:d.guidedSelection?.productName,doorCount:d.guidedSelection?.entryDoors?.length||0,draftCount:Object.keys(d.guidedSelection?.entryDoorDrafts||{}).length}))})),selections:result.selections.map(s=>({id:s.id,projectId:s.project_id,name:s.selected_product_name}))},null,2));
