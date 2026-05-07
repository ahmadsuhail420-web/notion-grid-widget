const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://syncandstyle.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing Authorization header' });
  const accessToken = authHeader.replace('Bearer ', '').trim();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey)
    return res.status(500).json({ error: 'Supabase configuration missing' });

  // Verify admin JWT
  const anonSb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authErr } = await anonSb.auth.getUser(accessToken);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid or expired session token' });
  const adminEmail = 'ahmadsuhail420@gmail.com';
  if (user.user_metadata?.role !== 'admin' && user.email !== adminEmail)
    return res.status(403).json({ error: 'Admin access required' });

  // Service role bypasses RLS — returns ALL rows including inactive
  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await sb
    .from('template_configs')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('get-all-templates:', error.message);
    return res.status(500).json({ error: error.message });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(data || []);
};
