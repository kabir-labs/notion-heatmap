// POST /api/log  { db, habit, date: 'YYYY-MM-DD', value: 0|1|2|..., useTitleForHabit, writeKey }
// Upserts a single day. Requires NOTION_TOKEN env var. Optional WRITE_KEY guard.

export default async function handler(req, res) {
  enableCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const token = process.env.NOTION_TOKEN;
    if (!token) return res.status(500).json({ error: 'Server missing NOTION_TOKEN' });

    const WRITE_KEY = process.env.WRITE_KEY || null;
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');

    // Optional write key check
    if (WRITE_KEY) {
      const w = body.writeKey || req.headers['x-write-key'] || null;
      if (w !== WRITE_KEY) return res.status(401).json({ error: 'Bad write key' });
    }

    const { db, habit, date, value, useTitleForHabit } = body;
    if (!db || !date) return res.status(400).json({ error: 'Missing db or date' });
    const val = Number(value ?? 1);

    const existing = await findEntry({ token, db, habit, date, useTitleForHabit: !!useTitleForHabit });
    if (existing) {
      await updateValue({ token, pageId: existing.id, value: val });
      return res.json({ ok: true, updated: true, pageId: existing.id });
    } else {
      const pageId = await createEntry({ token, db, habit, date, value: val, useTitleForHabit: !!useTitleForHabit });
      return res.json({ ok: true, created: true, pageId });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Unexpected', detail: String(e?.message || e) });
  }
}

async function findEntry({ token, db, habit, date, useTitleForHabit }) {
  const url = `https://api.notion.com/v1/databases/${db}/query`;
  const headers = baseHeaders(token);
  const filterAnd = [ { property: 'Date', date: { equals: date } } ];
  if (habit) {
    if (useTitleForHabit) {
      filterAnd.push({ property: 'Name', title: { contains: habit + ' - ' } });
    } else {
      filterAnd.push({ property: 'Habit', select: { equals: habit } });
    }
  }
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ page_size: 1, filter: { and: filterAnd } }) });
  if (!r.ok) throw new Error('Notion query failed ' + r.status);
  const j = await r.json();
  return (j.results && j.results[0]) || null;
}

async function updateValue({ token, pageId, value }) {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const headers = baseHeaders(token);
  const body = {
    properties: { Value: { number: value } }
  };
  const r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Notion update failed ' + r.status);
}

async function createEntry({ token, db, habit, date, value, useTitleForHabit }) {
  const url = `https://api.notion.com/v1/pages`;
  const headers = baseHeaders(token);
  const props = { Date: { date: { start: date } }, Value: { number: value } };
  if (useTitleForHabit) {
    const nm = habit ? `${habit} - ${date}` : date;
    props.Name = { title: [{ type: 'text', text: { content: nm } }] };
  } else if (habit) {
    props.Habit = { select: { name: habit } };
  }
  const body = { parent: { database_id: db }, properties: props };
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Notion create failed ' + r.status);
  const j = await r.json();
  return j.id;
}

function baseHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };
}

function enableCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Write-Key');
}
