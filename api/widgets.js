/**
 * Widgets API (dashboard-token based)
 *
 * GET  /api/widgets?token=... -> list widgets for customer
 * POST /api/widgets { token, action:"create", name } -> create new widget with unique slug
 *
 * Uses Supabase REST with service role key (bypasses RLS).
 */

function makeSlugBase(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { res, json, text };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Missing Supabase env vars" });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  try {
    const token = String(req.query?.token || req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "Missing token" });

    // 1) Resolve customer by dashboard_token
    const custUrl =
      `${supabaseUrl}/rest/v1/customers?dashboard_token=eq.${encodeURIComponent(token)}` +
      `&status=eq.active&select=id,plan,default_widget_slug,slug`;

    const custResp = await fetchJson(custUrl, { headers });

    if (!custResp.res.ok) {
      console.error("Customer fetch failed:", custResp.res.status, custResp.text);
      return res.status(custResp.res.status).json({ error: "Failed to fetch customer" });
    }

    const customer = Array.isArray(custResp.json) ? custResp.json[0] : null;
    if (!customer) return res.status(404).json({ error: "Invalid token" });

    const plan = customer.plan || "free";

    // -------------------------
    // GET = LIST
    // -------------------------
    if (req.method === "GET") {
      const wUrl =
        `${supabaseUrl}/rest/v1/widgets?customer_id=eq.${customer.id}` +
        `&select=id,slug,name,created_at,updated_at&order=created_at.asc`;

      const wResp = await fetchJson(wUrl, { headers });

      if (!wResp.res.ok) {
        console.error("Widgets list failed:", wResp.res.status, wResp.text);
        return res.status(500).json({ error: "Failed to list widgets", plan, widgets: [] });
      }

      return res.json({
        ok: true,
        plan,
        default_widget_slug: customer.default_widget_slug || null,
        widgets: wResp.json || [],
      });
    }

    // -------------------------
    // POST = ACTIONS
    // -------------------------
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const action = String(req.body?.action || "").trim();

    if (action === "create") {
      const name = String(req.body?.name || "My Grid").trim() || "My Grid";

      // slug base: customer slug if present, else widget
      const base = makeSlugBase(customer.slug) || "widget";
      const newSlug = `${base}-${randomSuffix(6)}`;

      const insertUrl = `${supabaseUrl}/rest/v1/widgets`;
      const insResp = await fetchJson(insertUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer_id: customer.id,
          slug: newSlug,
          name,
        }),
      });

      if (!insResp.res.ok) {
        console.error("Widget insert failed:", insResp.res.status, insResp.text);
        return res.status(500).json({ error: "Failed to create widget" });
      }

      const created = Array.isArray(insResp.json) ? insResp.json[0] : insResp.json;

      // if customer has no default_widget_slug, set it
      if (!customer.default_widget_slug) {
        const patchUrl = `${supabaseUrl}/rest/v1/customers?id=eq.${customer.id}`;
        await fetch(patchUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            default_widget_slug: newSlug,
          }),
        });
      }

      return res.json({ ok: true, plan, widget: created });
    }

    return res.status(400).json({
      error: "Invalid action",
      allowed_actions: ["create"],
    });
  } catch (err) {
    console.error("widgets api error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
