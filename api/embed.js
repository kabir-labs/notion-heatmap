// api/embed.js
import { getClient, ok, bad, cors } from './_supabase.js';
import crypto from 'node:crypto';

function deriveBase(req){
  const env = (process.env.PUBLIC_BASE_URL || '').trim();
  if (env) return env.replace(/\/$/,''); 
  try {
    const ref = req.headers['referer'];
    if (ref){ const u = new URL(ref); return `${u.protocol}//${u.host}`; }
  } catch {}
  const host = req.headers['x-forwarded-host'] || req.headers['host'];
  const proto = (req.headers['x-forwarded-proto'] || 'https');
  if (host) return `${proto}://${host}`;
  return '';
}

export default async function handler(req, res){
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try{
    getClient(); // ensure envs exist
    if (req.method === 'POST'){
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body||'{}');
      const { habitId, canWrite=true, dark=true } = body;
      if (!habitId) return bad(res,400,'Missing habitId');
      const token = crypto.randomBytes(24).toString('hex');
      const base = deriveBase(req);
      const url = `${base}/?embed=1&habitId=${habitId}&token=${token}&dark=${dark?1:0}&write=${canWrite?1:0}`;
      return ok(res, { token, url });
    }
    return bad(res,405,'POST only');
  } catch(e){
    console.error(e); return bad(res,500,e.message||'Unexpected');
  }
}
