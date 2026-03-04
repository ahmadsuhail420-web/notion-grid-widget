// Vercel serverless (CommonJS)
// POST /api/unlock
//
// Body: { token: dashboard_token, provider: "gumroad", license_key: "..." }
//
// Verifies Gumroad license key and activates Pro ONCE per key.
// Stores activation proof in Supabase `license_activations` table and sets customers.plan='pro'.

const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GUMROAD_ACCESS_TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
// Your product permalink from: https://suhailcraft0.gumroad.com/l/gridwidget
const GUMROAD_PRODUCT_PERMALINK = "gridwidget";

async function supabaseFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
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

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}

async function verifyGumroadLicense(license_key) {
  if (!GUMROAD_ACCESS_TOKEN) throw new Error("Missing GUMROAD_ACCESS_TOKEN env var");

  const params = new URLSearchParams();
  params.set("product_permalink", GUMROAD_PRODUCT_PERMALINK);
  params.set("license_key", license_key);

  const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || "Gumroad verify failed");

  // Gumroad verify response typically includes `success`
  if (!data.success) {
    throw new Error(data?.message || "Invalid license key");
  }

  // Some responses include `purchase` details; we keep best-effort fields
  const purchase = data.purchase || {};
  return {
    email: purchase.email || null,
    sale_id: purchase.sale_id || purchase.id || null,
    refunded: !!purchase.refunded,
    chargebacked: !!purchase.chargebacked,
    cancelled: !!purchase.cancelled,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, provider, license_key } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token" });
    if (provider !== "gumroad") return res.status(400).json({ error: "Unsupported provider" });
    if (!license_key) return res.status(400).json({ error: "Missing license_key" });

    // 1) Find customer by dashboard_token
    const customers = await supabaseFetch(`customers?select=id,plan,status&dashboard_token=eq.${encodeURIComponent(token)}&limit=1`);
    const customer = Array.isArray(customers) ? customers[0] : null;
    if (!customer) return res.status(401).json({ error: "Invalid token" });

    // 2) Verify license with Gumroad
    const verify = await verifyGumroadLicense(license_key);

    // Optional policy: do not activate refunded/chargebacked/cancelled
    if (verify.refunded || verify.chargebacked || verify.cancelled) {
      return res.status(403).json({ error: "License is not active (refunded/chargeback/cancelled)" });
    }

    // 3) Single activation enforcement: hash key and upsert activation
    const license_key_hash = sha256Hex(license_key);

    // check existing activations
    const existing = await supabaseFetch(
      `license_activations?select=id,customer_id&license_key_hash=eq.${license_key_hash}&limit=1`
    );
    const activation = Array.isArray(existing) ? existing[0] : null;

    if (activation && activation.customer_id !== customer.id) {
      return res.status(409).json({ error: "This license key was already activated." });
    }

    if (!activation) {
      // insert activation row
      await supabaseFetch("license_activations", {
        method: "POST",
        body: [{
          customer_id: customer.id,
          provider: "gumroad",
          license_key_hash,
          provider_sale_id: verify.sale_id,
          buyer_email: verify.email,
          activated_at: new Date().toISOString(),
        }],
      });
    }

    // 4) Upgrade customer to Pro (idempotent)
    await supabaseFetch(`customers?dashboard_token=eq.${encodeURIComponent(token)}`, {
      method: "PATCH",
      body: {
        plan: "pro",
        pro_activated_at: new Date().toISOString(),
        status: "active",
      },
    });

    return res.status(200).json({ ok: true, plan: "pro" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
