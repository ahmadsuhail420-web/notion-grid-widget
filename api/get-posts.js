import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  try {
    if (!process.env.NOTION_TOKEN) {
      return res.status(500).json({ error: "Missing NOTION_TOKEN" });
    }

    if (!process.env.NOTION_DATABASE_ID) {
      return res.status(500).json({ error: "Missing NOTION_DATABASE_ID" });
    }

    const notion = new Client({
      auth: process.env.NOTION_TOKEN,
    });

    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
    });

    const posts = response.results.map((page) => {
      try {
        const name =
          page.properties?.Name?.title?.[0]?.plain_text || "";

        const publishDate =
          page.properties?.["Publish Date"]?.date?.start || null;

        // ✅ FIX: return ALL attachments
        const files = page.properties?.Attachment?.files || [];
        const attachment =
          files.length > 0
            ? files
                .map(
                  (f) =>
                    f?.file?.url ||
                    f?.external?.url
                )
                .filter(Boolean)
            : null;

        const video =
          page.properties?.["Media/Video"]?.url || null;

        const type =
          page.properties?.Type?.multi_select?.map(
            (t) => t.name
          ) || [];

        const pinned =
          page.properties?.Pin?.checkbox || false;

        return {
          id: page.id,
          name,
          publishDate,
          attachment, // <-- ARRAY when multi, STRING not used anymore
          video,
          type,
          pinned,
        };
      } catch (e) {
        return {
          id: page.id,
          error: "Row parse failed",
        };
      }
    });

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({
      error: "Server crashed",
      message: error.message,
    });
  }
}
