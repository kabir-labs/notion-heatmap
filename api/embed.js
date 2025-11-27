// api/embed.js
import { getClient, ok, bad, cors } from './_supabase.js';
import crypto from 'node:crypto';

export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try{
    const supabase = getClient();
    if (req.method === 'POST'){
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body||'{}');
      const { habitId, canWrite=true, dark=true } = body;
      if (!habitId) return bad(res,400,'Missing habitId');
      const token = crypto.randomBytes(24).toString('hex');
      const { data, error } = await supabase.from('embeds').insert({ habit_id: habitId, token, can_write: !!canWrite, dark: !!dark }).select().single();
      if (error) throw error;
      const base = process.env.PUBLIC_BASE_URL || '';
      const url = `${base}/?embed=1&habitId=${habitId}&token=${token}&dark=${dark?1:0}&write=${canWrite?1:0}`;
      return ok(res, { token, url });
    }
    return bad(res,405,'POST only');
  } catch(e){
    console.error(e); return bad(res,500,e.message||'Unexpected');
  }
}
