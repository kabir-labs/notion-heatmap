// api/reorder.js
import { getClient, ok, bad, cors } from './_supabase.js';

export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return bad(res,405,'POST only');
  try{
    const supabase = getClient();
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body||'{}');
    const orders = body.orders || []; // [{id, order}]
    for (const it of orders){
      if (!it.id) continue;
      await supabase.from('habits').update({ order: it.order|0 }).eq('id', it.id);
    }
    return ok(res, { ok:true });
  } catch(e){
    console.error(e); return bad(res,500,e.message||'Unexpected');
  }
}
