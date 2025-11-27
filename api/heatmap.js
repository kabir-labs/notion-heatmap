// GET /api/heatmap?db=LOGS_DB&habit=Reading&spanDays=365&start=2025-01-01&useTitleForHabit=false
// Optional: &habitsDb=HABITS_DB  (falls back to process.env.HABITS_DB)

export default async function handler(req, res) {
  enableCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = process.env.NOTION_TOKEN;
    if (!token) return res.status(500).json({ error: 'Server missing NOTION_TOKEN' });

    const db = req.query.db; // logs db
    if (!db) return res.status(400).json({ error: 'Missing db' });

    const habit = req.query.habit || null;
    const spanDays = clamp(intish(req.query.spanDays) ?? 365, 28, 2000);
    const useTitleForHabit = (req.query.useTitleForHabit === 'true');
    const habitsDb = req.query.habitsDb || process.env.HABITS_DB || null;

    let start = req.query.start ? new Date(req.query.start + 'T00:00:00') : null;
    if (!start) { const today = todayLocal(); start = addDays(today, -spanDays + 1); }
    const end = addDays(start, spanDays - 1);

    const logs = await fetchAllLogs({ token, db, habit, useTitleForHabit, start, end });

    const byDate = new Map();
    for (const row of logs) {
      const key = row.date; const v = Number(row.value || 0);
      byDate.set(key, (byDate.get(key) || 0) + v);
    }

    const days = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const key = ymd(d);
      days.push({ date: key, value: byDate.get(key) || 0 });
    }

    let meta = { habit, unit: '', colorHex: '#35c27a' };
    if (habitsDb && habit) {
      const m = await fetchHabitMeta({ token, habitsDb, habit });
      if (m) meta = m;
    }

    return res.json({ start: ymd(start), end: ymd(end), spanDays, days, meta });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Unexpected', detail: String(e?.message || e) });
  }
}

async function fetchAllLogs({ token, db, habit, useTitleForHabit, start, end }) {
  const url = 'https://api.notion.com/v1/databases/' + db + '/query';
  const filter = buildFilter({ habit, useTitleForHabit, start, end });
  const headers = H(token);
  const logs = [];
  let body = { page_size: 100, filter, sorts: [{ property: 'Date', direction: 'ascending' }] };
  while (true) {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Notion query failed ${r.status}`);
    const j = await r.json();
    for (const p of j.results || []) {
      const props = p.properties || {};
      const date = props.Date?.date?.start?.slice(0,10);
      const value = props.Value?.number ?? 1;
      let h = null;
      if (useTitleForHabit) {
        const title = (props.Name?.title?.map(t => t.plain_text).join('') || '').trim();
        // Extract leading habit name before " - YYYY-MM-DD"
        const idx = title.lastIndexOf(' - ');
        h = idx > -1 ? title.slice(0, idx) : title;
      } else {
        h = props.Habit?.select?.name || null;
      }
      if (!date) continue;
      if (habit && h && h !== habit) continue;
      logs.push({ date, value });
    }
    if (!j.has_more || !j.next_cursor) break;
    body.start_cursor = j.next_cursor;
  }
  return logs;
}

async function fetchHabitMeta({ token, habitsDb, habit }) {
  const url = `https://api.notion.com/v1/databases/${habitsDb}/query`;
  const r = await fetch(url, { method: 'POST', headers: H(token), body: JSON.stringify({ page_size: 100, filter: { property: 'Name', title: { contains: habit } } }) });
  if (!r.ok) throw new Error('Notion habit meta failed ' + r.status);
  const j = await r.json();
  let match = null; const lc = habit.toLowerCase();
  for (const p of (j.results || [])) {
    const name = (p.properties?.Name?.title?.map(t=>t.plain_text).join('') || '').trim();
    if (name.toLowerCase() === lc) { match = p; break; }
    if (!match) match = p; // fallback to first contains
  }
  if (!match) return null;
  const props = match.properties || {};
  const unit = (props.Unit?.rich_text?.map(t=>t.plain_text).join('') || '').trim();
  const colorHex = (props.ColorHex?.rich_text?.map(t=>t.plain_text).join('') || '').trim() || '#35c27a';
  return { habit, unit, colorHex };
}

function buildFilter({ habit, useTitleForHabit, start, end }) {
  const and = [ { property: 'Date', date: { on_or_after: ymd(start) } }, { property: 'Date', date: { on_or_before: ymd(end) } } ];
  if (habit) {
    if (useTitleForHabit) and.push({ property: 'Name', title: { contains: habit + ' - ' } });
    else and.push({ property: 'Habit', select: { equals: habit } });
  }
  return { and };
}

function ymd(d){ const z=n=>n<10?'0'+n:n; return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
function todayLocal(){ const now=new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function intish(s){ const n=Number(s); return Number.isFinite(n)?n:null; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function H(token){ return { 'Authorization':`Bearer ${token}`, 'Notion-Version':'2022-06-28', 'Content-Type':'application/json' }; }
function enableCORS(res){ res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Write-Key'); }
