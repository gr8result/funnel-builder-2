// pages/api/track/open.js
// 1x1 transparent PNG + increments opens for a contact in a list.
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(),"data","crm","lists");
const PNG_1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f660000000049454e44ae426082",
  "hex"
);

export default function handler(req,res){
  try{
    const { l: listId, c: contactId } = req.query;
    if(listId && contactId){
      const file = path.join(ROOT, `${listId}.json`);
      if(fs.existsSync(file)){
        const obj = JSON.parse(fs.readFileSync(file,"utf8"));
        const sub = (obj.subscribers||[]).find(s=>s.id===contactId);
        if(sub){
          sub.metrics = sub.metrics || {opens:0,clicks:0,lastActivity:null};
          sub.metrics.opens = (sub.metrics.opens||0)+1;
          sub.metrics.lastActivity = new Date().toISOString();
          obj.stats = obj.stats || { totalSubscribers:0,totalOpens:0,totalClicks:0 };
          obj.stats.totalOpens = (obj.stats.totalOpens||0)+1;
          obj.updatedAt = new Date().toISOString();
          fs.writeFileSync(file, JSON.stringify(obj,null,2), "utf8");
        }
      }
    }
  }catch{}
  res.setHeader("Content-Type","image/png");
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
  res.status(200).send(PNG_1x1);
}

