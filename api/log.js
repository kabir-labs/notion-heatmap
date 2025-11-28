// api/log.js
import { getClient, ok, bad, cors } from './_supabase.js';

export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return bad(res,405,'POST only');
  try{
    const supabase = getClient();
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body||'{}');
    const { habitId, date, value } = body;
    if (!habitId || !date) return bad(res,400,'Missing habitId or date');
    const v = Number(value||0);
    // upsert
    const { data, error } = await supabase
      .from('logs')
      .upsert({ habit_id: habitId, d: date, value: v }, { onConflict: 'habit_id,d' })
      .select().single();
    if (error) throw error;
    return ok(res, { ok:true, log: data });
  } catch(e){
    console.error(e); return bad(res,500,e.message||'Unexpected');
  }
}
