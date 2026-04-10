// api/profile-auth/set-password.js
const bcrypt = require("bcryptjs");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseFetch(path, { method = "GET", body, preferReturn = true } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(preferReturn ? { Prefer: "return=representation" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && data.message) || (data && data.error) || `Supabase error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token" });
    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Resolve customer by dashboard_token
    const customers = await supabaseFetch(
      `customers?dashboard_token=eq.${encodeURIComponent(token)}&status=eq.active&select=id,plan&limit=1`
    );
    const customer = Array.isArray(customers) ? customers[0] : null;
    if (!customer) return res.status(401).json({ error: "Invalid token" });

    const plan = (customer.plan || "free") === "pro" ? "pro" : "free";
    if (plan !== "pro") return res.status(403).json({ error: "Pro required" });

    const hash = await bcrypt.hash(String(password), 10);
    const now = new Date().toISOString();

    // Upsert by customer_id (delete then insert pattern using REST)
    // 1) Delete existing
    await supabaseFetch(`customer_profile_auth?customer_id=eq.${encodeURIComponent(customer.id)}`, {
      method: "DELETE",
      preferReturn: false,
    });

    // 2) Insert new
    await supabaseFetch("customer_profile_auth", {
      method: "POST",
      body: [{ customer_id: customer.id, password_hash: hash, updated_at: now }],
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};