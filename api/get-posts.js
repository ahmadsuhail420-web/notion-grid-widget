export default async function handler(req, res) {
  try {
    const { slug, db } = req.query;
    if (!slug) {
      return res.status(400).json({ profile: null, posts: [] });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    /* --------------------------------------------------
       1️⃣ Get customer
    -------------------------------------------------- */
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&status=eq.active&select=id`,
      { headers }
    );
    const [customer] = await customerRes.json();

    if (!customer) {
      return res.json({ profile: null, posts: [] });
    }

    /* --------------------------------------------------
       2️⃣ Get Notion OAuth token (workspace-level)
    -------------------------------------------------- */
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=access_token`,
      { headers }
    );
    const [connection] = await connRes.json();

    if (!connection?.access_token) {
      return res.json({ profile: null, posts: [] });
    }

    /* --------------------------------------------------
       3️⃣ Resolve database (explicit OR primary)
    -------------------------------------------------- */
    let dbQuery;

    if (db) {
      // explicit database via query param
      dbQuery = `database_id=eq.${db}`;
    } else {
      // fallback to primary database
      dbQuery = `is_primary=eq.true`;
    }

    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?customer_id=eq.${customer.id}&${dbQuery}&select=database_id`,
      { headers }
    );
    const [dbRow] = await dbRes.json();

    if (!dbRow?.database_id) {
      return res.json({ profile: null, posts: [] });
    }

    const databaseId = dbRow.database_id;

    /* --------------------------------------------------
       4️⃣ Query Notion database
    -------------------------------------------------- */
    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
      }
    );

    const notionData = await notionRes.json();
    if (!Array.isArray(notionData.results)) {
      return res.json({ profile: null, posts: [] });
    }

    /* --------------------------------------------------
       5️⃣ Parse rows
    -------------------------------------------------- */
    let profile = null;
    const posts = [];

    for (const page of notionData.results) {
      // ---------- PROFILE ROW ----------
      const profileName =
        page.properties?.["Profile Name"]?.rich_text?.[0]?.plain_text || null;

      const profilePicture =
        page.properties?.["Profile Picture"]?.files?.[0]?.file?.url ||
        page.properties?.["Profile Picture"]?.files?.[0]?.external?.url ||
        null;

      const profileNote =
        page.properties?.["Profile Note"]?.rich_text
          ?.map(t => t.plain_text)
          .join("") || null;

      if (profileName || profilePicture || profileNote) {
        profile = {
          name: profileName || "Grid Planner",
          picture: profilePicture,
          note: profileNote,
        };
        continue;
      }

      // ---------- POST ROW ----------
      const name =
        page.properties?.Name?.title?.[0]?.plain_text || "";

      const publishDate =
        page.properties?.["Publish Date"]?.date?.start || null;

      const attachment =
        page.properties?.Attachment?.files?.map(f =>
          f.file?.url || f.external?.url
        ) || [];

      const video =
        page.properties?.["Media/Video"]?.files?.[0]?.file?.url ||
        page.properties?.["Media/Video"]?.files?.[0]?.external?.url ||
        null;

      const thumbnail =
        page.properties?.Thumbnail?.files?.[0]?.file?.url ||
        page.properties?.Thumbnail?.files?.[0]?.external?.url ||
        null;

      const type =
        page.properties?.Type?.multi_select?.map(t => t.name) || [];

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

    /* --------------------------------------------------
       6️⃣ Done
    -------------------------------------------------- */
    res.json({
      profile,
      posts,
      plan: "pro",
    });

  } catch (err) {
    console.error("get-posts error:", err);
    res.status(500).json({ error: "Failed to load posts" });
  }
}
