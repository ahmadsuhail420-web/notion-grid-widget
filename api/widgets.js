/**
 * Widgets API (dashboard-token based)
 *
 * GET  /api/widgets?token=... -> list widgets for customer
 * POST /api/widgets { token, action:"create", name } -> create new widget with unique slug
 * POST /api/widgets { token, action:"rename", slug, name } -> rename widget
 * POST /api/widgets { token, action:"set_edit_password", password } -> set customer-level edit password (bcrypt hash)
 * POST /api/widgets { token, action:"save_setup", slug, name, password } -> rename + set password in one call
 *
 * Uses Supabase REST with service role key (bypasses RLS).
 *
 * NOTE: CommonJS export style for Vercel/Node default.
 */

const bcrypt = require("bcryptjs");

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

module.exports = async function handler(req, res) {
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

    // GET = LIST
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

    // POST = ACTIONS
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const action = String(req.body?.action || "").trim();

    // Helper: enforce pro (you asked password-editing is pro-only)
    function requirePro() {
      if ((plan || "free") !== "pro") {
        const err = new Error("Pro required");
        err.status = 403;
        throw err;
      }
    }

    async function resolveWidgetForCustomer(slug) {
      const s = String(slug || "").trim();
      if (!s) {
        const err = new Error("Missing slug");
        err.status = 400;
        throw err;
      }

      const wUrl =
        `${supabaseUrl}/rest/v1/widgets?customer_id=eq.${encodeURIComponent(customer.id)}` +
        `&slug=eq.${encodeURIComponent(s)}` +
        `&select=id,slug,name,customer_id&limit=1`;

      const wResp = await fetchJson(wUrl, { headers });
      if (!wResp.res.ok) {
        const err = new Error("Failed to fetch widget");
        err.status = 500;
        throw err;
      }
      const w = Array.isArray(wResp.json) ? wResp.json[0] : null;
      if (!w) {
        const err = new Error("Widget not found");
        err.status = 404;
        throw err;
      }
      return w;
    }

    async function setCustomerPassword(password) {
      requirePro();

      const pw = String(password || "");
      if (pw.trim().length < 6) {
        const err = new Error("Password must be at least 6 characters");
        err.status = 400;
        throw err;
      }

      const hash = await bcrypt.hash(pw, 10);
      const now = new Date().toISOString();

      // Upsert-like behavior using REST:
      // - delete existing row (if any)
      // - insert new row
      await fetchJson(
        `${supabaseUrl}/rest/v1/customer_profile_auth?customer_id=eq.${encodeURIComponent(customer.id)}`,
        { method: "DELETE", headers: { ...headers, Prefer: undefined } }
      );

      const ins = await fetchJson(`${supabaseUrl}/rest/v1/customer_profile_auth`, {
        method: "POST",
        headers,
        body: JSON.stringify([{ customer_id: customer.id, password_hash: hash, updated_at: now }]),
      });

      if (!ins.res.ok) {
        const err = new Error("Failed to save password");
        err.status = 500;
        throw err;
      }
      return true;
    }

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

    if (action === "rename") {
      const slug = String(req.body?.slug || "").trim();
      const name = String(req.body?.name || "").trim();

      if (!slug) return res.status(400).json({ error: "Missing slug" });
      if (!name) return res.status(400).json({ error: "Missing name" });

      // Ensure widget belongs to customer
      const widget = await resolveWidgetForCustomer(slug);

      const patchUrl = `${supabaseUrl}/rest/v1/widgets?id=eq.${encodeURIComponent(widget.id)}`;
      const patchResp = await fetchJson(patchUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name }),
      });

      if (!patchResp.res.ok) {
        console.error("Widget rename failed:", patchResp.res.status, patchResp.text);
        return res.status(500).json({ error: "Failed to rename widget" });
      }

      const updated = Array.isArray(patchResp.json) ? patchResp.json[0] : patchResp.json;
      return res.json({ ok: true, plan, widget: updated });
    }

    if (action === "set_edit_password") {
      await setCustomerPassword(req.body?.password);
      return res.json({ ok: true, plan });
    }

    if (action === "save_setup") {
      // One Save button on dashboard: rename widget + set password together
      const slug = String(req.body?.slug || "").trim();
      const name = String(req.body?.name || "").trim();
      const password = req.body?.password;

      if (!slug) return res.status(400).json({ error: "Missing slug" });
      if (!name) return res.status(400).json({ error: "Missing name" });
      if (!password) return res.status(400).json({ error: "Missing password" });

      // Ensure widget belongs to customer
      const widget = await resolveWidgetForCustomer(slug);

      // Rename (if different)
      if (String(widget.name || "") !== name) {
        const patchUrl = `${supabaseUrl}/rest/v1/widgets?id=eq.${encodeURIComponent(widget.id)}`;
        const patchResp = await fetchJson(patchUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ name }),
        });
        if (!patchResp.res.ok) {
          console.error("Widget rename failed:", patchResp.res.status, patchResp.text);
          return res.status(500).json({ error: "Failed to rename widget" });
        }
      }

      // Set customer password (pro-only)
      await setCustomerPassword(password);

      return res.json({ ok: true, plan });
    }

    return res.status(400).json({
      error: "Invalid action",
      allowed_actions: ["create", "rename", "set_edit_password", "save_setup"],
    });
  } catch (err) {
    const status = err?.status || 500;
    if (status >= 500) console.error("widgets api error:", err);
    return res.status(status).json({ error: err.message || "Server error" });
  }
};