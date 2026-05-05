// Static file server that mimics Vercel rewrites for /app/public
// Serves the syncandstyle site for preview.
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PUBLIC_DIR = path.resolve('/app/public');
const PORT = process.env.PORT || 3000;

// Stub /api/config so the supabase init in pages doesn't crash.
app.get('/api/config', (req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    return res.status(200).json({ supabaseUrl: '', supabaseAnonKey: '' });
  }
  res.json({ supabaseUrl: url, supabaseAnonKey: key });
});

// Vercel-style rewrites
const REWRITES = {
  '/login': '/login.html',
  '/templates': '/templates.html',
  '/dashboard': '/dashboard.html',
  '/payment': '/payment.html',
  '/admin': '/admin-dashboard.html',
  '/wedding/islamic-invitation': '/wedding/islamic-invitation.html',
  '/wedding/islamic-invitation-premium': '/wedding/islamic-invitation-premium.html',
  '/edit/islamic-invitation': '/edit/islamic-invitation.html',
  '/edit/islamic-invitation-premium': '/edit/islamic-invitation-premium.html',
};

app.use((req, res, next) => {
  if (REWRITES[req.path]) {
    req.url = REWRITES[req.path] + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  }
  next();
});

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Fallback: try .html
app.use((req, res, next) => {
  const candidate = path.join(PUBLIC_DIR, req.path + '.html');
  if (fs.existsSync(candidate)) return res.sendFile(candidate);
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`syncandstyle static preview running on :${PORT}`);
});
