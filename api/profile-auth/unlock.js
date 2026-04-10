// api/profile-auth/unlock.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function randomTokenHex(len = 48) {
  return crypto.randomBytes(len / 2).toString("hex");
}

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
    const { slug, password } = req.body || {};
    if (!slug) return res.status(400).json({ error: "Missing slug" });
    if (!password) return res.status(400).json({ error: "Missing password" });

    // Resolve widget -> customer_id
    const widgets = await supabaseFetch(
      `widgets?slug=eq.${encodeURIComponent(slug)}&select=id,customer_id,slug&limit=1`
    );
    const widget = Array.isArray(widgets) ? widgets[0] : null;
    if (!widget) return res.status(404).json({ error: "Widget not found" });

    // Check customer active + plan
    const customers = await supabaseFetch(
      `customers?id=eq.${encodeURIComponent(widget.customer_id)}&status=eq.active&select=id,plan&limit=1`
    );
    const customer = Array.isArray(customers) ? customers[0] : null;
    if (!customer) return res.status(403).json({ error: "Customer not active" });

    const plan = (customer.plan || "free") === "pro" ? "pro" : "free";
    if (plan !== "pro") return res.status(403).json({ error: "Pro required" });

    // Get password hash
    const authRows = await supabaseFetch(
      `customer_profile_auth?customer_id=eq.${encodeURIComponent(customer.id)}&select=password_hash&limit=1`
    );
    const auth = Array.isArray(authRows) ? authRows[0] : null;
    if (!auth?.password_hash) return res.status(403).json({ error: "Password not set" });

    const ok = await bcrypt.compare(String(password), String(auth.password_hash));
    if (!ok) return res.status(401).json({ error: "Invalid password" });

    const token = randomTokenHex(48);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await supabaseFetch("customer_edit_sessions", {
      method: "POST",
      body: [{ token, customer_id: customer.id, expires_at: expiresAt, created_at: new Date().toISOString() }],
    });

    return res.status(200).json({ ok: true, edit_token: token, expires_at: expiresAt });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};