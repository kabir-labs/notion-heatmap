// GET /api/habits  → list habits { name, unit, colorHex }
// POST /api/habits { name, unit, colorHex } → creates a habit in Habit Settings (and returns it)

export default async function handler(req, res) {
  enableCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = process.env.NOTION_TOKEN;
  const habitsDb = process.env.HABITS_DB;
  if (!token || !habitsDb) return res.status(500).json({ error: 'Server missing NOTION_TOKEN or HABITS_DB' });

  try {
    if (req.method === 'GET') {
      const items = await listHabits({ token, habitsDb });
      return res.json({ habits: items });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const name = (body.name || '').trim();
      const unit = (body.unit || '').trim();
      const colorHex = (body.colorHex || '').trim() || '#35c27a';
      if (!name) return res.status(400).json({ error: 'Missing name' });
      const created = await createHabit({ token, habitsDb, name, unit, colorHex });
      return res.json({ ok: true, habit: created });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Unexpected', detail: String(e?.message || e) });
  }
}

async function listHabits({ token, habitsDb }) {
  const url = `https://api.notion.com/v1/databases/${habitsDb}/query`;
  const r = await fetch(url, { method: 'POST', headers: h(token), body: JSON.stringify({ page_size: 100, sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }] }) });
  if (!r.ok) throw new Error('Notion list habits failed ' + r.status);
  const j = await r.json();
  return (j.results || []).map(p => {
    const props = p.properties || {};
    return {
      id: p.id,
      name: (props.Name?.title?.map(t => t.plain_text).join('') || '').trim(),
      unit: (props.Unit?.rich_text?.map(t => t.plain_text).join('') || '').trim(),
      colorHex: (props.ColorHex?.rich_text?.map(t => t.plain_text).join('') || '').trim() || '#35c27a'
    };
  });
}

async function createHabit({ token, habitsDb, name, unit, colorHex }) {
  const url = 'https://api.notion.com/v1/pages';
  const body = {
    parent: { database_id: habitsDb },
    properties: {
      Name: { title: [{ type: 'text', text: { content: name } }] },
      Unit: { rich_text: [{ type: 'text', text: { content: unit || '' } }] },
      ColorHex: { rich_text: [{ type: 'text', text: { content: colorHex } }] },
      Created: { date: { start: new Date().toISOString() } }
    }
  };
  const r = await fetch(url, { method: 'POST', headers: h(token), body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Notion create habit failed ' + r.status);
  const j = await r.json();
  return { id: j.id, name, unit, colorHex };
}

function h(token){ return { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }; }
function enableCORS(res){ res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Write-Key'); }
