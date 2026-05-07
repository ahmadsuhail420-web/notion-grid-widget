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

    // Normalize IDs: template01→tp1, template02→tp2, etc.
    const ALIASES = { 'template01':'tp1','template02':'tp2','islamic-invitation':'tp1','islamic-invitation-premium':'tp2' };
    const normalized = (data || []).map(row => ({ ...row, id: ALIASES[row.id] || row.id }));
    // Deduplicate (in case DB has both old and new IDs)
    const seen = new Set();
    const deduped = normalized.filter(row => { if (seen.has(row.id)) return false; seen.add(row.id); return true; });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(deduped);

  } catch (err) {
    console.error('get-templates error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
