export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) return res.json({ profile: null, posts: [] });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1️⃣ Find customer
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&status=eq.active&select=id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const customers = await customerRes.json();
    if (!customers.length) {
      return res.json({ profile: null, posts: [] });
    }

    const customerId = customers[0].id;

    // 2️⃣ Get Notion connection
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customerId}&select=access_token,database_id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const conns = await connRes.json();
    if (!conns.length) {
      return res.json({ profile: null, posts: [] });
    }

    const { access_token, database_id } = conns[0];

    // 3️⃣ Query Notion database
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

    // 4️⃣ PROFILE (database-level, fallback safe)
    const profile = {
      name: "Grid Planner",
      picture: null,
    };

    // OPTIONAL: use database title as profile name
    if (notionData?.results?.length) {
      profile.name =
        notionData.results[0]?.parent?.database_id
          ? profile.name
          : profile.name;
    }

    // 5️⃣ POSTS
    const posts = notionData.results.map(page => {
      const postName =
        page.properties?.Name?.title?.[0]?.plain_text || "";

      const publishDate =
        page.properties?.["Publish Date"]?.date?.start || null;

      const files = page.properties?.Attachment?.files || [];
      const attachment = files.length
        ? files.map(f => f.file?.url || f.external?.url).filter(Boolean)
        : null;

      const videoFiles = page.properties?.["Media/Video"]?.files || [];
      const video = videoFiles.length
        ? videoFiles.map(f => f.file?.url || f.external?.url)[0]
        : null;

      const thumbFiles = page.properties?.Thumbnail?.files || [];
      const thumbnail = thumbFiles.length
        ? thumbFiles.map(f => f.file?.url || f.external?.url)[0]
        : null;

      const type =
        page.properties?.Type?.multi_select?.map(t => t.name) || [];

      const pinned = page.properties?.Pin?.checkbox || false;
      const hide = page.properties?.Hide?.checkbox || false;
      const highlight = page.properties?.Highlight?.checkbox || false;

      return {
        id: page.id,
        name: postName,
        publishDate,
        attachment,
        video,
        thumbnail,
        type,
        pinned,
        hide,
        highlight,
      };
    });

    // 6️⃣ FINAL RESPONSE
    res.json({ profile, posts });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
