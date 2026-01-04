// pages/api/contacts/[id].js
import fs from "fs";
import path from "path";
const ROOT = path.join(process.cwd(),"data","crm","lists");

// naive cross-list lookup (fine for filesystem prototype)
export default function handler(req,res){
  try{
    const { id } = req.query;
    if(!fs.existsSync(ROOT)) return res.status(404).json({ok:false});
    const files = fs.readdirSync(ROOT).filter(f=>f.endsWith(".json"));
    for(const f of files){
      const obj = JSON.parse(fs.readFileSync(path.join(ROOT,f),"utf8"));
      const hit = (obj.subscribers||[]).find(p=>p.id===id);
      if(hit) return res.status(200).json({ok:true,contact:hit,listId:obj.id});
    }
    res.status(404).json({ok:false,error:"Contact not found"});
  }catch(e){
    res.status(500).json({ok:false,error:e.message});
  }
}
