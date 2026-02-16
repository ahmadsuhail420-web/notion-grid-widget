export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) {
      return res.json({ profile: null, posts: [] });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    /* -------------------------------
       1️⃣ FIND CUSTOMER
    -------------------------------- */
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

    /* -------------------------------
       2️⃣ GET NOTION CONNECTION
    -------------------------------- */
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

    /* -------------------------------
       3️⃣ QUERY NOTION DATABASE
    -------------------------------- */
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
    const rows = notionData.results || [];

    /* -------------------------------
       4️⃣ PROFILE ROW
    -------------------------------- */
    const profileRow = rows.find(
      page => page.properties?.["Row Type"]?.select?.name === "Profile"
    );

    const profile = profileRow
      ? {
          name:
            profileRow.properties?.["Profile Name"]?.rich_text?.[0]?.plain_text ||
            "Grid Planner",

          picture:
            profileRow.properties?.["Profile Picture"]?.files?.[0]?.file?.url ||
            profileRow.properties?.["Profile Picture"]?.files?.[0]?.external?.url ||
            null,
        }
      : null;

    /* -------------------------------
       5️⃣ POST ROWS
    -------------------------------- */
    const posts = rows
      .filter(
        page => page.properties?.["Row Type"]?.select?.name === "Post"
      )
      .map(page => {
        const props = page.properties;

        return {
          id: page.id,

          name: props?.Name?.title?.[0]?.plain_text || "",

          publishDate: props?.["Publish Date"]?.date?.start || null,

          attachment:
            props?.Attachment?.files?.map(
              f => f.file?.url || f.external?.url
            ) || null,

          video:
            props?.["Media/Video"]?.files?.[0]?.file?.url ||
            props?.["Media/Video"]?.files?.[0]?.external?.url ||
            null,

          thumbnail:
            props?.Thumbnail?.files?.[0]?.file?.url ||
            props?.Thumbnail?.files?.[0]?.external?.url ||
            null,

          type: props?.Type?.multi_select?.map(t => t.name) || [],

          pinned: props?.Pin?.checkbox || false,
          hide: props?.Hide?.checkbox || false,
          highlight: props?.Highlight?.checkbox || false,
        };
      });

    /* -------------------------------
       6️⃣ FINAL RESPONSE
    -------------------------------- */
    res.json({
      profile,
      posts,
    });

  } catch (err) {
    console.error("API ERROR:", err);
    res.status(500).json({ error: err.message });
  }
}
