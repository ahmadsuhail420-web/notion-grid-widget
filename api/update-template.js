const { createClient } = require('@supabase/supabase-js');

// Map canonical tp IDs back to any legacy IDs still in the DB
const LEGACY = { tp1: ['tp1','template01','islamic-invitation'], tp2: ['tp2','template02','islamic-invitation-premium'] };

module.exports = async function handler(req, res) {
  // ── CORS preflight ──────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();

  const supabaseUrl      = process.env.SUPABASE_URL;
  const supabaseAnonKey  = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  // Verify JWT
  const anonSb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authErr } = await anonSb.auth.getUser(accessToken);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  const adminEmail = 'ahmadsuhail420@gmail.com';
  if (user.user_metadata?.role !== 'admin' && user.email !== adminEmail) {
    return res.status(403).json({ error: 'Access denied: admin privileges required' });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const { action, id, data } = req.body;

  if (!action) return res.status(400).json({ error: 'Missing required field: action' });

  // Helper: find what ID is actually stored in the DB for a given canonical id
  async function resolveDbId(canonId) {
    const candidates = LEGACY[canonId] || [canonId];
    for (const candidate of candidates) {
      const { data: rows } = await sb.from('template_configs').select('id').eq('id', candidate).limit(1);
      if (rows && rows.length > 0) return rows[0].id;
    }
    return canonId; // fallback to what was sent
  }

  try {
    if (action === 'create') {
      if (!data || !data.id || !data.name) {
        return res.status(400).json({ error: 'create requires data.id and data.name' });
      }
      const { error } = await sb.from('template_configs').insert([{
        ...data,
        updated_at: new Date().toISOString()
      }]);
      if (error) throw error;

    } else if (action === 'update') {
      if (!id) return res.status(400).json({ error: 'update requires id' });
      const dbId = await resolveDbId(id);
      console.log(`update-template: resolving ${id} → db row id = ${dbId}`);
      const { error, count } = await sb.from('template_configs')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', dbId)
        .select();
      if (error) throw error;
      console.log(`update-template: updated ${count} rows`);

    } else if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'delete requires id' });
      const dbId = await resolveDbId(id);
      const { error } = await sb.from('template_configs').delete().eq('id', dbId);
      if (error) throw error;

    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(200).json({ success: true, action, id });

  } catch (err) {
    console.error('update-template error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
