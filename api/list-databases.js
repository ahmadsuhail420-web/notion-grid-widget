import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  // 1️⃣ Get workspace token
  const wsRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/workspaces?slug=eq.${slug}&is_active=eq.true&select=notion_access_token`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  const [workspace] = await wsRes.json();

  if (!workspace?.notion_access_token) {
    return res.status(404).json({ error: "Workspace not found" });
  }

  // 2️⃣ Search databases in Notion
  const notion = new Client({ auth: workspace.notion_access_token });

  const response = await notion.search({
    filter: { property: "object", value: "database" },
  });

  // 3️⃣ Return minimal data
  const databases = response.results.map(db => ({
    id: db.id,
    title: db.title?.[0]?.plain_text || "Untitled",
  }));

  res.json(databases);
}