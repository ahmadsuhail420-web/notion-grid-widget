const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function randomTokenHex(len = 48) {
  return crypto.randomBytes(len / 2).toString("hex");
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
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
  };

  try {
    // ============================
    // POST: Unlock editing (merged)
    // ============================
    if (req.method === "POST") {
      const body = (req.body && typeof req.body === "object") ? req.body : {};
      const action = String(body.action || "").trim();

      if (action !== "unlock_editing") {
        return res.status(400).json({ error: "Invalid action", allowed_actions: ["unlock_editing"] });
      }

      const slug = String(body.slug || "").trim();
      const password = String(body.password || "");

      if (!slug) return res.status(400).json({ error: "Missing slug" });
      if (!password) return res.status(400).json({ error: "Missing password" });

      // 1) Resolve widget -> customer_id
      const widgetRes = await fetch(
        `${supabaseUrl}/rest/v1/widgets?slug=eq.${encodeURIComponent(slug)}&select=id,customer_id,slug,name&limit=1`,
        { headers }
      );
      if (!widgetRes.ok) {
        return res.status(500).json({ error: "Failed to fetch widget" });
      }
      const widgets = await safeJson(widgetRes);
      const widget = Array.isArray(widgets) ? widgets[0] : null;
      if (!widget) return res.status(404).json({ error: "Widget not found" });

      // 2) Customer plan (must be active + pro)
      const customerRes = await fetch(
        `${supabaseUrl}/rest/v1/customers?id=eq.${encodeURIComponent(widget.customer_id)}` +
          `&status=eq.active&select=id,plan&limit=1`,
        { headers }
      );
      if (!customerRes.ok) return res.status(403).json({ error: "Customer not active" });

      const customers = await safeJson(customerRes);
      const customer = Array.isArray(customers) ? customers[0] : null;
      if (!customer) return res.status(403).json({ error: "Customer not active" });

      const plan = (customer.plan || "free") === "pro" ? "pro" : "free";
      if (plan !== "pro") return res.status(403).json({ error: "Pro required" });

      // 3) Load password hash
      const authRes = await fetch(
        `${supabaseUrl}/rest/v1/customer_profile_auth?customer_id=eq.${encodeURIComponent(customer.id)}` +
          `&select=password_hash&limit=1`,
        { headers }
      );
      if (!authRes.ok) return res.status(500).json({ error: "Failed to load password" });

      const authRows = await safeJson(authRes);
      const auth = Array.isArray(authRows) ? authRows[0] : null;
      if (!auth?.password_hash) return res.status(403).json({ error: "Password not set" });

      const ok = await bcrypt.compare(password, String(auth.password_hash));
      if (!ok) return res.status(401).json({ error: "Invalid password" });

      // 4) Create session token (1 hour)
      const editToken = randomTokenHex(48);
      const nowIso = new Date().toISOString();
      const expiresAtIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const insRes = await fetch(`${supabaseUrl}/rest/v1/customer_edit_sessions`, {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            token: editToken,
            customer_id: customer.id,
            created_at: nowIso,
            expires_at: expiresAtIso,
          },
        ]),
      });

      if (!insRes.ok) {
        const text = await insRes.text().catch(() => "");
        console.error("Session insert failed:", insRes.status, text);
        return res.status(500).json({ error: "Failed to create session" });
      }

      return res.status(200).json({ ok: true, edit_token: editToken, expires_at: expiresAtIso });
    }

    // ============================
    // GET: Existing behavior
    // ============================
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { slug, db } = req.query;
    if (!slug) return res.status(400).json({ profile: null, posts: [] });

    // 1) Resolve widget
    const widgetRes = await fetch(
      `${supabaseUrl}/rest/v1/widgets?slug=eq.${encodeURIComponent(slug)}&select=id,customer_id,slug,name`,
      { headers }
    );
    if (!widgetRes.ok) {
      console.error("Widget fetch failed:", widgetRes.status);
      return res.json({ profile: null, posts: [] });
    }

    const [widget] = await widgetRes.json();
    if (!widget) return res.json({ profile: null, posts: [] });

    // 2) Customer plan
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?id=eq.${widget.customer_id}&status=eq.active&select=id,plan`,
      { headers }
    );
    if (!customerRes.ok) {
      console.error("Customer fetch failed:", customerRes.status);
      return res.json({ profile: null, posts: [] });
    }

    const [customer] = await customerRes.json();
    if (!customer) return res.json({ profile: null, posts: [] });

    const rawPlan = customer.plan || "free";
    const plan = rawPlan === "pro" ? "pro" : "free";

    // 3) Widget settings (+ profile fields stored in Supabase)
    let widget_settings = {
      white_label_enabled: false,
      custom_css: "",
      layout_mode: "grid",
      auto_refresh_enabled: false,
      auto_refresh_interval_sec: 0,
      theme_mode: "default",

      // new profile fields
      profile_name: null,
      profile_note: null,
      profile_picture_url: null,
    };

    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/widget_settings?widget_id=eq.${widget.id}` +
        `&select=white_label_enabled,custom_css,layout_mode,auto_refresh_enabled,auto_refresh_interval_sec,theme_mode,profile_name,profile_note,profile_picture_url`,
      { headers }
    );

    if (settingsRes.ok) {
      const [s] = await settingsRes.json();
      if (s) widget_settings = { ...widget_settings, ...s };
    } else {
      console.warn("Widget settings fetch failed:", settingsRes.status);
    }

    // Profile now comes from Supabase (NOT Notion)
    const profile = {
      name: widget_settings.profile_name || widget.name || "Grid Planner",
      picture: widget_settings.profile_picture_url || "/icons/profile-placeholder.png",
      note: widget_settings.profile_note || "",
    };

    // 4) Notion connection
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=id,access_token`,
      { headers }
    );
    if (!connRes.ok) {
      console.error("Connection fetch failed:", connRes.status);
      return res.json({ profile, posts: [], plan, widget_settings });
    }

    const [connection] = await connRes.json();
    if (!connection?.access_token) return res.json({ profile, posts: [], plan, widget_settings });

    // 5) Widget databases
    let databases = [];
    const dbByWidgetRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?widget_id=eq.${widget.id}&select=database_id,is_primary,label`,
      { headers }
    );

    if (dbByWidgetRes.ok) {
      databases = await dbByWidgetRes.json();
    } else {
      console.warn("DB fetch by widget_id failed:", dbByWidgetRes.status);
    }

    if (!Array.isArray(databases) || databases.length === 0) {
      return res.json({ profile, posts: [], plan, widget_settings, databases: [] });
    }

    const primary = databases.find(d => d.is_primary) || databases[0] || null;
    const primaryDbId = primary?.database_id || null;

    // Decide merge (server truth)
    const wantsMerge = plan === "pro" && String(db || "").toLowerCase() === "merge";

    let databaseIds = [];
    if (plan === "free") {
      if (primaryDbId) databaseIds = [primaryDbId];
    } else {
      if (wantsMerge) databaseIds = databases.map(d => d.database_id);
      else if (db) databaseIds = [String(db)];
      else if (primaryDbId) databaseIds = [primaryDbId];
    }

    if (databaseIds.length === 0) {
      return res.json({ profile, posts: [], plan, widget_settings, databases });
    }

    // ---------------------------
    // Query Notion (pagination helper)
    // ---------------------------
    async function queryAllPages(databaseId) {
      let pages = [];
      let hasMore = true;
      let cursor = undefined;

      while (hasMore) {
        const body = cursor ? { start_cursor: cursor } : {};

        const notionRes = await fetch(
          `https://api.notion.com/v1/databases/${databaseId}/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${connection.access_token}`,
              "Content-Type": "application/json",
              "Notion-Version": "2022-06-28",
            },
            body: JSON.stringify(body),
          }
        );

        if (!notionRes.ok) {
          console.error(`Notion API error for ${databaseId}:`, notionRes.status);
          break;
        }

        const notionData = await notionRes.json();
        if (!Array.isArray(notionData.results)) break;

        pages = pages.concat(notionData.results);
        hasMore = notionData.has_more;
        cursor = notionData.next_cursor;
      }

      return pages;
    }

    // Ensure primary DB is queried first in merge mode
    let orderedDbIds = databaseIds.slice();
    if (wantsMerge && primaryDbId) {
      orderedDbIds = [primaryDbId, ...databaseIds.filter(id => id !== primaryDbId)];
    }

    const pagesByDb = {};
    for (const databaseId of orderedDbIds) {
      pagesByDb[databaseId] = await queryAllPages(databaseId);
    }

    // ---------------------------
    // Parse rows (posts only)
    // ---------------------------
    function parsePostFromPage(page) {
      const name = page.properties?.Name?.title?.[0]?.plain_text || "";
      const publishDate = page.properties?.["Publish Date"]?.date?.start || null;

      const attachment =
        page.properties?.Attachment?.files?.map(f => f.file?.url || f.external?.url) || [];

      const thumbnail =
        page.properties?.Thumbnail?.files?.[0]?.file?.url ||
        page.properties?.Thumbnail?.files?.[0]?.external?.url ||
        null;

      const type = page.properties?.Type?.multi_select?.map(t => t.name) || [];

      return {
        id: page.id,
        name,
        publishDate,
        attachment,
        thumbnail,
        type,
        pinned: page.properties?.Pin?.checkbox || false,
        hide: page.properties?.Hide?.checkbox || false,
        highlight: page.properties?.Highlight?.checkbox || false,
      };
    }

    // Posts: from all selected DBs (no special profile row)
    const posts = [];
    for (const databaseId of orderedDbIds) {
      const pages = pagesByDb[databaseId] || [];
      for (const page of pages) {
        posts.push(parsePostFromPage(page));
      }
    }

    return res.json({
      profile,
      posts,
      plan,
      widget_settings,
      databases,
      widget: { id: widget.id, slug: widget.slug, name: widget.name },
    });
  } catch (err) {
    console.error("get-posts error:", err);
    return res.status(500).json({ error: "Failed to load posts" });
  }
};