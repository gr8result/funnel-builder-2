// pages/api/lists/[id].js
import fs from "fs";
import path from "path";
const ROOT = path.join(process.cwd(),"data","crm","lists");

export default function handler(req,res){
  try{
    const { id } = req.query;
    const file = path.join(ROOT, `${id}.json`);
    if(!fs.existsSync(file)) return res.status(404).json({ok:false,error:"Not found"});
    const list = JSON.parse(fs.readFileSync(file,"utf8"));
    res.status(200).json({ok:true,list});
  }catch(e){
    res.status(500).json({ok:false,error:e.message});
  }
}
