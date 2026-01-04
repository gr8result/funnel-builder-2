// pages/api/lists/add-subscriber.js
import fs from "fs";
import path from "path";
const ROOT = path.join(process.cwd(),"data","crm","lists");

export default function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({ok:false});
  try{
    const { listId, name="", email } = req.body||{};
    if(!listId || !email) return res.status(400).json({ok:false,error:"listId and email required"});
    const file = path.join(ROOT, `${listId}.json`);
    if(!fs.existsSync(file)) return res.status(404).json({ok:false,error:"List not found"});
    const obj = JSON.parse(fs.readFileSync(file,"utf8"));

    // if exists, do nothing
    let sub = (obj.subscribers||[]).find(s=>s.email.toLowerCase()===email.toLowerCase());
    if(!sub){
      const id = `${email.toLowerCase().replace(/[^a-z0-9]/g,"")}-${Date.now().toString(36)}`;
      sub = { id, email, name, metrics:{opens:0,clicks:0,lastActivity:null}};
      obj.subscribers = obj.subscribers || [];
      obj.subscribers.push(sub);
      obj.stats = obj.stats || { totalSubscribers:0,totalOpens:0,totalClicks:0 };
      obj.stats.totalSubscribers = obj.subscribers.length;
      obj.updatedAt = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(obj,null,2), "utf8");
    }
    res.status(200).json({ok:true, subscriber:sub});
  }catch(e){
    res.status(500).json({ok:false,error:e.message});
  }
}

