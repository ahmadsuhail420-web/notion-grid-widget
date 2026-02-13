import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  try {
    // 1️⃣ GET SLUG FROM URL
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ error: "Missing widget slug" });
    }

    // 2️⃣ FETCH WORKSPACE FROM SUPABASE  ← THIS IS THE FETCH
    const workspaceRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/workspaces?slug=eq.${slug}&is_active=eq.true`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    // ✅ RIGHT AFTER THE FETCH (THIS IS WHAT I MEANT)
    const workspaceData = await workspaceRes.json();
    const workspace = workspaceData[0];

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    // 3️⃣ CREATE NOTION CLIENT USING CUSTOMER TOKEN
    const notion = new Client({
      auth: workspace.notion_access_token,
    });

    // 4️⃣ QUERY CUSTOMER DATABASE
    const response = await notion.databases.query({
      database_id: workspace.notion_database_id,
    });

    // 5️⃣ MAP RESULTS
    const posts = response.results.map((page) => {
      const name =
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
      };
    });

    res.status(200).json(posts);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server crashed" });
  }
}
