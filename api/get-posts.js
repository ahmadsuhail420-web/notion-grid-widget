export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const { slug, db } = req.query;
    if (!slug) return res.status(400).json({ profile: null, posts: [] });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    // ---------------------------
    // 1) Resolve WIDGET by slug
    // ---------------------------
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

    // ---------------------------
    // 2) Get customer (WITH PLAN)
    // ---------------------------
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

    const plan = customer.plan || "free";

    // ---------------------------
    // 3) Load widget settings (Pro/Advanced will use; Free can ignore)
    // ---------------------------
    let widget_settings = {
      white_label_enabled: false,
      custom_css: "",
      layout_mode: "grid",
      auto_refresh_enabled: false,
      auto_refresh_interval_sec: 0,
      theme_mode: "default",
    };

    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/widget_settings?widget_id=eq.${widget.id}&select=white_label_enabled,custom_css,layout_mode,auto_refresh_enabled,auto_refresh_interval_sec,theme_mode`,
      { headers }
    );

    if (settingsRes.ok) {
      const [s] = await settingsRes.json();
      if (s) widget_settings = { ...widget_settings, ...s };
    } else {
      // Not fatal (widget can still work)
      console.warn("Widget settings fetch failed:", settingsRes.status);
    }

    // ---------------------------
    // 4) Get Notion connection (by customer)
    // ---------------------------
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=id,access_token`,
      { headers }
    );

    if (!connRes.ok) {
      console.error("Connection fetch failed:", connRes.status);
      return res.json({ profile: null, posts: [], plan, widget_settings });
    }

    const [connection] = await connRes.json();
    if (!connection?.access_token) return res.json({ profile: null, posts: [], plan, widget_settings });

    // ---------------------------
    // 5) Get widget databases
    // IMPORTANT: prefer widget_id if present; fallback to connection_id for backward compatibility
    // ---------------------------
    let databases = [];

    // Try widget_id first
    const dbByWidgetRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?widget_id=eq.${widget.id}&select=database_id,is_primary,label`,
      { headers }
    );

    if (dbByWidgetRes.ok) {
      databases = await dbByWidgetRes.json();
    } else {
      console.warn("DB fetch by widget_id failed:", dbByWidgetRes.status);
    }

    // Fallback (legacy schema)
    if (!Array.isArray(databases) || databases.length === 0) {
      const dbByConnRes = await fetch(
        `${supabaseUrl}/rest/v1/notion_databases?connection_id=eq.${connection.id}&select=database_id,is_primary,label`,
        { headers }
      );

      if (!dbByConnRes.ok) {
        console.error("Database fetch failed:", dbByConnRes.status);
        return res.json({ profile: null, posts: [], plan, widget_settings, databases: [] });
      }
      databases = await dbByConnRes.json();
    }

    if (!Array.isArray(databases) || databases.length === 0) {
      return res.json({ profile: null, posts: [], plan, widget_settings, databases: [] });
    }

    const primary = databases.find(d => d.is_primary) || null;

    let databaseIds = [];

    // FREE: primary only
    if (plan === "free") {
      if (primary?.database_id) databaseIds = [primary.database_id];
    }
    // ADVANCED: allow choose 1 OR fallback primary
    else if (plan === "advanced") {
      if (db) databaseIds = [db];
      else if (primary?.database_id) databaseIds = [primary.database_id];
    }
    // PRO: allow merge OR choose 1 OR fallback primary
    else if (plan === "pro") {
      if (db === "merge") databaseIds = databases.map(d => d.database_id);
      else if (db) databaseIds = [db];
      else if (primary?.database_id) databaseIds = [primary.database_id];
    }

    if (databaseIds.length === 0) {
      return res.json({ profile: null, posts: [], plan, widget_settings, databases });
    }

    // ---------------------------
    // 6) Query Notion (WITH PAGINATION)
    // ---------------------------
    let allPages = [];

    for (const databaseId of databaseIds) {
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

        allPages = allPages.concat(notionData.results);
        hasMore = notionData.has_more;
        cursor = notionData.next_cursor;
      }
    }

    // ---------------------------
    // 7) Parse rows (Attachment-only)
    // ---------------------------
    let profile = null;
    const posts = [];

    for (const page of allPages) {
      const profileName =
        page.properties?.["Profile Name"]?.rich_text?.[0]?.plain_text || null;

      const profilePicture =
        page.properties?.["Profile Picture"]?.files?.[0]?.file?.url ||
        page.properties?.["Profile Picture"]?.files?.[0]?.external?.url ||
        null;

      const profileNote =
        page.properties?.["Profile Note"]?.rich_text?.map(t => t.plain_text).join("") || null;

      if (profileName || profilePicture || profileNote) {
        profile = {
          name: profileName || "Grid Planner",
          picture: profilePicture,
          note: profileNote,
        };
        continue;
      }

      const name = page.properties?.Name?.title?.[0]?.plain_text || "";
      const publishDate = page.properties?.["Publish Date"]?.date?.start || null;

      const attachment =
        page.properties?.Attachment?.files?.map(f => f.file?.url || f.external?.url) || [];

      const thumbnail =
        page.properties?.Thumbnail?.files?.[0]?.file?.url ||
        page.properties?.Thumbnail?.files?.[0]?.external?.url ||
        null;

      const type = page.properties?.Type?.multi_select?.map(t => t.name) || [];

      posts.push({
        id: page.id,
        name,
        publishDate,
        attachment,
        thumbnail,
        type,
        pinned: page.properties?.Pin?.checkbox || false,
        hide: page.properties?.Hide?.checkbox || false,
        highlight: page.properties?.Highlight?.checkbox || false,
      });
    }

    // ---------------------------
    // 8) Return (now includes widget_settings + databases)
    // You can delete list-database.js if you update frontend to read databases from here.
    // ---------------------------
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
}