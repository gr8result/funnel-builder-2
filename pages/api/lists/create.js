// pages/api/lists/create.js
import fs from "fs";
import path from "path";
const ROOT = path.join(process.cwd(), "data", "crm", "lists");

export default function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({ok:false});
  try{
    const { name, description="" } = req.body || {};
    if(!name || !name.trim()) return res.status(400).json({ok:false,error:"Name required"});
    ensureDir(ROOT);
    const id = `${slug(name)}-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const obj = {
      id, name: name.trim(), description: description.trim(),
      createdAt: now, updatedAt: now,
      subscribers: [],
      stats: { totalSubscribers: 0, totalOpens: 0, totalClicks: 0 }
    };
    fs.writeFileSync(path.join(ROOT, `${id}.json`), JSON.stringify(obj,null,2), "utf8");
    res.status(200).json({ok:true,id});
  }catch(e){
    res.status(500).json({ok:false,error:e.message});
  }
}
function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }
function slug(s){ return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-"); }

