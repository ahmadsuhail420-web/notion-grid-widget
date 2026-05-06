const { createClient } = require('@supabase/supabase-js');

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

  // ── Auth: verify caller is the logged-in admin ──────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  // Validate the JWT using the anon client (never exposes service key)
  const anonSb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authErr } = await anonSb.auth.getUser(accessToken);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  // Verify admin identity: role metadata OR known admin email
  const userRole = user.user_metadata?.role;
  const adminEmail = 'ahmadsuhail420@gmail.com';
  if (userRole !== 'admin' && user.email !== adminEmail) {
    return res.status(403).json({ error: 'Access denied: admin privileges required' });
  }

  // ── Use SERVICE ROLE KEY — bypasses RLS entirely ────────────────
  // Guarantees admin writes always succeed regardless of RLS policies on template_configs
  const sb = createClient(supabaseUrl, supabaseServiceKey);

  const { action, id, data } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Missing required field: action' });
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
      const { error } = await sb.from('template_configs')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

    } else if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'delete requires id' });
      const { error } = await sb.from('template_configs').delete().eq('id', id);
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
