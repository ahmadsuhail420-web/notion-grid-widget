import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export default async function handler(req, res) {

  try {

    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
    });

    const posts = response.results.map(page => {

      const attachment =
        page.properties["Attachment"]?.files?.[0]?.file?.url ||
        page.properties["Attachment"]?.files?.[0]?.external?.url ||
        null;

      const video =
        page.properties["Media/Video"]?.url || null;

      const type =
        page.properties["Type"]?.multi_select?.map(t => t.name) || [];

      const pinned =
        page.properties["Pin"]?.checkbox || false;

      const publishDate =
        page.properties["Publish Date"]?.date?.start || null;

      const name =
        page.properties["Name"]?.rich_text?.[0]?.plain_text ||
        page.properties["Name"]?.title?.[0]?.plain_text ||
        "";

      return {
        id: page.id,
        name,
        publishDate,
        attachment,
        video,
        type,
        pinned
      };
    });

    res.status(200).json(posts);

  } catch (error) {

    console.log("NOTION ERROR:", error);

    res.status(500).json({
      error: "Notion fetch failed",
      details: error.message
    });
  }
}
