import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  try {
    // -------- CHECK ENV FIRST --------
    if (!process.env.NOTION_TOKEN) {
      return res.status(500).json({
        error: "Missing NOTION_TOKEN env variable",
      });
    }

    if (!process.env.NOTION_DATABASE_ID) {
      return res.status(500).json({
        error: "Missing NOTION_DATABASE_ID env variable",
      });
    }

    const notion = new Client({
      auth: process.env.NOTION_TOKEN,
    });

    const databaseId = process.env.NOTION_DATABASE_ID;

    const response = await notion.databases.query({
      database_id: databaseId,
    });

    const posts = response.results.map((page) => {
      try {
        const name =
          page.properties?.Name?.title?.[0]?.plain_text || "";

        const publishDate =
          page.properties?.["Publish Date"]?.date?.start || null;

        const files =
          page.properties?.Attachment?.files || [];

        let attachment = null;
        if (files.length > 0) {
          attachment =
            files[0]?.file?.url ||
            files[0]?.external?.url ||
            null;
        }

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
          attachment,
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
      hint: "Check ENV variables or database access",
    });
  }
}
