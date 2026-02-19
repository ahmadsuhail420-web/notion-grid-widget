export default async function handler(req, res) {
  try {
    const { slug, db } = req.query;
    if (!slug) return res.json({ profile: null, posts: [] });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Customer
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&status=eq.active&select=id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const customers = await customerRes.json();
    if (!customers.length) return res.json({ profile: null, posts: [] });

    // 2. Notion connection
    const dbKey = db || "db1"; // default fallback

const connRes = await fetch(
  `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customers[0].id}&database_key=eq.${dbKey}&select=access_token,database_id`,
  {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  }
);
    const conns = await connRes.json();
    if (!conns.length) return res.json({ profile: null, posts: [] });

    const { access_token, database_id } = conns[0];

    // 3. Query Notion
    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${database_id}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
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

      // 👉 PROFILE ROW
      if (profileName || profilePicture) {
        profile = {
  name: profileName || "Grid Planner",
  picture: profilePicture || null,
  note: profileNote || null
};
        continue;
      }

      // 👉 POST ROW
      const name =
        page.properties?.Name?.title?.[0]?.plain_text || "";

      const publishDate =
        page.properties?.["Publish Date"]?.date?.start || null;

      const attachment =
        page.properties?.Attachment?.files?.map(f =>
          f.file?.url || f.external?.url
        ) || null;

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

   res.json({ profile, posts, plan: "pro" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
