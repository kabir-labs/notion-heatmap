// api/heatmap.js
import { getClient, ok, bad, cors } from './_supabase.js';

export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try{
    const supabase = getClient();
    const habitId = req.query.habitId;
    if (!habitId) return bad(res,400,'Missing habitId');

    const last365 = req.query.last365 === '1' || (!req.query.year);
    let start, end;
    if (last365){
      const today = new Date(); today.setHours(0,0,0,0);
      const s = new Date(today); s.setDate(s.getDate()-364);
      start = toYMD(s); end = toYMD(today);
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

    const map = new Map(rows.map(r => [r.d, Number(r.value)]));
    const sDate = new Date(start+'T00:00:00');
    const eDate = new Date(end+'T00:00:00');

    const days = [];
    for (let d=new Date(sDate); d<=eDate; d.setDate(d.getDate()+1)){
      const key = toYMD(d);
      days.push({ date:key, value: map.get(key) || 0 });
    }

    const allowed = (habit.streak_days || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    let streak = 0;
    let continuesToday = false;
    const lastIdx = days.length - 1;
    const todayAllowed = allowed.includes(dow[new Date(days[lastIdx].date+'T00:00:00').getDay()]);
    const todayValue = Number(days[lastIdx].value||0);
    let i = lastIdx;
    if (todayAllowed && todayValue===0){ continuesToday = true; i--; }
    for (; i>=0; i--){
      const dt = new Date(days[i].date+'T00:00:00');
      if (!allowed.includes(dow[dt.getDay()])) continue;
      if (Number(days[i].value||0) > 0) streak++;
      else break;
    }

    const vals = days.map(x=>Number(x.value)||0);
    const active = vals.filter(v=>v>0);
    const total = vals.reduce((a,b)=>a+b,0);
    const average = active.length ? (total/active.length) : 0;

    return ok(res, {
      range: { start, end, last365 },
      habit: {
        id: habit.id, name: habit.name, type: habit.type,
        unit: habit.unit, colorHex: habit.color_hex, streakDays: habit.streak_days
      },
      days, stats: { streak, average, total, continuesToday }
    });
  } catch(e){
    console.error(e); return bad(res,500,e.message||'Unexpected');
  }
}
function toYMD(d){ const z=n=>n<10?'0'+n:n; return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
