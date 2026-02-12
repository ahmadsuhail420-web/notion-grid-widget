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
        /* ---------- BASIC FIELDS ---------- */
        const name =
          page.properties?.Name?.title?.[0]?.plain_text || "";

        const publishDate =
          page.properties?.["Publish Date"]?.date?.start || null;

        /* ---------- ATTACHMENTS (IMAGES) ---------- */
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

        /* ---------- VIDEO URL ---------- */
        const video =
          page.properties?.["Media/Video"]?.url || null;

        /* ---------- ✅ THUMBNAIL (THIS WAS MISSING) ---------- */
        const thumbFiles = page.properties?.Thumbnail?.files || [];
        const thumbnail =
          thumbFiles.length > 0
            ? thumbFiles[0]?.file?.url ||
              thumbFiles[0]?.external?.url ||
              null
            : null;

        /* ---------- TYPE ---------- */
        const type =
          page.properties?.Type?.multi_select?.map(
            (t) => t.name
          ) || [];

        /* ---------- PIN ---------- */
        const pinned =
          page.properties?.Pin?.checkbox || false;

        return {
          id: page.id,
          name,
          publishDate,
          attachment,
          video,
          thumbnail, // ✅ NOW SENT TO FRONTEND
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
