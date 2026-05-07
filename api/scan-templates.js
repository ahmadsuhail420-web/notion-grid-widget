const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://syncandstyle.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Admin auth ──────────────────────────────────────────────────────
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

  const anonSb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authErr } = await anonSb.auth.getUser(accessToken);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
  const adminEmail = 'ahmadsuhail420@gmail.com';
  if (user.user_metadata?.role !== 'admin' && user.email !== adminEmail) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);

  // ── Scan public/wedding/ — try every possible Vercel path ────────────
  // Vercel bundles includeFiles relative to project root at /var/task
  // The function lives at /var/task/api/scan-templates.js
  const candidatePaths = [
    path.join(__dirname, '..', 'public', 'wedding'),   // /var/task/public/wedding
    path.join(process.cwd(), 'public', 'wedding'),     // process.cwd()/public/wedding
    path.join(__dirname, 'public', 'wedding'),         // /var/task/api/public/wedding (includeFiles copies here in some versions)
    '/var/task/public/wedding',                        // absolute fallback
  ];

  let files = [];
  let usedPath = null;
  const pathAttempts = [];

  for (const dir of candidatePaths) {
    try {
      const found = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
      pathAttempts.push({ path: dir, status: 'ok', count: found.length });
      if (found.length > 0 && !usedPath) {
        files = found;
        usedPath = dir;
      }
    } catch (e) {
      pathAttempts.push({ path: dir, status: 'error', error: e.code });
    }
  }

  if (files.length === 0) {
    console.error('scan-templates: could not find wedding dir. Attempts:', JSON.stringify(pathAttempts));
    return res.status(200).json({
      newly_registered: [],
      scanned: 0,
      error: 'scan_failed',
      debug_paths: pathAttempts
    });
  }

  // ── Get existing templates from DB ──────────────────────────────────
  const { data: existing, error: dbErr } = await sb
    .from('template_configs')
    .select('id, name')
    .order('id');

  if (dbErr) {
    return res.status(500).json({ error: 'Failed to query template_configs: ' + dbErr.message });
  }

  function nameToSlug(name) {
    return (name || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  const coveredSlugs = new Set();
  (existing || []).forEach(t => {
    coveredSlugs.add(t.id.toLowerCase());
    coveredSlugs.add(nameToSlug(t.name));
  });

  const unregistered = files
    .map(f => f.replace('.html', ''))
    .filter(slug => !coveredSlugs.has(slug));

  if (unregistered.length === 0) {
    return res.status(200).json({
      newly_registered: [],
      scanned: files.length,
      used_path: usedPath,
      db_records: (existing || []).map(t => ({ id: t.id, name: t.name }))
    });
  }

  function slugToName(slug) {
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  const rows = unregistered.map(slug => ({
    id: slug,
    name: slugToName(slug),
    price: 0,
    original_price: null,
    is_active: false,
    is_premium: false,
    placeholder_url: '',
    updated_at: new Date().toISOString()
  }));

  const { error: insertErr } = await sb.from('template_configs').insert(rows);

  if (insertErr) {
    console.error('scan-templates: insert failed:', insertErr.message);
    return res.status(500).json({ error: 'Failed to register templates: ' + insertErr.message });
  }

  return res.status(200).json({
    newly_registered: rows.map(r => ({ id: r.id, name: r.name })),
    scanned: files.length,
    used_path: usedPath
  });
};
