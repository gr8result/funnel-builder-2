import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

export default async function handler(req,res){
  try{
    if(req.method==="GET"){
      const { stage, from, to, q, limit=200 } = req.query;
      let qy = supabase.from("contacts")
        .select("id, name, email, phone, company, position, address, postcode, description, enquiry_date, stage, last_contact_at, last_contact_type, sentiment")
        .limit(+limit)
        .order("enquiry_date",{ascending:false});
      if(stage) qy = qy.eq("stage", stage);
      if(from)  qy = qy.gte("enquiry_date", from);
      if(to)    qy = qy.lte("enquiry_date", to);
      if(q){
        qy = qy.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`);
      }
      const { data, error } = await qy;
      if(error) throw error;
      return res.status(200).json({ ok:true, rows:data });
    }
    if(req.method==="PATCH"){
      const { ids=[], stage } = req.body||{};
      if(!ids.length) return res.status(400).json({ error:"no ids" });
      const { error } = await supabase.from("contacts").update({ stage }).in("id", ids);
      if(error) throw error;
      return res.status(200).json({ ok:true });
    }
    return res.status(405).json({ error:"Method not allowed" });
  }catch(e){ console.error(e); return res.status(500).json({ error:"failed" });}
}

