import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  try {
    const notion = new Client({
      auth: process.env.NOTION_TOKEN,
    });

    const databaseId = process.env.NOTION_DATABASE_ID;

    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: "Pin",
          direction: "descending",
        },
        {
          property: "Publish Date",
          direction: "descending",
        },
      ],
    });

    const posts = response.results.map((page) => {
      // -------- NAME --------
      const name =
        page.properties["Name"]?.title?.[0]?.plain_text || "";

      // -------- DATE --------
      const publishDate =
        page.properties["Publish Date"]?.date?.start || null;

      // -------- ATTACHMENT (FILES & MEDI
