export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) {
      return res.json({ profile: null, posts: [] });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    /* ===================== 1. FIND CUSTOMER ===================== */
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

    /* ===================== 2. GET NOTION CONNECTION ===================== */
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

    /* ===================== 3. QUERY NOTION ===================== */
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
    const results = notionData.results || [];

    /* ===================== 4. EXTRACT PROFILE ===================== */
    let profile = {
      name: "Grid Planner",
      picture: null,
    };

    results.forEach(page => {
      const isProfile =
        page.properties?.Pin?.checkbox === true &&
        page.properties?.Highlight?.checkbox === true;

      if (isProfile) {
        profile.name =
          page.properties?.["Profile Name"]?.rich_text?.[0]?.plain_text ||
          profile.name;

        profile.picture =
          page.properties?.["Profile Picture"]?.files?.[0]?.file?.url ||
          page.properties?.["Profile Picture"]?.files?.[0]?.external?.url ||
          null;
      }
    });

    /* ===================== 5. MAP POSTS (EXCLUDE PROFILE ROW) ===================== */
    const posts = results
      .filter(page => {
        const isProfile =
          page.properties?.Pin?.checkbox === true &&
          page.properties?.Highlight?.checkbox === true;
        return !isProfile;
      })
      .map(page => {
        const name =
          page.properties?.Name?.title?.[0]?.plain_text || "";

        const publishDate =
          page.properties?.["Publish Date"]?.date?.start || null;

        const attachment =
          page.properties?.Attachment?.files?.map(
            f => f.file?.url || f.external?.url
          ).filter(Boolean) || null;

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

        const pinned = page.properties?.Pin?.checkbox || false;
        const hide = page.properties?.Hide?.checkbox || false;
        const highlight = page.properties?.Highlight?.checkbox || false;

        return {
          id: page.id,
          name,
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

    /* ===================== 6. RESPONSE ===================== */
    res.json({ profile, posts });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
