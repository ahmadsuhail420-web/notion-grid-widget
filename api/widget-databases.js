/**
 * One endpoint to manage widget databases (saves Vercel serverless function slots).
 *
 * Supports:
 * - GET  /api/widget-databases?slug=...                      -> list databases for widget
 * - POST /api/widget-databases  { action:"add", ... }        -> add database to widget
 * - POST /api/widget-databases  { action:"rename", ... }     -> rename label
 * - POST /api/widget-databases  { action:"set_primary", ... }-> set primary db
 * - POST /api/widget-databases  { action:"delete", ... }     -> delete db from widget
 *
 * Uses widgets.slug as source of truth (Pro: multiple widgets).
 * Reads plan from customers via widget.customer_id and enforces plan_limits:
 * - free: max 1 db
 * - advanced: max 2 db
 * - pro: unlimited
 */

function getDbLimit(plan) {
  if (plan === "free") return 1;
  if (plan === "advanced") return 2;
  return Infinity;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
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
    // slug can come from query (GET) or body (POST)
    const slug = (req.query?.slug || req.body?.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    // 1) Resolve widget by slug
    const widgetUrl = `${supabaseUrl}/rest/v1/widgets?slug=eq.${encodeURIComponent(slug)}&select=id,customer_id,slug,name`;
    const widgetResp = await fetchJson(widgetUrl, { headers });

    if (!widgetResp.res.ok) {
      console.error("Widget fetch failed:", widgetResp.res.status, widgetResp.text);
      return res.status(widgetResp.res.status).json({ error: "Failed to fetch widget" });
    }

    const widget = Array.isArray(widgetResp.json) ? widgetResp.json[0] : null;
    if (!widget) return res.status(404).json({ error: "Widget not found" });

    // 2) Get customer plan
    const customerUrl = `${supabaseUrl}/rest/v1/customers?id=eq.${widget.customer_id}&status=eq.active&select=id,plan`;
    const custResp = await fetchJson(customerUrl, { headers });

    if (!custResp.res.ok) {
      console.error("Customer fetch failed:", custResp.res.status, custResp.text);
      return res.status(custResp.res.status).json({ error: "Failed to fetch customer" });
    }

    const customer = Array.isArray(custResp.json) ? custResp.json[0] : null;
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const plan = customer.plan || "free";
    const limit = getDbLimit(plan);

    // -------------------------
    // GET = LIST
    // -------------------------
    if (req.method === "GET") {
      const dbUrl =
        `${supabaseUrl}/rest/v1/notion_databases?widget_id=eq.${widget.id}` +
        `&select=id,label,database_id,is_primary,created_at` +
        `&order=is_primary.desc&order=created_at.asc`;

      const dbResp = await fetchJson(dbUrl, { headers });

      if (!dbResp.res.ok) {
        console.error("Database list failed:", dbResp.res.status, dbResp.text);
        return res.json({ plan, limit, widget: { id: widget.id, slug: widget.slug }, databases: [] });
      }

      return res.json({
        plan,
        limit,
        widget: { id: widget.id, slug: widget.slug, name: widget.name },
        databases: dbResp.json || [],
      });
    }

    // -------------------------
    // POST = ACTIONS
    // -------------------------
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const action = String(req.body?.action || "").trim();

    // Helper: list count
    async function getExistingCount() {
      const countUrl =
        `${supabaseUrl}/rest/v1/notion_databases?widget_id=eq.${widget.id}&select=id`;
      const r = await fetch(countUrl, { headers: { ...headers, Prefer: "count=exact" } });
      // Supabase returns count in header: content-range: 0-0/COUNT
      const range = r.headers.get("content-range") || "";
      const m = range.match(/\/(\d+)$/);
      return m ? Number(m[1]) : 0;
    }

    if (action === "add") {
      const databaseId = String(req.body?.databaseId || "").trim();
      const label = String(req.body?.label || "").trim();

      if (!databaseId || !label) {
        return res.status(400).json({ error: "Missing databaseId or label" });
      }

      const existingCount = await getExistingCount();
      if (existingCount >= limit) {
        const msg =
          plan === "free"
            ? "Free plan allows only 1 database."
            : plan === "advanced"
            ? "Advanced plan allows up to 2 databases."
            : "Database limit reached.";
        return res.status(403).json({ error: msg, plan, limit });
      }

      // Prevent duplicates
      const dupUrl =
        `${supabaseUrl}/rest/v1/notion_databases?widget_id=eq.${widget.id}` +
        `&database_id=eq.${encodeURIComponent(databaseId)}&select=id`;
      const dupResp = await fetchJson(dupUrl, { headers });

      if (dupResp.res.ok && Array.isArray(dupResp.json) && dupResp.json.length > 0) {
        return res.status(409).json({ error: "Database already added to this widget." });
      }

      const isPrimary = existingCount === 0;

      const insertUrl = `${supabaseUrl}/rest/v1/notion_databases`;
      const insResp = await fetchJson(insertUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          widget_id: widget.id,
          customer_id: customer.id, // optional; keep for reporting
          database_id: databaseId,
          label,
          is_primary: isPrimary,
        }),
      });

      if (!insResp.res.ok) {
        console.error("Insert failed:", insResp.res.status, insResp.text);
        return res.status(500).json({ error: "Failed to add database" });
      }

      return res.json({
        ok: true,
        plan,
        limit,
        widget: { id: widget.id, slug: widget.slug },
        database: insResp.json,
      });
    }

    if (action === "rename") {
      const id = String(req.body?.id || "").trim();
      const label = String(req.body?.label || "").trim();
      if (!id || !label) return res.status(400).json({ error: "Missing id or label" });

      const patchUrl =
        `${supabaseUrl}/rest/v1/notion_databases?id=eq.${encodeURIComponent(id)}&widget_id=eq.${widget.id}`;

      const patchResp = await fetchJson(patchUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ label }),
      });

      if (!patchResp.res.ok) {
        console.error("Rename failed:", patchResp.res.status, patchResp.text);
        return res.status(500).json({ error: "Failed to rename database" });
      }

      return res.json({ ok: true, plan, widget: { id: widget.id, slug: widget.slug }, database: patchResp.json });
    }

    if (action === "set_primary") {
      const id = String(req.body?.id || "").trim();
      if (!id) return res.status(400).json({ error: "Missing id" });

      // 1) unset all primaries for this widget
      const unsetUrl = `${supabaseUrl}/rest/v1/notion_databases?widget_id=eq.${widget.id}`;
      const unsetResp = await fetchJson(unsetUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_primary: false }),
      });

      if (!unsetResp.res.ok) {
        console.error("Unset primary failed:", unsetResp.res.status, unsetResp.text);
        return res.status(500).json({ error: "Failed to update primary database" });
      }

      // 2) set primary for selected row
      const setUrl =
        `${supabaseUrl}/rest/v1/notion_databases?id=eq.${encodeURIComponent(id)}&widget_id=eq.${widget.id}`;

      const setResp = await fetchJson(setUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_primary: true }),
      });

      if (!setResp.res.ok) {
        console.error("Set primary failed:", setResp.res.status, setResp.text);
        return res.status(500).json({ error: "Failed to set primary database" });
      }

      return res.json({ ok: true, plan, widget: { id: widget.id, slug: widget.slug }, database: setResp.json });
    }

    if (action === "delete") {
      const id = String(req.body?.id || "").trim();
      if (!id) return res.status(400).json({ error: "Missing id" });

      // Check if deleting primary; if so, after delete set another as primary (if any)
      const getUrl =
        `${supabaseUrl}/rest/v1/notion_databases?id=eq.${encodeURIComponent(id)}&widget_id=eq.${widget.id}&select=id,is_primary`;
      const rowResp = await fetchJson(getUrl, { headers });

      const row = Array.isArray(rowResp.json) ? rowResp.json[0] : null;

      const delUrl =
        `${supabaseUrl}/rest/v1/notion_databases?id=eq.${encodeURIComponent(id)}&widget_id=eq.${widget.id}`;
      const delResp = await fetch(delUrl, { method: "DELETE", headers });

      if (!delResp.ok) {
        const txt = await delResp.text();
        console.error("Delete failed:", delResp.status, txt);
        return res.status(500).json({ error: "Failed to delete database" });
      }

      if (row?.is_primary) {
        // pick oldest remaining and set primary
        const listUrl =
          `${supabaseUrl}/rest/v1/notion_databases?widget_id=eq.${widget.id}` +
          `&select=id&order=created_at.asc&limit=1`;
        const remain = await fetchJson(listUrl, { headers });
        const next = Array.isArray(remain.json) ? remain.json[0] : null;

        if (next?.id) {
          const setUrl =
            `${supabaseUrl}/rest/v1/notion_databases?id=eq.${encodeURIComponent(next.id)}&widget_id=eq.${widget.id}`;
          await fetch(setUrl, { method: "PATCH", headers, body: JSON.stringify({ is_primary: true }) });
        }
      }

      return res.json({ ok: true, plan, widget: { id: widget.id, slug: widget.slug } });
    }

    return res.status(400).json({
      error: "Invalid action",
      allowed_actions: ["add", "rename", "set_primary", "delete"],
    });
  } catch (err) {
    console.error("widget-databases error:", err);
    return res.status(500).json({ error: "Failed to handle widget databases" });
  }
}