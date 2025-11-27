// api/heatmap.js
import { getClient, ok, bad, cors } from './_supabase.js';

export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try{
    const supabase = getClient();
    const habitId = req.query.habitId;
    if (!habitId) return bad(res,400,'Missing habitId');

    // timeframe: last365 OR year=YYYY
    const last365 = req.query.last365 === '1' || (!req.query.year);
    let start, end;
    if (last365){
      const today = new Date(); today.setHours(0,0,0,0);
      const s = new Date(today); s.setDate(s.getDate()-364);
      start = s.toISOString().slice(0,10);
      end = today.toISOString().slice(0,10);
    } else {
      const y = Number(req.query.year || new Date().getFullYear());
      start = `${y}-01-01`; end = `${y}-12-31`;
    }

    const { data: habit, error: herr } = await supabase.from('habits').select('*').eq('id', habitId).single();
    if (herr) throw herr;
    const { data: rows, error } = await supabase
      .from('logs')
      .select('d, value')
      .eq('habit_id', habitId)
      .gte('d', start).lte('d', end)
      .order('d',{ascending:true});
    if (error) throw error;

    // build map
    const map = new Map();
    for (const r of rows) map.set(r.d, Number(r.value));

    function ymd(d){ const z=n=>n<10?'0'+n:n; return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
    const sDate = new Date(start+'T00:00:00');
    const eDate = new Date(end+'T00:00:00');

    const days = [];
    for (let d=new Date(sDate); d<=eDate; d.setDate(d.getDate()+1)){
      const key = ymd(d);
      days.push({ date:key, value: map.get(key) || 0 });
    }

    // stats
    const vals = days.map(x=>Number(x.value)||0);
    const active = vals.filter(v=>v>0);
    const total = vals.reduce((a,b)=>a+b,0);
    const average = active.length ? (total/active.length) : 0;
    let streak=0; for (let i=vals.length-1;i>=0;i--){ if (vals[i]>0) streak++; else break; }

    return ok(res, {
      range: { start, end, last365 },
      habit: { id: habit.id, name: habit.name, type: habit.type, unit: habit.unit, colorHex: habit.color_hex },
      days, stats: { streak, average, total }
    });
  } catch(e){
    console.error(e); return bad(res,500,e.message||'Unexpected');
  }
}
