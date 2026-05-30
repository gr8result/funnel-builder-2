// pages/api/track/c.js
// Click tracker: increments clicks then redirects to ?u= destination.
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(),"data","crm","lists");

export default function handler(req,res){
  try{
    const { l: listId, c: contactId, u } = req.query;
    // Path traversal guard: listId must be alphanumeric/hyphen/underscore only
    if(listId && contactId && /^[\w-]+$/.test(listId)){
      const file = path.join(ROOT, `${listId}.json`);
      // Double-check resolved path stays within ROOT (defence-in-depth)
      if(file.startsWith(ROOT) && fs.existsSync(file)){
        const obj = JSON.parse(fs.readFileSync(file,"utf8"));
        const sub = (obj.subscribers||[]).find(s=>s.id===contactId);
        if(sub){
          sub.metrics = sub.metrics || {opens:0,clicks:0,lastActivity:null};
          sub.metrics.clicks = (sub.metrics.clicks||0)+1;
          sub.metrics.lastActivity = new Date().toISOString();
          obj.stats = obj.stats || { totalSubscribers:0,totalOpens:0,totalClicks:0 };
          obj.stats.totalClicks = (obj.stats.totalClicks||0)+1;
          obj.updatedAt = new Date().toISOString();
          fs.writeFileSync(file, JSON.stringify(obj,null,2), "utf8");
        }
      }
    }
    // Only allow http/https URLs to prevent javascript: URI attacks
    const dest = typeof u === "string" && /^https?:\/\//i.test(u) ? u : "/";
    res.writeHead(302,{ Location: dest });
    res.end();
  }catch(e){
    res.writeHead(302,{ Location: "/" });
    res.end();
  }
}

