const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  // SERVICE ROLE KEY — bypasses RLS, always returns fresh data
  const sb = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await sb
      .from('template_configs')
      .select('id, name, price, original_price, is_premium, placeholder_url, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data || []);

  } catch (err) {
    console.error('get-templates error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
