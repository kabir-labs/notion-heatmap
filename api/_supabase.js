// api/_supabase.js
import { createClient } from '@supabase/supabase-js';

export function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

// Simple helpers
export function ok(res, data){ res.setHeader('Access-Control-Allow-Origin','*'); return res.status(200).json(data); }
export function bad(res, code, msg){ res.setHeader('Access-Control-Allow-Origin','*'); return res.status(code).json({ error: msg }); }
export function cors(res){ res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Write-Key, X-Embed-Token'); }
