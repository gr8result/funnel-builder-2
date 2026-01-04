import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

export default async function handler(req,res){
  try{
    if(req.method==="GET"){
      const { data, error } = await supabase
        .from("crm_stages").select("id,name,slug,position,color")
        .order("position",{ascending:true});
      if(error) throw error;
      return res.status(200).json({ ok:true, stages:data });
    }
    if(req.method==="POST"){
      const { name, slug, position, color } = req.body||{};
      const { data, error } = await supabase.from("crm_stages").insert({ name, slug, position, color, owner: null }).select("*").single();
      if(error) throw error;
      return res.status(200).json({ ok:true, stage:data });
    }
    if(req.method==="PATCH"){
      const { id, ...fields } = req.body||{};
      const { data, error } = await supabase.from("crm_stages").update(fields).eq("id",id).select("*").single();
      if(error) throw error;
      return res.status(200).json({ ok:true, stage:data });
    }
    return res.status(405).json({ error:"Method not allowed" });
  }catch(e){ console.error(e); return res.status(500).json({ error:"failed" });}
}

