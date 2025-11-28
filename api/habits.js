// api/habits.js
import { getClient, ok, bad, cors } from './_supabase.js';

export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const supabase = getClient();

    if (req.method === 'GET'){
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('order',{ascending:true})
        .order('created_at',{ascending:true});
      if (error) throw error;
      return ok(res, { habits: data });
    }

    if (req.method === 'POST'){
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body||'{}');
      const { name, type, unit, colorHex } = body;
      if (!name) return bad(res, 400, 'Missing name');
      const t = (type||'number').toLowerCase();
      if (!['number','checkbox'].includes(t)) return bad(res,400,'type must be number or checkbox');
      const { data, error } = await supabase.from('habits').insert({
        name, type: t, unit: (unit||''), color_hex: colorHex || '#35c27a'
      }).select().single();
      if (error) throw error;
      return ok(res, { habit: data });
    }

    if (req.method === 'PATCH'){
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body||'{}');
      const { id, name, unit, colorHex, order } = body;
      if (!id) return bad(res, 400, 'Missing id');
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (unit !== undefined) updates.unit = unit;
      if (colorHex !== undefined) updates.color_hex = colorHex;
      if (order !== undefined) updates.order = order;
      const { data, error } = await supabase.from('habits').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return ok(res, { habit: data });
    }

    if (req.method === 'DELETE'){
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body||'{}');
      const { id } = body;
      if (!id) return bad(res, 400, 'Missing id');
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) throw error;
      return ok(res, { ok: true });
    }

    return bad(res, 405, 'Method not allowed');
  } catch (e){
    console.error(e);
    return bad(res, 500, e.message || 'Unexpected');
  }
}
