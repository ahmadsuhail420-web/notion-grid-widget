export default async function handler(req, res) {
  try {
    const { slug, db } = req.query;
    if (!slug) return res.json({ profile: null, posts: [] });

    const headers = {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    };

    /* 1️⃣ Get customer */
    const customerRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/customers?slug=eq.${slug}&status=eq.active&select=id`,
      { headers }
    );
    const [customer] = await customerRes.json();
    if (!customer) return res.json({ profile: null, posts: [] });

    /* 2️⃣ Get Notion token */
    const connRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=access_token`,
      { headers }
    );
    const [conn] = await connRes.json();
    if (!conn) return res.json({ profile: null, posts: [] });

    /* 3️⃣ Get database (primary OR override) */
    const dbFilter = db
      ? `id=eq.${db}`
      : `is_primary=eq.true`;

    const dbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/notion_databases?customer_id=eq.${customer.id}&${dbFilter}&select=notion_database_id`,
      { headers }
    );
    const [database] = await dbRes.json();
    if (!database) return res.json({ profile: null, posts: [] });

    /* 4️⃣ Query Notion */
    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${database.notion_database_id}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${conn.access_token}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
      }
    );

    const notionData = await notionRes.json();

    let profile = null;
    const posts = [];

    for (const page of notionData.results) {
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

      if (profileName || profilePicture) {
        profile = {
          name: profileName || "Grid Planner",
          picture: profilePicture || null,
          note: profileNote || null,
        };
        continue;
      }

      posts.push({
        id: page.id,
        name: page.properties?.Name?.title?.[0]?.plain_text || "",
        publishDate: page.properties?.["Publish Date"]?.date?.start || null,
        attachment: page.properties?.Attachment?.files?.map(f =>
          f.file?.url || f.external?.url
        ) || null,
        video:
          page.properties?.["Media/Video"]?.files?.[0]?.file?.url ||
          page.properties?.["Media/Video"]?.files?.[0]?.external?.url ||
          null,
        thumbnail:
          page.properties?.Thumbnail?.files?.[0]?.file?.url ||
          page.properties?.Thumbnail?.files?.[0]?.external?.url ||
          null,
        type:
          page.properties?.Type?.multi_select?.map(t => t.name) || [],
        pinned: page.properties?.Pin?.checkbox || false,
        hide: page.properties?.Hide?.checkbox || false,
        highlight: page.properties?.Highlight?.checkbox || false,
      });
    }

    res.json({ profile, posts, plan: "pro" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}