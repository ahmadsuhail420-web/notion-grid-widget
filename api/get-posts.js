export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { slug, db } = req.query;
    if (!slug) return res.status(400).json({ profile: null, posts: [] });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    // 1) Get customer (WITH PLAN)
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&status=eq.active&select=id,plan`,
      { headers }
    );
    const [customer] = await customerRes.json();
    if (!customer) return res.json({ profile: null, posts: [] });

    const plan = customer.plan || "free";

    // 2) Get Notion connection
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=id,access_token`,
      { headers }
    );
    const [connection] = await connRes.json();
    if (!connection?.access_token) return res.json({ profile: null, posts: [] });

    // 3) Get selected databases (✅ use database_id)
    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?connection_id=eq.${connection.id}&select=database_id,is_primary`,
      { headers }
    );
    const databases = await dbRes.json();

    if (!Array.isArray(databases) || databases.length === 0) {
      return res.json({ profile: null, posts: [], plan });
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
      return res.json({ profile: null, posts: [], plan });
    }

    // 4) Query Notion (WITH PAGINATION)
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

        const notionData = await notionRes.json();
        if (!Array.isArray(notionData.results)) break;

        allPages = allPages.concat(notionData.results);
        hasMore = notionData.has_more;
        cursor = notionData.next_cursor;
      }
    }

    // 5) Parse rows (UNCHANGED LOGIC)
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

      const video =
        page.properties?.["Media/Video"]?.files?.[0]?.file?.url ||
        page.properties?.["Media/Video"]?.files?.[0]?.external?.url ||
        null;

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
        video,
        thumbnail,
        type,
        pinned: page.properties?.Pin?.checkbox || false,
        hide: page.properties?.Hide?.checkbox || false,
        highlight: page.properties?.Highlight?.checkbox || false,
      });
    }

    // 6) Return
    return res.json({ profile, posts, plan });
  } catch (err) {
    console.error("get-posts error:", err);
    return res.status(500).json({ error: "Failed to load posts" });
  }
}