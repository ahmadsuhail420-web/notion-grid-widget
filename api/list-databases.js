import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) return res.status(400).json({ error: "Missing slug" });

  // 1️⃣ Get token from Supabase
  const dbRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/workspaces?slug=eq.${slug}`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  const [workspace] = await dbRes.json();

  if (!workspace?.notion_access_token) {
    return res.status(401).json({ error: "Not connected to Notion" });
  }

  // 2️⃣ Search databases
  const notion = new Client({
    auth: workspace.notion_access_token,
  });

  const result = await notion.search({
    filter: {
      property: "object",
      value: "database",
    },
  });

  res.json(
    result.results.map(db => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || "Untitled"
    }))
  );
}
